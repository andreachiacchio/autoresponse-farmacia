import { NextRequest, NextResponse } from "next/server";
import ZAI from 'z-ai-web-dev-sdk';

interface ReviewRequest {
  review: string;
  authorName?: string;
  rating?: number;
  customInstructions?: string;
  tone?: 'professionale' | 'amichevole' | 'formale' | 'empatico';
}

export async function POST(request: NextRequest) {
  try {
    const body: ReviewRequest = await request.json();
    
    if (!body.review || body.review.trim().length === 0) {
      return NextResponse.json(
        { error: "La recensione è obbligatoria" },
        { status: 400 }
      );
    }

    const zai = await ZAI.create();

    const toneInstructions = {
      professionale: "Usa un tono professionale e rispettoso, mantenendo formalità adeguata.",
      amichevole: "Usa un tono caldo e amichevole, come se stessi parlando con un cliente di fiducia.",
      formale: "Usa un tono formale e istituzionale, appropriato per comunicazioni ufficiali.",
      empatico: "Usa un tono empatico e comprensivo, mostrando attenzione per le esigenze del cliente."
    };

    const selectedTone = body.tone || 'professionale';
    const toneInstruction = toneInstructions[selectedTone];

    const systemPrompt = `Sei il responsabile della comunicazione della Farmacia Soccavo (https://www.farmaciasoccavo.it/).
La tua task è rispondere alle recensioni dei clienti in modo professionale, utile e personalizzato.

ISTRUZIONI GENERALI:
- Rispondi SEMPRE in italiano
- ${toneInstruction}
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

INDICAZIONI PERSONALIZZATE DEL CLIENTE:
${body.customInstructions || 'Nessuna indicazione aggiuntiva fornita.'}`;

    const userPrompt = `${body.rating ? `Valutazione: ${body.rating}/5 stelle` : ''}
${body.authorName ? `Nome del cliente: ${body.authorName}` : ''}

RECENSIONE DEL CLIENTE:
"${body.review}"

Scrivi una risposta appropriata a questa recensione.`;

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      thinking: { type: 'disabled' }
    });

    const response = completion.choices[0]?.message?.content;

    if (!response) {
      return NextResponse.json(
        { error: "Impossibile generare una risposta" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      response: response
    });

  } catch (error) {
    console.error('Error generating response:', error);
    return NextResponse.json(
      { error: "Errore durante la generazione della risposta" },
      { status: 500 }
    );
  }
}
