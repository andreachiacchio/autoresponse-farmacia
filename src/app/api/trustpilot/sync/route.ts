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

// POST - Sync reviews and optionally auto-respond
export async function POST(request: NextRequest) {
  const cronLog = await db.cronJobLog.create({
    data: {
      jobName: 'trustpilot_sync',
      status: 'running'
    }
  });

  try {
    const body = await request.json();
    const { autoReply = false, dryRun = false } = body;

    const config = await getTrustpilotConfig();
    
    if (!config) {
      throw new Error('Configurazione Trustpilot non trovata');
    }

    const accessToken = await getAccessToken(config);
    
    // Fetch recent reviews
    const reviews = await fetchReviews(config, accessToken, { limit: 50 });

    let reviewsProcessed = 0;
    let responsesSent = 0;
    const results: Array<{
      reviewId: string;
      authorName?: string;
      rating: number;
      responded: boolean;
      response?: string;
      error?: string;
    }> = [];

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

        if (existingResponse) {
          results.push({
            reviewId: review.id,
            authorName: review.consumer?.name,
            rating: review.rating,
            responded: false,
            response: 'Già risposto in precedenza'
          });
          continue;
        }

        // Find matching template
        const template = await findMatchingTemplate(review.rating);

        // Generate AI response
        const generatedResponse = await generateAIResponse(
          review,
          template?.customInstruction,
          template?.tone || 'professionale'
        );

        // Get the review from DB for the log
        const savedReview = await db.review.findUnique({
          where: { trustpilotId: review.id }
        });

        if (autoReply && !dryRun && savedReview) {
          // Send response to Trustpilot
          const sent = await replyToReview(config, accessToken, review.id, generatedResponse);
          
          if (sent) {
            // Log the response
            await logAutoResponse(
              savedReview.id,
              template?.id || null,
              generatedResponse,
              'sent'
            );
            
            // Update review status
            await updateReviewResponseStatus(review.id, new Date());
            
            responsesSent++;
            results.push({
              reviewId: review.id,
              authorName: review.consumer?.name,
              rating: review.rating,
              responded: true,
              response: generatedResponse
            });
          } else {
            // Log failed attempt
            await logAutoResponse(
              savedReview.id,
              template?.id || null,
              generatedResponse,
              'failed',
              'Impossibile inviare la risposta a Trustpilot'
            );
            
            results.push({
              reviewId: review.id,
              authorName: review.consumer?.name,
              rating: review.rating,
              responded: false,
              response: generatedResponse,
              error: 'Impossibile inviare la risposta'
            });
          }
        } else if (savedReview) {
          // Dry run or auto-reply disabled - just save the response as pending
          await logAutoResponse(
            savedReview.id,
            template?.id || null,
            generatedResponse,
            'pending'
          );
          
          results.push({
            reviewId: review.id,
            authorName: review.consumer?.name,
            rating: review.rating,
            responded: false,
            response: generatedResponse
          });
        }
      } catch (error) {
        console.error(`Error processing review ${review.id}:`, error);
        results.push({
          reviewId: review.id,
          authorName: review.consumer?.name,
          rating: review.rating,
          responded: false,
          error: error instanceof Error ? error.message : 'Errore sconosciuto'
        });
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
      dryRun,
      autoReply,
      results
    });
  } catch (error) {
    console.error('Error in sync:', error);
    
    // Update cron log with error
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
