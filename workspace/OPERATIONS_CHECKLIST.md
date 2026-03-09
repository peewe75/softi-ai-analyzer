# OPERATIONS CHECKLIST - SOFTI AI ANALYZER

## Pre-Flight

- [x] `.env` presente e contiene `VITE_GEMINI_API_KEY`
- [x] `workspace/SoftiAddestratoreAI.ex5` disponibile
- [x] Endpoint EA impostato su `http://127.0.0.1:3000/api/analyze` (equivalente locale)

## Startup

- [x] Avvio con `workspace/start_server.bat` (oppure `npm run dev`)
- [x] Se `.bat` bloccato da policy, usare `npm run dev` direttamente
- [x] Verificare log runtime in `logs/server.log` (e `logs/manual_server.out.log`)
- [x] `http://localhost:3000` raggiungibile
- [x] `http://localhost:3000/api/health` restituisce `{"status":"ok"}`

## MT5 Bridge Validation

- [ ] URL `http://localhost:3000` aggiunto in MT5 WebRequest allowed list
- [ ] EA applicato a grafico e avviato
- [x] Nel terminale backend compare `Received data from MT5 EA:` (test payload API)
- [ ] Nella dashboard compaiono log EA e risposta AI in realtime

## Go / No-Go

- [ ] GO: flusso end-to-end completo e stabile
- [x] NO-GO: bloccare produzione e usare troubleshooting (in attesa test MT5 live)

## Troubleshooting veloce

- Nessun payload: ricontrollare WebRequest MT5 + endpoint EA
- UI non aggiorna: verificare Socket.io e console browser
- Errore AI: verificare API key in `.env` e riavvio processo
- Server non parte: verificare dipendenze e conflitto porta `3000`
