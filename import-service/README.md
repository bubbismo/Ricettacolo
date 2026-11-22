# Servizio di importazione ricette (facoltativo)

Un piccolo servizio gratuito su Cloudflare Workers. Riceve l'indirizzo di una pagina di ricetta, la scarica **per conto dell'app** e restituisce **solo** la ricetta (titolo, ingredienti, passaggi, porzioni, tempi, immagine, nome del sito), letta dai dati strutturati della pagina (JSON-LD `schema.org/Recipe`, con ripiego sui microdata).

- Non salva nulla e non tiene registri degli indirizzi (oltre ai contatori standard di Cloudflare).
- Non usa chiavi di servizi esterni né servizi a pagamento.
- L'app funziona anche senza: se non lo configuri non cambia nulla.

> **Riservatezza.** Con il servizio attivo, gli indirizzi che importi passano da Cloudflare. Il servizio non li conserva, ma è l'unica parte dell'app che non resta solo sul telefono. Le ricette salvate restano sempre solo sul telefono.

## Piano gratuito: bastano i limiti?

Dalla documentazione ufficiale di Cloudflare (verificata al momento dello sviluppo):

| Limite | Piano gratuito | Per una famiglia |
|---|---|---|
| Richieste | 100.000 al giorno | 5-20 al giorno |
| Tempo di calcolo | 10 ms per richiesta | vedi sotto |
| Richieste in uscita | 50 per richiesta | ne servono al massimo 4 |

Il piano gratuito **non ha addebiti extra**: se superi il limite, il servizio risponde con errore fino alla mezzanotte UTC e l'app ripiega sul solo link.
Il tempo di calcolo (10 ms) conta solo l'elaborazione, non l'attesa della rete. Il servizio legge la pagina a flusso con gli strumenti nativi di Cloudflare e si ferma appena trova la ricetta. Dopo la pubblicazione controlla in *Workers & Pages → ricettacolo-import → Metrics* che non compaiano errori «exceeded resource limits».

## Pubblicazione, passo passo

Servono: **Node.js 20 o più recente** e un account Cloudflare gratuito.

1. **Account.** Vai su <https://dash.cloudflare.com/sign-up> e crea un account con la tua e-mail. Non serve nessuna carta di pagamento.
2. **Installazione.** Dal terminale:
   ```bash
   cd import-service
   npm install
   ```
   (Wrangler, lo strumento di Cloudflare, è già tra le dipendenze: non serve installarlo a parte.)
3. **Accesso.**
   ```bash
   npx wrangler login
   ```
   Si apre il browser: accedi e consenti. Se preferisci non inviare statistiche anonime d'uso a Cloudflare: `export WRANGLER_SEND_METRICS=false`.
4. **Origine consentita.** Il file `wrangler.toml` contiene già `ALLOWED_ORIGINS = "https://bubbismo.github.io"`, cioè l'indirizzo dell'app su GitHub Pages (solo il dominio, senza `/Ricettacolo/`). Se l'app si trova altrove, cambialo. Si possono elencare più origini separate da virgole; `*` non è accettato.
5. **Pubblicazione.**
   ```bash
   npx wrangler deploy
   ```
   La prima volta chiede di scegliere un nome per il tuo spazio `workers.dev`. Alla fine stampa l'indirizzo del servizio, simile a
   `https://ricettacolo-import.IL-TUO-NOME.workers.dev`. **Copialo.**
   - *Se il limite di richieste non è disponibile*: se la pubblicazione fallisce con un errore sul blocco `[[ratelimits]]`, cancella quel blocco da `wrangler.toml` e ripubblica. Il servizio funziona lo stesso (restano origine, limiti di dimensione e di tempo, e la chiave del punto 6). Dimmelo e valutiamo un'alternativa.
6. **Chiave personale (consigliata).** Così nessun altro può usare il servizio:
   ```bash
   npx wrangler secret put ACCESS_TOKEN
   ```
   Scrivi una frase lunga e casuale (a capo non serve). La chiave **non** va mai nel codice né su GitHub: la scriverai a mano nelle Impostazioni di ogni telefono.
