import { NextRequest, NextResponse } from 'next/server';
import { 
  getTrustpilotConfig, 
  getAccessToken, 
  fetchReviews,
  saveReview 
} from '@/lib/trustpilot/client';
import { db } from '@/lib/db';

// GET - Fetch reviews from Trustpilot
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const stars = searchParams.get('stars');
    const limit = searchParams.get('limit');
    const since = searchParams.get('since');
    const source = searchParams.get('source'); // 'api' or 'db'

    // If source is 'db', return reviews from database
    if (source === 'db') {
      const reviews = await db.review.findMany({
        include: { response: true },
        orderBy: { createdAt: 'desc' },
        take: limit ? parseInt(limit) : 100
      });

      return NextResponse.json({
        success: true,
        source: 'database',
        count: reviews.length,
        reviews
      });
    }

    // Otherwise fetch from Trustpilot API
    const config = await getTrustpilotConfig();
    
    if (!config) {
      return NextResponse.json(
        { error: 'Configurazione Trustpilot non trovata' },
        { status: 400 }
      );
    }

    const accessToken = await getAccessToken(config);
    
    const reviews = await fetchReviews(config, accessToken, {
      stars: stars ? parseInt(stars) : undefined,
      limit: limit ? parseInt(limit) : 50,
      since: since || undefined
    });

    // Save reviews to database
    for (const review of reviews) {
      await saveReview(review);
    }

    return NextResponse.json({
      success: true,
      source: 'api',
      count: reviews.length,
      reviews
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json(
      { error: 'Errore durante il recupero delle recensioni' },
      { status: 500 }
    );
  }
}
