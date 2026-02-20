import { NextRequest, NextResponse } from 'next/server';
import { 
  saveTrustpilotConfig, 
  getTrustpilotConfig, 
  getAccessToken,
  getBusinessUnit 
} from '@/lib/trustpilot/client';
import { db } from '@/lib/db';

// GET - Get current configuration
export async function GET() {
  try {
    const config = await getTrustpilotConfig();
    
    if (!config) {
      return NextResponse.json({ 
        configured: false,
        message: 'Nessuna configurazione trovata' 
      });
    }

    // Test the connection
    let connectionStatus = 'not_tested';
    let businessInfo = null;
    
    try {
      const accessToken = await getAccessToken(config);
      connectionStatus = 'connected';
      
      if (config.businessUnitId) {
        businessInfo = await getBusinessUnit(config, accessToken);
      }
    } catch (error) {
      connectionStatus = 'error';
      console.error('Connection test failed:', error);
    }

    return NextResponse.json({
      configured: true,
      apiKey: config.apiKey.substring(0, 8) + '...',  // Masked
      businessUnitId: config.businessUnitId,
      connectionStatus,
      businessInfo
    });
  } catch (error) {
    console.error('Error getting config:', error);
    return NextResponse.json(
      { error: 'Errore durante il recupero della configurazione' },
      { status: 500 }
    );
  }
}

// POST - Save new configuration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, apiSecret, businessUnitId } = body;

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'API Key e API Secret sono obbligatori' },
        { status: 400 }
      );
    }

    // Test the credentials before saving
    try {
      const accessToken = await getAccessToken({ apiKey, apiSecret, businessUnitId });
      
      // If businessUnitId provided, verify it
      if (businessUnitId) {
        await getBusinessUnit({ apiKey, apiSecret, businessUnitId }, accessToken);
      }
    } catch (error) {
      return NextResponse.json(
        { error: 'Credenziali non valide o Business Unit ID errato' },
        { status: 400 }
      );
    }

    // Save the configuration
    await saveTrustpilotConfig({ apiKey, apiSecret, businessUnitId });

    return NextResponse.json({ 
      success: true,
      message: 'Configurazione salvata con successo' 
    });
  } catch (error) {
    console.error('Error saving config:', error);
    return NextResponse.json(
      { error: 'Errore durante il salvataggio della configurazione' },
      { status: 500 }
    );
  }
}

// PUT - Update configuration
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, isActive } = body;

    await db.trustpilotConfig.update({
      where: { id },
      data: { isActive }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating config:', error);
    return NextResponse.json(
      { error: 'Errore durante l\'aggiornamento della configurazione' },
      { status: 500 }
    );
  }
}

// DELETE - Delete configuration
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID richiesto' },
        { status: 400 }
      );
    }

    await db.trustpilotConfig.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting config:', error);
    return NextResponse.json(
      { error: 'Errore durante l\'eliminazione della configurazione' },
      { status: 500 }
    );
  }
}
