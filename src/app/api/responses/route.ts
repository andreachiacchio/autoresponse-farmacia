import { NextRequest, NextResponse } from 'next/server';
import { 
  getTrustpilotConfig, 
  getAccessToken, 
  replyToReview,
  fetchReviews,
  generateAIResponse,
  TrustpilotReview
} from '@/lib/trustpilot/client';

// In-memory storage for pending responses (resets on each deployment)
const pendingResponses: Map<string, {
  id: string;
  reviewId: string;
  review: TrustpilotReview;
  generatedResponse: string;
  status: 'pending' | 'sent' | 'rejected';
  createdAt: Date;
}> = new Map();

// GET - Get pending responses
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let responses = Array.from(pendingResponses.values());
    
    if (status) {
      responses = responses.filter(r => r.status === status);
    }

    return NextResponse.json({
      success: true,
      responses: responses.map(r => ({
        id: r.id,
        reviewId: r.reviewId,
        generatedResponse: r.generatedResponse,
        status: r.status,
        createdAt: r.createdAt,
        review: {
          id: r.review.id,
          authorName: r.review.consumer?.name || 'Cliente Anonimo',
          text: r.review.text,
          rating: r.review.rating
        },
        template: {
          name: 'Default'
        }
      }))
    });
  } catch (error) {
    console.error('Error fetching responses:', error);
    return NextResponse.json(
      { error: 'Errore durante il recupero delle risposte' },
      { status: 500 }
    );
  }
}

// POST - Generate and/or send a response
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reviewId, editedResponse, review, generateNew } = body;

    // If reviewId is provided with editedResponse, send it
    if (reviewId && editedResponse) {
      const config = getTrustpilotConfig();
      if (!config || !config.businessUnitId) {
        return NextResponse.json(
          { error: 'Configurazione Trustpilot non trovata' },
          { status: 400 }
        );
      }

      const accessToken = await getAccessToken(config);
      
      const sent = await replyToReview(config, accessToken, reviewId, editedResponse);

      if (sent) {
        // Update status in memory
        const pending = pendingResponses.get(reviewId);
        if (pending) {
          pending.status = 'sent';
        }

        return NextResponse.json({
          success: true,
          message: 'Risposta inviata con successo'
        });
      } else {
        return NextResponse.json(
          { error: 'Impossibile inviare la risposta a Trustpilot' },
          { status: 500 }
        );
      }
    }

    // If review is provided, generate a new response
    if (review && generateNew) {
      const response = await generateAIResponse(review as TrustpilotReview);
      
      const pendingId = `resp-${Date.now()}`;
      pendingResponses.set(pendingId, {
        id: pendingId,
        reviewId: review.id,
        review: review,
        generatedResponse: response,
        status: 'pending',
        createdAt: new Date()
      });

      return NextResponse.json({
        success: true,
        response: {
          id: pendingId,
          generatedResponse: response
        }
      });
    }

    return NextResponse.json(
      { error: 'Parametri non validi' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in response POST:', error);
    return NextResponse.json(
      { error: 'Errore durante l\'elaborazione della risposta' },
      { status: 500 }
    );
  }
}

// DELETE - Reject a pending response
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID risposta richiesto' },
        { status: 400 }
      );
    }

    const pending = pendingResponses.get(id);
    if (pending) {
      pending.status = 'rejected';
    }

    return NextResponse.json({
      success: true,
      message: 'Risposta rifiutata'
    });
  } catch (error) {
    console.error('Error deleting response:', error);
    return NextResponse.json(
      { error: 'Errore durante l\'eliminazione della risposta' },
      { status: 500 }
    );
  }
}
