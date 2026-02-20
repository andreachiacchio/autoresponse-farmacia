import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { 
  getTrustpilotConfig, 
  getAccessToken, 
  replyToReview 
} from '@/lib/trustpilot/client';

// GET - Get all responses (with filters)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');

    const whereClause: Record<string, unknown> = {};
    if (status) {
      whereClause.status = status;
    }

    const responses = await db.autoResponseLog.findMany({
      where: whereClause,
      include: {
        review: true,
        template: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return NextResponse.json({
      success: true,
      responses
    });
  } catch (error) {
    console.error('Error fetching responses:', error);
    return NextResponse.json(
      { error: 'Errore durante il recupero delle risposte' },
      { status: 500 }
    );
  }
}

// POST - Approve and send a pending response
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { responseId, editedResponse } = body;

    if (!responseId) {
      return NextResponse.json(
        { error: 'ID risposta richiesto' },
        { status: 400 }
      );
    }

    const responseLog = await db.autoResponseLog.findUnique({
      where: { id: responseId },
      include: { review: true }
    });

    if (!responseLog) {
      return NextResponse.json(
        { error: 'Risposta non trovata' },
        { status: 404 }
      );
    }

    if (responseLog.status === 'sent') {
      return NextResponse.json(
        { error: 'Questa risposta è già stata inviata' },
        { status: 400 }
      );
    }

    const config = await getTrustpilotConfig();
    if (!config) {
      return NextResponse.json(
        { error: 'Configurazione Trustpilot non trovata' },
        { status: 400 }
      );
    }

    const accessToken = await getAccessToken(config);
    const messageToSend = editedResponse || responseLog.generatedResponse;

    // Send to Trustpilot
    const sent = await replyToReview(
      config, 
      accessToken, 
      responseLog.review.trustpilotId, 
      messageToSend
    );

    if (sent) {
      // Update response log
      await db.autoResponseLog.update({
        where: { id: responseId },
        data: {
          generatedResponse: messageToSend,
          status: 'sent',
          sentAt: new Date()
        }
      });

      // Update review
      await db.review.update({
        where: { id: responseLog.reviewId },
        data: { respondedAt: new Date() }
      });

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
  } catch (error) {
    console.error('Error approving response:', error);
    return NextResponse.json(
      { error: 'Errore durante l\'invio della risposta' },
      { status: 500 }
    );
  }
}

// PUT - Edit a pending response
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { responseId, generatedResponse } = body;

    if (!responseId || !generatedResponse) {
      return NextResponse.json(
        { error: 'ID risposta e testo della risposta sono richiesti' },
        { status: 400 }
      );
    }

    const responseLog = await db.autoResponseLog.findUnique({
      where: { id: responseId }
    });

    if (!responseLog) {
      return NextResponse.json(
        { error: 'Risposta non trovata' },
        { status: 404 }
      );
    }

    if (responseLog.status === 'sent') {
      return NextResponse.json(
        { error: 'Non è possibile modificare una risposta già inviata' },
        { status: 400 }
      );
    }

    await db.autoResponseLog.update({
      where: { id: responseId },
      data: { generatedResponse }
    });

    return NextResponse.json({
      success: true,
      message: 'Risposta aggiornata'
    });
  } catch (error) {
    console.error('Error updating response:', error);
    return NextResponse.json(
      { error: 'Errore durante l\'aggiornamento della risposta' },
      { status: 500 }
    );
  }
}

// DELETE - Reject/delete a pending response
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

    const responseLog = await db.autoResponseLog.findUnique({
      where: { id }
    });

    if (!responseLog) {
      return NextResponse.json(
        { error: 'Risposta non trovata' },
        { status: 404 }
      );
    }

    if (responseLog.status === 'sent') {
      return NextResponse.json(
        { error: 'Non è possibile eliminare una risposta già inviata' },
        { status: 400 }
      );
    }

    await db.autoResponseLog.update({
      where: { id },
      data: { status: 'manual' }
    });

    return NextResponse.json({
      success: true,
      message: 'Risposta contrassegnata per gestione manuale'
    });
  } catch (error) {
    console.error('Error deleting response:', error);
    return NextResponse.json(
      { error: 'Errore durante l\'eliminazione della risposta' },
      { status: 500 }
    );
  }
}
