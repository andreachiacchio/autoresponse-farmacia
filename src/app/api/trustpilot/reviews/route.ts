import { NextRequest, NextResponse } from 'next/server';
import { 
  getTrustpilotConfig, 
  getAccessToken, 
  fetchReviews 
} from '@/lib/trustpilot/client';

// GET - Fetch reviews from Trustpilot API
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const stars = searchParams.get('stars');
    const limit = searchParams.get('limit');
    const since = searchParams.get('since');

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
    
    const reviews = await fetchReviews(config, accessToken, {
      stars: stars ? parseInt(stars) : undefined,
      limit: limit ? parseInt(limit) : 50,
      since: since || undefined
    });

    // Transform reviews for frontend
    const transformedReviews = reviews.map(review => ({
      id: review.id,
      trustpilotId: review.id,
      authorName: review.consumer?.name || 'Cliente Anonimo',
      title: review.title,
      text: review.text,
      rating: review.rating,
      language: review.language,
      isVerified: review.isVerified,
      createdAt: review.createdAt
    }));

    return NextResponse.json({
      success: true,
      source: 'api',
      count: reviews.length,
      reviews: transformedReviews
    });
  } catch (error: any) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json(
      { error: `Errore durante il recupero delle recensioni: ${error.message}` },
      { status: 500 }
    );
  }
}
