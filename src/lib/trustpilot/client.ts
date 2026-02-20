import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

// Trustpilot API configuration
const TRUSTPILOT_API_BASE = 'https://api.trustpilot.com/v1';
const TRUSTPILOT_BUSINESS_BASE = 'https://api.trustpilot.com/v1/business-units';

interface TrustpilotConfig {
  apiKey: string;
  apiSecret: string;
  businessUnitId?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
}

interface TrustpilotReview {
  id: string;
  businessUnitId: string;
  consumer: {
    id: string;
    name: string;
  };
  title: string;
  text: string;
  rating: number;
  language: string;
  status: string;
  isVerified: boolean;
  createdAt: string;
}

// Get Trustpilot configuration from database
export async function getTrustpilotConfig(): Promise<TrustpilotConfig | null> {
  const config = await db.trustpilotConfig.findFirst({
    where: { isActive: true }
  });
  
  if (!config) return null;
  
  return {
    apiKey: config.apiKey,
    apiSecret: config.apiSecret,
    businessUnitId: config.businessUnitId,
    accessToken: config.accessToken,
    refreshToken: config.refreshToken
  };
}

// Save Trustpilot configuration to database
export async function saveTrustpilotConfig(config: {
  apiKey: string;
  apiSecret: string;
  businessUnitId?: string;
}): Promise<void> {
  // Deactivate existing configs
  await db.trustpilotConfig.updateMany({
    where: { isActive: true },
    data: { isActive: false }
  });
  
  // Create new config
  await db.trustpilotConfig.create({
    data: {
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      businessUnitId: config.businessUnitId || null
    }
  });
}

// Get OAuth access token from Trustpilot
export async function getAccessToken(config: TrustpilotConfig): Promise<string> {
  const response = await fetch('https://api.trustpilot.com/v1/oauth/oauth-business-users-for-applications/accesstoken', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.apiKey,
      client_secret: config.apiSecret
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Fetch reviews from Trustpilot
export async function fetchReviews(
  config: TrustpilotConfig, 
  accessToken: string,
  options: { 
    stars?: number; 
    limit?: number; 
    since?: string;
  } = {}
): Promise<TrustpilotReview[]> {
  if (!config.businessUnitId) {
    throw new Error('Business Unit ID non configurato');
  }

  const params = new URLSearchParams();
  if (options.stars) params.append('stars', options.stars.toString());
  if (options.limit) params.append('perPage', options.limit.toString());
  else params.append('perPage', '100');
  
  const response = await fetch(
    `${TRUSTPILOT_BUSINESS_BASE}/${config.businessUnitId}/reviews?${params.toString()}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': config.apiKey
      }
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch reviews: ${error}`);
  }

  const data = await response.json();
  return data.reviews || [];
}

// Get business unit info
export async function getBusinessUnit(config: TrustpilotConfig, accessToken: string) {
  if (!config.businessUnitId) {
    throw new Error('Business Unit ID non configurato');
  }

  const response = await fetch(
    `${TRUSTPILOT_BUSINESS_BASE}/${config.businessUnitId}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': config.apiKey
      }
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get business unit: ${error}`);
  }

  return response.json();
}

// Reply to a review
export async function replyToReview(
  config: TrustpilotConfig,
  accessToken: string,
  reviewId: string,
  message: string
): Promise<boolean> {
  const response = await fetch(
    `${TRUSTPILOT_API_BASE}/private/business-units/${config.businessUnitId}/reviews/${reviewId}/reply`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'apikey': config.apiKey
      },
      body: JSON.stringify({ message })
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error(`Failed to reply to review ${reviewId}:`, error);
    return false;
  }

  return true;
}

