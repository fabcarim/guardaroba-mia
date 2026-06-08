# 👗 Guardaroba di Mia

App web (PWA) per catalogare i vestiti con le foto e il riconoscimento automatico tramite AI.
Si usa dal telefono come un'app vera, funziona offline, e non richiede nessun server.

## Come funziona

1. **Aggiungi** — scatti o carichi le foto dei vestiti. La prima volta puoi caricarne tante insieme (in bulk); poi una alla volta quando compri qualcosa di nuovo.
2. **Da catalogare** — scorri le foto una a una. Premi **✨ Analizza con l'AI** e l'app riempie da sola categoria, colore, tipo, stagione. Correggi se serve e salvi.
3. **Guardaroba** — vedi tutti i capi catalogati, con ricerca e filtri per categoria e stagione.

I dati restano salvati **su questo dispositivo** (nel browser). Fai un **backup su Drive** ogni tanto dalla scheda Impostazioni.

---

## Installazione su GitHub (una volta sola)

1. Crea un repository su GitHub (es. `guardaroba-mia`).
2. Carica tutti i file di questa cartella nel repository.
3. Vai su **Settings → Pages** del repository.
4. In *Source* scegli il branch `main` e cartella `/ (root)`, salva.
5. Dopo un minuto l'app sarà online a un indirizzo tipo:
   `https://TUO-UTENTE.github.io/guardaroba-mia/`

### Installare sul telefono di Mia
- Apri quell'indirizzo con **Chrome (Android)** o **Safari (iPhone)**.
- Menu del browser → **«Aggiungi a schermata Home»**.
- Ora c'è l'icona come un'app normale.

---

## Attivare il riconoscimento AI

1. Vai su [console.anthropic.com](https://console.anthropic.com), crea un account e una **API key** (`sk-ant-...`).
2. Aggiungi un po' di credito (l'analisi di una foto costa frazioni di centesimo con il modello Haiku).
3. Nell'app: **Impostazioni → incolla la chiave → Salva**.

La chiave resta **solo sul dispositivo di Mia** e viene usata solo per parlare direttamente con Anthropic. Non passa da nessun altro server.

> Senza chiave l'app funziona lo stesso: basta inserire i dati dei capi a mano.

---

## Backup e ripristino

- **Esporta backup**: crea un file `guardaroba-backup-AAAA-MM-GG.json` con tutti i capi e le foto (ridotte). Salvalo nella cartella `vestiti` su Google Drive.
- **Importa backup**: su un nuovo telefono/browser, apri l'app → Impostazioni → Importa backup → scegli il file. I duplicati vengono saltati.

> I file di backup **non** vengono caricati su GitHub (sono nel `.gitignore`): contengono le foto e restano privati su Drive.

---

## Dettagli tecnici

- HTML / CSS / JavaScript puri, **nessuna dipendenza**, nessun passaggio di build.
- Storage: **IndexedDB** (capi + foto), **localStorage** (chiave AI e preferenze).
- Foto ridimensionate a max 1024px e compresse in JPEG per risparmiare spazio.
- AI: API Anthropic Claude (vision) chiamata direttamente dal browser.
- PWA installabile e offline tramite `manifest.webmanifest` + `sw.js`.

## File del progetto

| File | Cosa fa |
|------|---------|
| `index.html` | struttura e schermate |
| `styles.css` | aspetto grafico |
| `app.js` | tutta la logica (storage, AI, backup) |
| `manifest.webmanifest` | rende l'app installabile |
| `sw.js` | cache offline |
| `icon.svg` | icona dell'app |
