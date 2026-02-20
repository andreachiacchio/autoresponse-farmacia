import { NextRequest, NextResponse } from 'next/server';
import { 
  getTrustpilotConfig, 
  getAccessToken,
  getBusinessUnit 
} from '@/lib/trustpilot/client';

// GET - Get current configuration from environment
export async function GET() {
  try {
    const config = getTrustpilotConfig();
    
    if (!config) {
      return NextResponse.json({ 
        configured: false,
        message: 'Nessuna configurazione trovata. Configura le variabili d\'ambiente TRUSTPILOT_API_KEY e TRUSTPILOT_API_SECRET.' 
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
      businessInfo: businessInfo ? {
        name: businessInfo.name,
        numberOfReviews: businessInfo.numberOfReviews
      } : null
    });
  } catch (error) {
    console.error('Error getting config:', error);
    return NextResponse.json(
      { error: 'Errore durante il recupero della configurazione' },
      { status: 500 }
    );
  }
}

// POST - Test configuration (for manual testing in dashboard)
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

    // Test the configuration
    const testConfig = { apiKey, apiSecret, businessUnitId };
    
    try {
      const accessToken = await getAccessToken(testConfig);
      let businessInfo = null;
      
      if (businessUnitId) {
        businessInfo = await getBusinessUnit(testConfig, accessToken);
      }

      return NextResponse.json({ 
        success: true,
        message: 'Configurazione valida! Per renderla permanente, aggiorna le variabili d\'ambiente su Vercel.',
        businessInfo: businessInfo ? {
          name: businessInfo.name,
          numberOfReviews: businessInfo.numberOfReviews
        } : null
      });
    } catch (error: any) {
      return NextResponse.json({ 
        error: `Test connessione fallito: ${error.message}` 
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Error testing config:', error);
    return NextResponse.json(
      { error: 'Errore durante il test della configurazione' },
      { status: 500 }
    );
  }
}
