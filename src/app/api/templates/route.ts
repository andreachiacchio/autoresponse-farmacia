import { NextRequest, NextResponse } from 'next/server';

// Default templates (hardcoded for serverless)
const defaultTemplates = [
  {
    id: 'template-positive',
    name: 'Recensioni Positive',
    description: 'Template per recensioni con 4-5 stelle',
    minRating: 4,
    maxRating: 5,
    customInstruction: 'Il cliente ha lasciato una recensione positiva. Esprimi gratitudine sincera e invita a tornare.',
    tone: 'professionale',
    isDefault: false,
    isActive: true,
    priority: 1
  },
  {
    id: 'template-negative',
    name: 'Recensioni Negative',
    description: 'Template per recensioni con 1-2 stelle',
    minRating: 1,
    maxRating: 2,
    customInstruction: 'Il cliente ha avuto un\'esperienza negativa. Mostra empatia, scusati se appropriato, e proponi una soluzione o un modo per rimediare. Offri un contatto diretto per risolvere il problema.',
    tone: 'empatico',
    isDefault: false,
    isActive: true,
    priority: 2
  },
  {
    id: 'template-default',
    name: 'Default',
    description: 'Template predefinito per tutte le recensioni',
    minRating: 1,
    maxRating: 5,
    customInstruction: null,
    tone: 'professionale',
    isDefault: true,
    isActive: true,
    priority: 0
  }
];

// In-memory templates (can be modified during session)
let customTemplates: any[] = [];

// GET - Get all templates
export async function GET() {
  try {
    const allTemplates = [...defaultTemplates, ...customTemplates];
    
    return NextResponse.json({
      success: true,
      templates: allTemplates.map(t => ({
        ...t,
        _count: { responses: 0 }
      }))
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: 'Errore durante il recupero dei template' },
      { status: 500 }
    );
  }
}

// POST - Create new template (stored in memory for this session)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      name, 
      description, 
      minRating, 
      maxRating, 
      customInstruction, 
      tone,
      isDefault
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Il nome del template è obbligatorio' },
        { status: 400 }
      );
    }

    const template = {
      id: `template-${Date.now()}`,
      name,
      description: description || '',
      minRating: minRating || 1,
      maxRating: maxRating || 5,
      customInstruction: customInstruction || null,
      tone: tone || 'professionale',
      isDefault: isDefault || false,
      isActive: true,
      priority: customTemplates.length + 1
    };

    customTemplates.push(template);

    return NextResponse.json({
      success: true,
      template,
      note: 'Template salvato in memoria. Per renderlo permanente, modifica il codice sorgente.'
    });
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json(
      { error: 'Errore durante la creazione del template' },
      { status: 500 }
    );
  }
}

// DELETE - Delete custom template
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID template richiesto' },
        { status: 400 }
      );
    }

    // Can only delete custom templates
    customTemplates = customTemplates.filter(t => t.id !== id);

    return NextResponse.json({ 
      success: true,
      note: 'Solo i template personalizzati possono essere eliminati.'
    });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json(
      { error: 'Errore durante l\'eliminazione del template' },
      { status: 500 }
    );
  }
}