7. **Prova da terminale.** Sostituisci l'indirizzo con il tuo. L'intestazione `Origin` è necessaria (il servizio rifiuta chi non la dichiara):
   ```bash
   URL=https://ricettacolo-import.IL-TUO-NOME.workers.dev

   # il servizio è vivo? (aggiungi -H "X-Ricettacolo-Key: LA-TUA-CHIAVE" se hai messo la chiave)
   curl -s $URL/health -H "Origin: https://bubbismo.github.io"

   # leggi una ricetta
   curl -s -X POST $URL/recipe \
     -H "Origin: https://bubbismo.github.io" -H "Content-Type: application/json" \
     -d '{"url":"https://ricette.giallozafferano.it/Tiramisu.html"}'
   ```
   Risposta attesa: `{"ok":true,"recipe":{"title":"Tiramisù", ...}}`. Senza `Origin` deve rispondere `403`.
8. **Collega l'app.** Nell'app: *Impostazioni → Importa da un indirizzo web*: incolla l'indirizzo (e la chiave), poi **Salva e prova**. Da ora, condividendo o incollando un link, l'app legge la ricetta. Va fatto su ogni telefono che vuole usare la funzione.

## Come funziona e cosa risponde

- `GET /health` → `{"ok":true}`
- `POST /recipe` con `{"url": "..."}` → ricetta, oppure `{"ok":false,"error":"...","message":"..."}`
- `POST /image` con `{"url": "..."}` → i byte dell'immagine (solo png/jpeg/webp/gif/avif, massimo 6 MB). L'app lo usa **solo** quando tocchi «Salva la foto».

Errori: `bad_url`, `blocked` (indirizzo interno o non consentito), `too_large` (oltre 2 MB), `timeout` (oltre 8 secondi), `not_html`, `upstream_error` (il sito ha rifiutato o dato errore), `no_recipe` (nessuna ricetta strutturata: in questo caso l'app riceve almeno titolo, sito e immagine della pagina), `rate_limited`, `unauthorized`, `forbidden_origin`.

## Sicurezza

- **Origine**: solo quelle in `ALLOWED_ORIGINS`. Nota onesta: l'origine protegge i browser, ma un programma da terminale può dichiararne una qualunque. Per questo esistono la **chiave personale** e il **limite di richieste**.
- **Indirizzi**: solo http/https sulle porte 80 e 443; mai indirizzi IP (di nessun tipo e in nessuna scrittura), mai `localhost`, nomi interni (`.local`, `.internal`…) o servizi che trasformano un IP in un nome. Ogni destinazione è ricontrollata a ogni reindirizzamento (al massimo 3). Un nome pubblico che punta a un indirizzo privato non si può verificare da un Worker; il Worker però gira sulla rete di Cloudflare e non ha nulla di interno da raggiungere.
- **Limiti**: 8 secondi, 2 MB di pagina, solo risposte HTML, 10 richieste al minuto per client.
- Il servizio si presenta con un nome onesto e non cerca di aggirare i siti che bloccano i programmi: in quel caso l'app ti dice che il sito non ha lasciato leggere la pagina e tiene il link.

## Aggiornare

Dopo ogni modifica: `npx wrangler deploy`.

## Spegnere il servizio senza perdere nulla

Dal più morbido al più definitivo:

1. **Solo sul telefono**: *Impostazioni → Importa da un indirizzo web → Disattiva*. La funzione sparisce e l'app torna come prima.
2. **Sul servizio**: dashboard Cloudflare → *Workers & Pages → ricettacolo-import → Settings → Domains & Routes* → disattiva `workers.dev`. Il servizio smette di rispondere (l'app mostra «non riesco a raggiungere il servizio» e tiene il link).
3. **Cancellarlo**: `npx wrangler delete`.

Non si perde nulla in nessun caso: una ricetta importata è già copiata per intero nella ricetta sul telefono (testo, ingredienti, note), e non dipende dal servizio.

## Sviluppo e prove

```bash
npm test        # 57 prove: estrazione, sicurezza, e il Worker vero eseguito in locale (Miniflare) con pagine di prova
npm run check   # controllo dei tipi
npm run dev     # il Worker in locale (wrangler dev)
```
