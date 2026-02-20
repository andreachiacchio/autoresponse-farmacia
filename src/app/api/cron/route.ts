import { NextRequest, NextResponse } from 'next/server';
import { 
  getTrustpilotConfig, 
  getAccessToken, 
  fetchReviews,
  generateAIResponse,
  replyToReview,
  TrustpilotReview
} from '@/lib/trustpilot/client';

// In-memory storage for logs and settings (resets on each deployment)
let cronLogs: Array<{
  id: string;
  jobName: string;
  status: string;
  startedAt: Date;
  completedAt?: Date;
  reviewsProcessed: number;
  responsesSent: number;
  errorMessage?: string;
}> = [];

let appSettings: Record<string, string> = {
  auto_reply_enabled: 'false'
};

// GET - Get cron job logs
export async function GET() {
  return NextResponse.json({
    success: true,
    logs: cronLogs.slice(-20),
    settings: appSettings
  });
}

// Default templates based on rating
function getDefaultTemplate(rating: number): { tone: string; instruction: string } {
  if (rating >= 4) {
    return {
      tone: 'professionale',
      instruction: 'Il cliente ha lasciato una recensione positiva. Esprimi gratitudine sincera e invita a tornare.'
    };
  } else if (rating <= 2) {
    return {
      tone: 'empatico',
      instruction: 'Il cliente ha avuto un\'esperienza negativa. Mostra empatia, scusati se appropriato, e proponi una soluzione o un modo per rimediare. Offri un contatto diretto per risolvere il problema.'
    };
  } else {
    return {
      tone: 'professionale',
      instruction: 'Il cliente ha lasciato una recensione mista. Ringrazia per gli aspetti positivi e affronta costruttivamente quelli negativi.'
    };
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

  const logId = `log-${Date.now()}`;
  const newLog = {
    id: logId,
    jobName: 'auto_sync',
    status: 'running',
    startedAt: new Date(),
    reviewsProcessed: 0,
    responsesSent: 0
  };
  cronLogs.push(newLog);

  try {
    const autoReply = appSettings.auto_reply_enabled === 'true';

    const config = getTrustpilotConfig();
    
    if (!config) {
      throw new Error('Configurazione Trustpilot non trovata');
    }

    if (!config.businessUnitId) {
      throw new Error('Business Unit ID non configurato');
    }

    const accessToken = await getAccessToken(config);
    
    const reviews = await fetchReviews(config, accessToken, { 
      limit: 50 
    });

    let reviewsProcessed = 0;
    let responsesSent = 0;

    for (const review of reviews) {
      try {
        reviewsProcessed++;

        // Get default template based on rating
        const template = getDefaultTemplate(review.rating);

        // Generate AI response
        const generatedResponse = await generateAIResponse(
          review as TrustpilotReview,
          template.instruction,
          template.tone
        );

        if (autoReply) {
          // Send response to Trustpilot
          const sent = await replyToReview(config, accessToken, review.id, generatedResponse);
          
          if (sent) {
            responsesSent++;
          }
        }
      } catch (error) {
        console.error(`Error processing review ${review.id}:`, error);
      }
    }

    // Update log
    const logIndex = cronLogs.findIndex(l => l.id === logId);
    if (logIndex !== -1) {
      cronLogs[logIndex] = {
        ...cronLogs[logIndex],
        status: 'completed',
        completedAt: new Date(),
        reviewsProcessed,
        responsesSent
      };
    }

    return NextResponse.json({
      success: true,
      reviewsProcessed,
      responsesSent,
      autoReply
    });
  } catch (error) {
    console.error('Error in cron job:', error);
    
    // Update log with error
    const logIndex = cronLogs.findIndex(l => l.id === logId);
    if (logIndex !== -1) {
      cronLogs[logIndex] = {
        ...cronLogs[logIndex],
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Errore sconosciuto'
      };
    }

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

    appSettings[key] = value;

    return NextResponse.json({ 
      success: true,
      note: 'Impostazione salvata in memoria. Per renderla permanente, configura le variabili d\'ambiente.'
    });
  } catch (error) {
    console.error('Error updating setting:', error);
    return NextResponse.json(
      { error: 'Errore durante l\'aggiornamento delle impostazioni' },
      { status: 500 }
    );
  }
}
