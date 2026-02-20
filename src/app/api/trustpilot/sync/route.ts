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

// Template per recensioni negative (1-2 stelle)
function getNegativeReviewTemplate(): { tone: string; instruction: string } {
  return {
    tone: 'empatico',
    instruction: `Il cliente ha avuto un'esperienza negativa. 

IMPORTANTE:
- Mostra empatia sincera e comprensione per il disagio
- Scusati se appropriato, senza essere difensivo
- Proponi una soluzione concreta o un modo per rimediare
- Invita il cliente a contattarci direttamente per risolvere il problema
- Fornisci un riferimento di contatto (email: info@farmaciasoccavo.it o telefono)

Esempio di struttura risposta:
1. Ringraziamento per il feedback
2. Scuse/riconoscimento del problema
3. Proposta di soluzione
4. Invito al contatto diretto
5. Firma professionale`
  };
}

// Template per recensioni positive (4-5 stelle)
function getPositiveReviewTemplate(): { tone: string; instruction: string } {
  return {
    tone: 'professionale',
    instruction: `Il cliente ha lasciato una recensione positiva.

IMPORTANTE:
- Ringrazia calorosamente per il feedback
- Esprimi gratitudine per la fiducia
- Invita a tornare o provare altri servizi
- Mantieni breve e genuino`
  };
}

// POST - Sync reviews and optionally auto-respond
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      autoReply = false, 
      dryRun = true, 
      limit = 20,
      stars,  // Filter by rating (e.g., 1, 2 for negative reviews)
      onlyNegative = false  // Process only 1-2 star reviews
    } = body;

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
    
    // Fetch reviews with optional star filter
    const fetchOptions: { limit: number; stars?: number } = { limit };
    if (stars) {
      fetchOptions.stars = stars;
    }
    
    let reviews = await fetchReviews(config, accessToken, fetchOptions);

    // Filter for negative reviews if requested
    if (onlyNegative) {
      reviews = reviews.filter(r => r.rating === 1 || r.rating === 2);
    }

    let reviewsProcessed = 0;
    let responsesSent = 0;
    let skipped = 0;
    const results: Array<{
      reviewId: string;
      authorName?: string;
      rating: number;
      title?: string;
      text?: string;
      responded: boolean;
      response?: string;
      error?: string;
      skipped?: boolean;
    }> = [];

    for (const review of reviews) {
      try {
        reviewsProcessed++;

        // Check if already processed in this session
        if (processedReviews.has(review.id)) {
          skipped++;
          results.push({
            reviewId: review.id,
            authorName: review.consumer?.name,
            rating: review.rating,
            title: review.title,
            text: review.text,
            responded: false,
            skipped: true,
            response: 'Già processato in questa sessione'
          });
          continue;
        }

        // Get template based on rating
        const template = review.rating <= 2 
          ? getNegativeReviewTemplate() 
          : getPositiveReviewTemplate();

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
              title: review.title,
              text: review.text,
              responded: true,
              response: generatedResponse
            });
          } else {
            results.push({
              reviewId: review.id,
              authorName: review.consumer?.name,
              rating: review.rating,
              title: review.title,
              text: review.text,
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
            title: review.title,
            text: review.text,
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
          title: review.title,
          text: review.text,
          responded: false,
          error: error instanceof Error ? error.message : 'Errore sconosciuto'
        });
      }
    }

    return NextResponse.json({
      success: true,
      reviewsProcessed,
      responsesSent,
      skipped,
      dryRun,
      autoReply,
      totalFound: reviews.length,
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
