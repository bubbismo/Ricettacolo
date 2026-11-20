# Ricettacolo 📜🍅

Il ricettario di famiglia: le ricette sono foto di pagine (anche scritte a mano), con titolo, provenienza,
categorie, voto e note per ritrovarle. È una web app installabile (PWA): funziona anche senza rete e tutti i dati
restano sul telefono.

**App online:** <https://bubbismo.github.io/Ricettacolo/>

## Installare sul telefono

- **iPhone (Safari)**: apri l'indirizzo, tocca *Condividi* ⬆️ → *Aggiungi alla schermata Home*.
- **Android (Chrome)**: apri l'indirizzo, tocca ⋮ → *Installa app*.

## Salvare le ricette (importante)

Le ricette vivono nella memoria del telefono. Se il telefono viene cambiato o l'app disinstallata, vanno perse:
in **Impostazioni → Backup** si salva un file `.ricettario` con tutto, da conservare in un posto sicuro.
Lo stesso file serve per passare le ricette a un altro telefono (**Importa**): l'importazione unisce senza cancellare.

## Cosa sa fare

- **Archivio** con ricerca, filtri e ordinamenti; foto ritagliate e raddrizzate sul telefono.
- **Da sistemare**: tante foto insieme, da trasformare in ricette con calma.
- **Modalità cucina**: schermo acceso, zoom a due dita, scorrimento tra le pagine.
- **Oggi**: una ricetta a caso, filtrabile.
- **Testo facoltativo**: lettura del testo da pagine stampate e screenshot (OCR italiano, tutto sul telefono; la prima volta serve la
  connessione per scaricare il lettore), testo diretto dai PDF, lettura a voce.
- **PDF** di una ricetta, di una selezione o di tutto il ricettario; **backup** `.ricettario` per passare tutto a un altro telefono.

## Sviluppo

```bash
npm install
npm run dev        # sviluppo (http://localhost:5173/Ricettacolo/)
npm test           # test della logica (hash, unione, ricerca, backup)
npm run check      # controllo dei tipi
npm run build      # build per la pubblicazione (copia prima in public/ocr i file dell'OCR, non versionati)
npm run icons      # rigenera le icone da public/favicon.svg
```

Pubblicazione: ogni push su `main` esegue controlli, test e build e pubblica su GitHub Pages
(*Settings → Pages → Source: GitHub Actions*).

## Struttura

- `src/core` – logica pura: modello dati, hash, regola di unione, ricerca, migrazioni (con test)
- `src/adapters` – IndexedDB, backup `.ricettario` (zip), PDF, elaborazione immagini, funzioni del dispositivo
- `src/app` – stato e navigazione
- `src/ui` – schermate e componenti Svelte
