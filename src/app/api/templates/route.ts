import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Get all templates
export async function GET() {
  try {
    const templates = await db.responseTemplate.findMany({
      include: {
        _count: {
          select: { responses: true }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    return NextResponse.json({
      success: true,
      templates
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: 'Errore durante il recupero dei template' },
      { status: 500 }
    );
  }
}

// POST - Create new template
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
      isDefault,
      priority 
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Il nome del template è obbligatorio' },
        { status: 400 }
      );
    }

    // If this is set as default, remove default from others
    if (isDefault) {
      await db.responseTemplate.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      });
    }

    const template = await db.responseTemplate.create({
      data: {
        name,
        description,
        minRating: minRating || 1,
        maxRating: maxRating || 5,
        customInstruction,
        tone: tone || 'professionale',
        isDefault: isDefault || false,
        priority: priority || 0
      }
    });

    return NextResponse.json({
      success: true,
      template
    });
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json(
      { error: 'Errore durante la creazione del template' },
      { status: 500 }
    );
  }
}

// PUT - Update template
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID template richiesto' },
        { status: 400 }
      );
    }

    // If this is set as default, remove default from others
    if (data.isDefault) {
      await db.responseTemplate.updateMany({
        where: { 
          isDefault: true,
          id: { not: id }
        },
        data: { isDefault: false }
      });
    }

    const template = await db.responseTemplate.update({
      where: { id },
      data
    });

    return NextResponse.json({
      success: true,
      template
    });
  } catch (error) {
    console.error('Error updating template:', error);
    return NextResponse.json(
      { error: 'Errore durante l\'aggiornamento del template' },
      { status: 500 }
    );
  }
}

// DELETE - Delete template
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

    await db.responseTemplate.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json(
      { error: 'Errore durante l\'eliminazione del template' },
      { status: 500 }
    );
  }
}