// Generate AI response for a review
export async function generateAIResponse(
  review: TrustpilotReview,
  customInstruction?: string | null,
  tone: string = 'professionale'
): Promise<string> {
  const zai = await ZAI.create();

  const toneInstructions: Record<string, string> = {
    professionale: "Usa un tono professionale e rispettoso, mantenendo formalità adeguata.",
    amichevole: "Usa un tono caldo e amichevole, come se stessi parlando con un cliente di fiducia.",
    formale: "Usa un tono formale e istituzionale, appropriato per comunicazioni ufficiali.",
    empatico: "Usa un tono empatico e comprensivo, mostrando attenzione per le esigenze del cliente."
  };

  const systemPrompt = `Sei il responsabile della comunicazione della Farmacia Soccavo (https://www.farmaciasoccavo.it/).
La tua task è rispondere alle recensioni dei clienti in modo professionale, utile e personalizzato.

ISTRUZIONI GENERALI:
- Rispondi SEMPRE in italiano
- ${toneInstructions[tone] || toneInstructions.professionale}
- Ringrazia sempre il cliente per il tempo dedicato a lasciare una recensione
- Se la recensione è positiva, esprimi gratitudine e invita a tornare
- Se la recensione è negativa, mostra empatia, scusati se necessario e proponi una soluzione o un modo per rimediare
- Se la recensione è mista, ringrazia per gli aspetti positivi e affronta costruttivamente quelli negativi
- Mantieni le risposte concise ma complete (2-4 frasi massimo)
- Firma sempre la risposta con "Lo staff di Farmacia Soccavo" o una variante appropriata
- Non usare emoji eccessive (massimo 1-2 se appropriate)

INFORMAZIONI SU FARMACIA SOCCAVO:
- Farmacia tradizionale italiana con servizio di e-commerce
- Vende prodotti farmaceutici, parafarmaceutici, cosmetici e integratori
- Offre servizi di consulenza farmaceutica
- Spedizioni rapide in tutta Italia
- Servizio clienti attento e professionale

INDICAZIONI PERSONALIZZATE:
${customInstruction || 'Nessuna indicazione aggiuntiva fornita.'}`;

  const userPrompt = `Valutazione: ${review.rating}/5 stelle
Nome del cliente: ${review.consumer?.name || 'Cliente'}

RECENSIONE DEL CLIENTE:
Titolo: "${review.title || 'Nessun titolo'}"
Testo: "${review.text}"

Scrivi una risposta appropriata a questa recensione.`;

  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    thinking: { type: 'disabled' }
  });

  return completion.choices[0]?.message?.content || '';
}

// Save review to database
export async function saveReview(review: TrustpilotReview): Promise<void> {
  await db.review.upsert({
    where: { trustpilotId: review.id },
    create: {
      trustpilotId: review.id,
      businessUnitId: review.businessUnitId,
      authorName: review.consumer?.name,
      authorId: review.consumer?.id,
      title: review.title,
      text: review.text,
      rating: review.rating,
      language: review.language,
      status: review.status,
      isVerified: review.isVerified,
      trustpilotCreatedAt: new Date(review.createdAt)
    },
    update: {
      title: review.title,
      text: review.text,
      rating: review.rating,
      status: review.status,
      isVerified: review.isVerified,
      updatedAt: new Date()
    }
  });
}

// Find matching template for a review
export async function findMatchingTemplate(rating: number): Promise<{
  id: string;
  customInstruction: string | null;
  tone: string;
} | null> {
  // Try to find a specific template for this rating
  const template = await db.responseTemplate.findFirst({
    where: {
      isActive: true,
      minRating: { lte: rating },
      maxRating: { gte: rating }
    },
    orderBy: [
      { priority: 'desc' },
      { isDefault: 'desc' }
    ]
  });

  return template;
}

// Log auto-response
export async function logAutoResponse(
  reviewId: string,
  templateId: string | null,
  generatedResponse: string,
  status: 'pending' | 'sent' | 'failed' | 'manual' = 'pending',
  errorMessage?: string
): Promise<void> {
  await db.autoResponseLog.create({
    data: {
      reviewId,
      templateId,
      generatedResponse,
      status,
      errorMessage
    }
  });
}

// Update review response status
export async function updateReviewResponseStatus(
  trustpilotId: string,
  respondedAt: Date
): Promise<void> {
  const review = await db.review.findUnique({
    where: { trustpilotId }
  });
  
  if (review) {
    await db.review.update({
      where: { trustpilotId },
      data: { respondedAt }
    });
  }
}
