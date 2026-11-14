# Ex-Monitor

A crew health console for a training simulation. It shows live body readings, sends crew alerts across the
local network, and can answer questions with a language model that runs entirely in the browser.

No account, no cloud service and no separate AI runtime. The downloaded copy contains the whole app.

## Three pieces

| Piece | What it does |
| --- | --- |
| **Console** (`/`) | Heart trace, five vital cards, the written NASA rules, the flight surgeon and crew alerts. |
| **Sensor page** (`/sensors.html`) | Turns a phone or second screen into a pretend body sensor. It streams realistic readings eight times a second. |
| **Crew link** (`/relay`) | One small WebSocket relay inside the launcher. It carries alerts, presence and sensor frames between devices on the same network. |

Two tabs in the same browser also reach each other through a local channel, so the relay is optional for a
quick demo.

## Requirements

- Node.js 18 or newer (the launcher and the relay use only built-in modules).
- A modern browser. Chrome or Edge is recommended.
- Optional, for the on-device assistant: WebGPU and an internet connection for the first model download.

## Run from the repository

```bash
npm install
npm run build     # builds the console and the sensor page into dist/
npm start         # serves dist/ and opens http://localhost:8080
```

`npm start` prints a second address for the local network. Open that address on a phone, add
`/sensors.html`, then scan the code shown there from **Settings → Scan sensor code** in the console.

For development with hot reload:

```bash
npm run relay     # relay only, port 8080
npm run dev       # Vite on port 5173, proxying /relay to 8080
```

## Run a packaged download

The download page ships one ZIP per assistant choice. Unzip it and start the launcher:

- Windows: double-click `Start Ex-Monitor.cmd`
- macOS: double-click `Start Ex-Monitor.command`
- Linux: run `./start-ex-monitor.sh`

The launcher finds a free port, serves the app and the relay from one address, and opens the browser.
Nothing is installed into the system.

Each ZIP contains the latest built app plus `app/model-config.json`, which selects the assistant that was
chosen on the download page.

## The assistant

The flight surgeon uses one of four choices:

- **Phi-3.5 mini** — strongest answers, about 2.1 GB on first use.
- **Llama 3.2 3B** — balanced, about 1.8 GB.
- **Gemma 2 2B** — smallest, about 1.5 GB.
- **No AI** — written NASA action cards only, nothing to download.

AI answers come from [WebLLM](https://github.com/mlc-ai/web-llm) running in a worker with WebGPU. The model
is downloaded once from Hugging Face, cached by the browser, and then works offline. Nothing is sent to a
server. Without WebGPU, or if a download fails, the console falls back to the written rules.

The model tier is saved in `localStorage`. A new bundle carries a build stamp, so a freshly downloaded ZIP
selects its own assistant once; a choice made later in Settings is kept.

## Alerts

- **Sender** sees a compact panel with the alert status and one **Cancel alert** button. No full-screen
  overlay.
- **Other devices** show a full-screen alert until each one acknowledges it.
- **Acknowledge** clears the alert on that device and tells the sender who acknowledged.
- **Cancel** from the sender clears the alert on every device.
- Critical readings can also start an alert automatically; the sender can cancel it the same way.

System notifications are optional. Browsers only deliver them while the console is open or installed, and
only on `localhost` or HTTPS. The full-screen alert works everywhere while the page is open.

## Sensor page

Five situations change the story gradually rather than jumping between numbers:

- **At rest** — a calm crew member in the habitat.
- **Exercise** — heart rate, heat and sweat rise.
- **Low oxygen** — blood oxygen falls into the critical range and can start an alert.
- **Radiation storm** — dose rate climbs past the caution and critical lines.
- **Recovery** — readings settle after an event.

The page draws an ECG and a pulse wave from the generated signal and shows the same numbers the console
receives. Sensor codes are names, not passwords; keep the demo on a network you trust.

## Build the downloads

```bash
npm run build
npm run package:bundles
```

`scripts/package-bundles.mjs` writes four ZIPs to `bundles/`, copies them into `site/downloads/` for the
download page, and writes a `downloads.json` manifest. Options:

```bash
node scripts/package-bundles.mjs --models phi3,none --out bundles --manifest site/downloads.json
```

Use `--no-site` to skip the copies into `site/downloads/`.

## Download page and hosting

`site/` is a static landing page. It checks WebGPU, memory and processor cores in the browser, recommends a
copy, and links to `/downloads/<file>.zip`.

The same Cloudflare Worker serves the landing page and the ZIPs, so there is no separate storage bucket and
no card is needed. `worker/index.js` adds the download filename and handles resumed byte ranges.
Configuration lives in `wrangler.jsonc`; every ZIP is well under the 25 MiB per-file limit for static assets.

Publishing is handled by `.github/workflows/release.yml` on every push to `main`:

1. Install, build and package the four ZIPs. Packaging copies them into `site/downloads/`.
2. Deploy the Worker and the landing page.

To publish from this machine:

```bash
npx wrangler login
npm run build
npm run package:bundles
npm run site:deploy
```

For GitHub Actions, add repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Without those
secrets the workflow still builds the ZIPs and keeps them as a workflow artifact.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with the relay proxy. |
| `npm run build` | Type-check and build the console and the sensor page. |
| `npm start` | Serve the build and the relay from one address. |
| `npm run relay` | Relay only, for development. |
| `npm run package:bundles` | Create the four downloadable ZIPs and the manifest. |
| `npm run site:dev` | Run the landing page and Worker locally with Wrangler. |
| `npm run site:deploy` | Deploy the download page and its ZIPs. |

## Project layout

```
src/
  components/
    dashboard/    Heart trace, vital cards and radiation card
    ai/           Flight surgeon chat, model download and rules fallback
    setup/        Settings page, sensor scanner
    onboarding/   First-run wizard
    emergency/    Receiver overlay and sender panel
    guide/        How it works page
    layout/       Header and section navigation
    ui/           Small shared pieces such as hover explanations
  context/        One provider for readings, alerts, presence and the model tier
  sensors/        The separate sensor page and its signal generator
  services/       Rules, WebLLM, relay client, notifications, profile, model catalog
server.js         Zero-dependency launcher, static server and relay
scripts/          Build helper and bundle packaging
site/             Download landing page
worker/           Cloudflare Worker that serves the landing page and ZIPs
```

## Limits

- The sensor page sends pretend readings. It is not a medical device and does not read a real body sensor.
- The ECG shape is generated from the simulated heart rate; it is not a measurement.
- AI answers can be wrong. The written NASA action cards stay available on every copy.
- This is a training simulation. It does not replace a real flight surgeon or mission medical rules.

## References

- NASA MR092L — space radiation limits.
- NASA MEDB 5.2 — cardiovascular and metabolic monitoring.
- NASA EVA contingency medical protocols.

Built for the NASA Space Apps Challenge.
