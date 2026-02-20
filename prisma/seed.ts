import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create default response templates
  const templates = [
    {
      name: 'Recensioni Positive (4-5 stelle)',
      description: 'Template per recensioni molto positive',
      minRating: 4,
      maxRating: 5,
      tone: 'amichevole',
      customInstruction: 'Esprimi grande gratitudine, invita il cliente a seguirci sui social e a lasciare un\'altra recensione in futuro. Menziona che siamo sempre disponibili per qualsiasi consulenza.',
      isDefault: false,
      priority: 10
    },
    {
      name: 'Recensioni Miste (3 stelle)',
      description: 'Template per recensioni medie',
      minRating: 3,
      maxRating: 3,
      tone: 'professionale',
      customInstruction: 'Ringrazia per il feedback, chiedi gentilmente cosa potremmo migliorare e offri assistenza per qualsiasi problema. Mostra apertura al dialogo.',
      isDefault: false,
      priority: 5
    },
    {
      name: 'Recensioni Negative (1-2 stelle)',
      description: 'Template per recensioni negative',
      minRating: 1,
      maxRating: 2,
      tone: 'empatico',
      customInstruction: 'Scusati sinceramente per l\'esperienza negativa. Offri un modo concreto per rimediare (contatto diretto, risoluzione del problema). Invita a contattarci privatamente per risolvere la situazione. NON essere difensivo.',
      isDefault: false,
      priority: 20
    },
    {
      name: 'Template Predefinito',
      description: 'Template generico per tutte le recensioni',
      minRating: 1,
      maxRating: 5,
      tone: 'professionale',
      isDefault: true,
      priority: 0
    }
  ]

  for (const template of templates) {
    await prisma.responseTemplate.upsert({
      where: { name: template.name },
      update: template,
      create: template
    })
  }

  // Create app settings
  await prisma.appSetting.upsert({
    where: { key: 'auto_reply_enabled' },
    update: { value: 'false', description: 'Abilita risposte automatiche' },
    create: { key: 'auto_reply_enabled', value: 'false', description: 'Abilita risposte automatiche' }
  })

  console.log('Seed completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
