# AutoResponse - Farmacia Soccavo

Gestione automatica delle recensioni Trustpilot con AI.

## Funzionalità

- 🔗 Integrazione API Trustpilot
- 🤖 Risposte automatiche generate da AI
- 📋 Template personalizzabili per rating
- ⏳ Approvazione manuale delle risposte
- 📊 Log delle attività

## Deploy su Vercel

### 1. Push su GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/TUO-USERNAME/autoresponse-farmacia.git
git push -u origin main
```

### 2. Importa su Vercel
1. Vai su https://vercel.com
2. Clicca "Add New..." → "Project"
3. Importa da GitHub
4. Seleziona la repository

### 3. Aggiungi Database
1. Nella dashboard Vercel, vai su "Storage"
2. Crea "Neon Postgres" (gratuito)
3. Vercel configurerà automaticamente DATABASE_URL

### 4. Aggiorna Prisma per Postgres
Cambia `provider = "sqlite"` in `provider = "postgresql"` nel file `prisma/schema.prisma`

### 5. Environment Variables
Aggiungi su Vercel:
- `TRUSTPILOT_API_KEY` = tpk-m8AS8LV7bzaOEUU0OCYuzwCx5MWw
- `TRUSTPILOT_API_SECRET` = tps-gZ9kJUs0ZygQ

### 6. Deploy!
Clicca "Deploy" e attendi il completamento.

## Sviluppo Locale

```bash
bun install
bun run dev
```

## Tecnologie

- Next.js 15
- Prisma
- shadcn/ui
- z-ai-web-dev-sdk
