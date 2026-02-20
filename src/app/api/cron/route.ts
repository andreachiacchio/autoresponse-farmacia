import { NextRequest, NextResponse } from 'next/server';
import { 
  getTrustpilotConfig, 
  getAccessToken, 
  fetchReviews,
  saveReview,
  findMatchingTemplate,
  generateAIResponse,
  replyToReview,
  logAutoResponse,
  updateReviewResponseStatus
} from '@/lib/trustpilot/client';
import { db } from '@/lib/db';

// GET - Get cron job logs
export async function GET() {
  try {
    const logs = await db.cronJobLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: 20
    });

    const settings = await db.appSetting.findMany();

    return NextResponse.json({
      success: true,
      logs,
      settings: settings.reduce((acc, s) => {
        acc[s.key] = s.value;
        return acc;
      }, {} as Record<string, string>)
    });
  } catch (error) {
    console.error('Error fetching cron logs:', error);
    return NextResponse.json(
      { error: 'Errore durante il recupero dei log' },
      { status: 500 }
    );
  }
}

// POST - Run manual sync (for cron job endpoint)
export async function POST(request: NextRequest) {
  // Verify cron secret if provided
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const cronLog = await db.cronJobLog.create({
    data: {
      jobName: 'auto_sync',
      status: 'running'
    }
  });

  try {
    // Get auto-reply setting
    const autoReplySetting = await db.appSetting.findUnique({
      where: { key: 'auto_reply_enabled' }
    });
    const autoReply = autoReplySetting?.value === 'true';

    const config = await getTrustpilotConfig();
    
    if (!config) {
      throw new Error('Configurazione Trustpilot non trovata');
    }

    const accessToken = await getAccessToken(config);
    
    // Fetch recent reviews (last 7 days by default)
    const since = new Date();
    since.setDate(since.getDate() - 7);
    
    const reviews = await fetchReviews(config, accessToken, { 
      limit: 100 
    });

    let reviewsProcessed = 0;
    let responsesSent = 0;

    for (const review of reviews) {
      try {
        // Save review to database
        await saveReview(review);
        reviewsProcessed++;

        // Check if already responded
        const existingResponse = await db.autoResponseLog.findFirst({
          where: { 
            review: { trustpilotId: review.id },
            status: 'sent'
          }
        });

        if (existingResponse) continue;

        // Find matching template
        const template = await findMatchingTemplate(review.rating);

        // Generate AI response
        const generatedResponse = await generateAIResponse(
          review,
          template?.customInstruction,
          template?.tone || 'professionale'
        );

        // Get the review from DB
        const savedReview = await db.review.findUnique({
          where: { trustpilotId: review.id }
        });

        if (!savedReview) continue;

        if (autoReply) {
          // Send response to Trustpilot
          const sent = await replyToReview(config, accessToken, review.id, generatedResponse);
          
          if (sent) {
            await logAutoResponse(
              savedReview.id,
              template?.id || null,
              generatedResponse,
              'sent'
            );
            await updateReviewResponseStatus(review.id, new Date());
            responsesSent++;
          } else {
            await logAutoResponse(
              savedReview.id,
              template?.id || null,
              generatedResponse,
              'failed',
              'Impossibile inviare la risposta a Trustpilot'
            );
          }
        } else {
          // Save as pending for manual review
          await logAutoResponse(
            savedReview.id,
            template?.id || null,
            generatedResponse,
            'pending'
          );
        }
      } catch (error) {
        console.error(`Error processing review ${review.id}:`, error);
      }
    }

    // Update cron log
    await db.cronJobLog.update({
      where: { id: cronLog.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        reviewsProcessed,
        responsesSent
      }
    });

    return NextResponse.json({
      success: true,
      reviewsProcessed,
      responsesSent,
      autoReply
    });
  } catch (error) {
    console.error('Error in cron job:', error);
    
    await db.cronJobLog.update({
      where: { id: cronLog.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Errore sconosciuto'
      }
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Errore durante la sincronizzazione' },
      { status: 500 }
    );
  }
}

// PUT - Update app settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value } = body;

    if (!key) {
      return NextResponse.json(
        { error: 'Key richiesta' },
        { status: 400 }
      );
    }

    await db.appSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating setting:', error);
    return NextResponse.json(
      { error: 'Errore durante l\'aggiornamento delle impostazioni' },
      { status: 500 }
    );
  }
}
