# Codex Prompt — Softi AI Analyzer (Render Deploy)

Sei un senior engineer che lavora su softi-ai-analyzer, una app Vite + Express + Socket.io + TypeScript.
Repo: https://github.com/peewe75/softi-ai-analyzer
Stack: Node 20, Express 4, Socket.IO 4, Vite 6, React 19, TypeScript, Tailwind CSS v4, Clerk (auth), Supabase, Google Gemini AI

---

## OBIETTIVO
Preparare l'app per il deploy su Render (Web Service, Node 20).
L'app usa tsx per eseguire TypeScript direttamente (no build step per il server).

---

## TASK 1 — Verificare/fixare lo start command

Il server entry point è `server.ts` nella root.
Lo start command su Render sarà: `npx tsx server.ts`

Verifica che `server.ts`:
- Legga la porta da `process.env.PORT` (Render la imposta automaticamente), con fallback a 3000
- Serva il frontend buildato da `dist/` in produzione (`NODE_ENV === 'production'`)
- Abbia il catch-all per SPA: qualsiasi route non-API risponde con `dist/index.html`

Se manca qualcuno di questi punti, correggili.

---

## TASK 2 — Verificare vite.config.ts per build di produzione

Assicurati che `vite.config.ts` abbia:
- `base: '/'`
- `build.outDir: 'dist'`
- Le variabili d'ambiente con prefisso `VITE_` siano esposte correttamente

---

## TASK 3 — Creare file .env.example

Crea `.env.example` con tutte le variabili necessarie (valori vuoti o descrittivi):

```
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
VITE_PUBLIC_SUPABASE_URL=https://knuuqldetklmsrtvggtk.supabase.co
VITE_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
PORT=3000
NODE_ENV=production
```

---

## TASK 4 — Creare render.yaml nella root

```yaml
services:
  - type: web
    name: softi-ai-analyzer
    runtime: node
    buildCommand: npm install && npm run build
    startCommand: npx tsx server.ts
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
```

---

## TASK 5 — Verificare CORS in server.ts

In produzione su Render il frontend è servito dallo stesso processo Express (stesso dominio).
Verifica che il middleware CORS permetta:
- `https://*.onrender.com`
- `https://ultrabot.space` (BCS AI Suite che potrebbe fare richieste cross-origin)

---

## CONTEXT TECNICO

Supabase project: knuuqldetklmsrtvggtk (BCS project)
Tabelle già create nel DB Supabase:
- `softi_mt5_signals` (id, symbol, action, confidence_score, base_confidence, market_regime, wyckoff_phase, raw_payload, created_at)
- `softi_ai_reports` (id, user_id, timeframe, markdown_content, source_metadata, created_at)
- `softi_analysis_history` (id, user_id, asset_symbols, prompt, response, created_at)

Clerk: stesso progetto di BCS AI Suite (ultrabot.space).
Gli utenti autenticati su BCS sono gli stessi di questa app — non serve migrazione utenti.

---

Esegui i task 1-5 nell'ordine. Verifica con `npx tsc --noEmit` che non ci siano errori TypeScript prima di terminare. Committa tutto su main.
