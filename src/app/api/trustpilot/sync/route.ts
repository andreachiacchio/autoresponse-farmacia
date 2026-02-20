import { NextRequest, NextResponse } from 'next/server';
import { 
  getTrustpilotConfig, 
  getAccessToken, 
  fetchReviews,
  generateAIResponse,
  replyToReview,
  TrustpilotReview
} from '@/lib/trustpilot/client';

// In-memory cache for processed reviews (resets on each deployment)
const processedReviews = new Set<string>();

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

// POST - Sync reviews and optionally auto-respond
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { autoReply = false, dryRun = true, limit = 20 } = body;

    const config = getTrustpilotConfig();
    
    if (!config) {
      return NextResponse.json(
        { error: 'Configurazione Trustpilot non trovata. Configura le variabili d\'ambiente.' },
        { status: 400 }
      );
    }

    if (!config.businessUnitId) {
      return NextResponse.json(
        { error: 'Business Unit ID non configurato. Aggiungi BUSINESS_UNIT_ID alle variabili d\'ambiente.' },
        { status: 400 }
      );
    }

    const accessToken = await getAccessToken(config);
    
    // Fetch recent reviews
    const reviews = await fetchReviews(config, accessToken, { limit });

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
        reviewsProcessed++;

        // Check if already processed in this session
        if (processedReviews.has(review.id)) {
          results.push({
            reviewId: review.id,
            authorName: review.consumer?.name,
            rating: review.rating,
            responded: false,
            response: 'Già processato in questa sessione'
          });
          continue;
        }

        // Get default template based on rating
        const template = getDefaultTemplate(review.rating);

        // Generate AI response
        const generatedResponse = await generateAIResponse(
          review as TrustpilotReview,
          template.instruction,
          template.tone
        );

        if (autoReply && !dryRun) {
          // Send response to Trustpilot
          const sent = await replyToReview(config, accessToken, review.id, generatedResponse);
          
          if (sent) {
            processedReviews.add(review.id);
            responsesSent++;
            results.push({
              reviewId: review.id,
              authorName: review.consumer?.name,
              rating: review.rating,
              responded: true,
              response: generatedResponse
            });
          } else {
            results.push({
              reviewId: review.id,
              authorName: review.consumer?.name,
              rating: review.rating,
              responded: false,
              response: generatedResponse,
              error: 'Impossibile inviare la risposta a Trustpilot'
            });
          }
        } else {
          // Dry run - just return the generated response
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Errore durante la sincronizzazione' },
      { status: 500 }
    );
  }
}
