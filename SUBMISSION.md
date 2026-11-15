# Submission pack

Copy-paste text for the 2026 NASA Space Apps Challenge submission. Field names on the portal change from year
to year; each block below is labelled so you can match it to the closest field. Anything in `[square brackets]`
is the only thing a human must fill in — it cannot be derived from the repository.

## Fill these in first

- **Team name:** `[your team name]`
- **Challenge:** `[paste the exact challenge title from the Space Apps site]`
- **Team members:** `[names, roles, links]`
- **Video link:** `[YouTube / Vimeo URL, public or unlisted-but-linked]`
- **Repository:** <https://github.com/KarimAlzainy/ExMonitor>
- **Live app:** <https://exmonitor.extem.net/app/>
- **Download page:** <https://exmonitor.extem.net/>

## One-line pitch

A crew health console that turns any browser into a mission medical station — simulated vitals, written safety
rules, an on-device AI assistant and crew alerts — and works with no account, no cloud and no network.

## Short description (about 100 words)

ExMonitor is a training simulator for crew health on long missions. A phone becomes a pretend body sensor; a
laptop becomes the console with a live heart trace, five vital cards and a radiation dose bar. A deterministic
rules engine marks every reading normal, watch or critical, and can raise a crew alert that every connected
console must acknowledge. A language model runs entirely in the browser (or against a local Ollama server) so
the assistant still answers offline. A written action-card mode needs no model at all. One button, **Start
Demo**, runs the whole story on a single device in about 40 seconds.

## Long description

**The problem.** Long-duration crews depend on ground support for medical interpretation. Communication delay
grows with distance, and a crew cannot always wait for a reply. Training tools that show how a console, a
written procedure and an alert actually behave together are useful — but they are usually tied to a lab, a
server or a licence.

**What ExMonitor does.** It splits the job into three pieces that can run on hardware people already have:

- A **console** with an ECG trace, heart rate, blood oxygen, body temperature, skin-conductance stress and
  radiation dose rate. Every value is labelled with the written rule that produced its status.
- A **sensor page** that turns a phone or second screen into a simulated sensor. It streams realistic readings
  eight times a second and cycles rest, exercise, low oxygen, radiation storm and recovery.
- A **crew link** that carries alerts, presence and sensor frames over a small WebSocket relay on the local
  network, or between two tabs with no relay at all.

The **rules engine is deterministic and instant**: it classifies each reading and returns a hazard, a
recommended action and a short guidance label. The optional AI assistant sits above it in two modes. Doctor mode
attaches the current readings to the question; assistant mode is plain chat. Answers come from a model running
on the device through WebLLM and WebGPU — no prompt leaves the machine — or from a model the user already runs
with Ollama. Choosing **No AI** keeps the written action cards, which work on every device and need no download.

**Why it is different.** The demo needs no setup: **Start Demo** drives a sensor inside the console, so a judge
sees the full cycle, including the alert, on one laptop with the network off. The project is also explicit about
what it is not: the readings are simulated, the thresholds are teaching values, the assistant can be wrong, and
the only NASA figure in the app is the 600 mSv career dose limit from NASA-STD-3001 Volume 1, Revision C.

**Status.** Working prototype. Runs as a static build from a folder, as a local launcher with a relay, and as a
hosted copy with a Cloudflare Durable Object relay. Twelve downloadable ZIPs cover three AI choices plus No AI
on Windows, macOS and Linux.

## How it works

1. The sensor page generates a plausible signal (ECG, pulse wave and five derived vitals) and broadcasts frames
   on a shared relay client.
2. The console's telemetry provider validates each frame, filters it by sensor code and stores the readings.
3. A deterministic rules engine classifies the readings and returns a status, a hazard, an action and a
   guidance label.
4. Critical readings can raise a crew alert automatically; the sender can cancel it, and every receiving
   console must acknowledge it.
5. The assistant composes a prompt from the mode and the current readings, then streams an answer from WebLLM or
   Ollama, or falls back to the written action cards.

## Built with

React 18, TypeScript, Vite, Tailwind CSS, WebLLM with WebGPU, the Web Audio API, WebSocket and BroadcastChannel,
a PWA service worker, a zero-dependency Node.js launcher, Cloudflare Workers and Durable Objects, and the
`qrcode` package. Fonts are IBM Plex Sans and IBM Plex Mono. Icons are Lucide. Full licences are in
[CREDITS.md](CREDITS.md).

## Data sources and references

- **NASA-STD-3001 Volume 1, Revision C** — 600 mSv career effective-dose limit and 250 mSv per solar particle
  event, published at <https://www.nasa.gov/reference/4-0-human-performance> (sections 4.8, [V1 4030] and
  [V1 4031]).
- No other NASA document, dataset, image or API is used. All vitals, waveforms and radiation readings are
  generated locally by the simulation.
- The NASA Space Apps Challenge name belongs to NASA. This project uses no NASA logo, meatball, flag or mission
  patch, and is not endorsed by NASA.

## Honesty and limitations (paste this too)

ExMonitor is a training simulation, not a medical device. It reads no real sensor and gives no medical advice.
Alert thresholds are teaching values chosen for the simulation; they are not operational flight rules. The AI
assistant can produce wrong answers, and the written action cards stay available when it does. The project was
built with heavy AI assistance: most code and copy were produced in a pair-programming loop with an AI coding
agent, reviewed and tested by the author.

## Repository description (for GitHub)

> Offline-first crew health console for a training simulation: pretend sensor page, written safety rules,
> on-device AI assistant and crew alerts. Press Start Demo. Built with AI assistance. Not a medical device.

## Repository topics

```
space-apps  nasa  crew-health  spaceflight  simulation  react  typescript  webgpu  webllm  ollama
offline-first  pwa  tailwindcss  vite  cloudflare-workers  durable-objects  websocket
```

## 7-slide deck

| # | Slide | What is on it | What you say |
| --- | --- | --- | --- |
| 1 | **ExMonitor** | Name, one-line pitch, one console screenshot | "A crew health console that runs in a browser and works offline." |
| 2 | **The gap** | Two short quotes: communication delay grows with distance; crews cannot always wait for a reply | "Training tools for crew medical response are usually tied to a lab or a server. We wanted one that fits on the hardware a team already has." |
| 3 | **Live demo** | `docs/console-demo.png` and `docs/crew-alert.png` | "One button runs a simulated sensor inside the console: rest, exercise, low oxygen, radiation storm, recovery. The alert fires during low oxygen." |
| 4 | **How it fits together** | The five architecture lines from the README, drawn as a simple flow | "Sensor frames go through one provider, into a deterministic rules engine, then to the UI and the crew link. The AI sits above the rules, never below them." |
| 5 | **Offline by design** | Three chips: No AI / on-device WebLLM / local Ollama. A crossed-out cloud | "No account, no cloud. The model runs in the browser or on your own machine, and the written cards work with nothing installed." |
| 6 | **Honest about limits** | "Simulated readings · teaching thresholds · AI can be wrong · not a medical device" | "We removed every document number we could not verify. The only NASA figure left is a real one: the 600 mSv career limit." |
| 7 | **Try it** | Live URL, download URL, repo URL, QR code | "Open the link, press Start Demo. The runbook is in the repo." |

## 30-second video script

**0:00–0:03 — Hook.** Screen recording, console at rest.
> "What if a crew health console worked with no network at all?"

**0:03–0:09 — One tap.** Click **Start Demo**. Banner changes to Exercise.
> "One button runs a simulated sensor inside the console: rest, exercise…"

**0:09–0:17 — Alert.** Wait for Low oxygen. The sender panel appears.
> "…low oxygen. Blood oxygen drops below the critical line, and the console raises a crew alert."

**0:17–0:23 — Radiation and recovery.** Cut to the Radiation card, then the recovering trace.
> "A radiation storm pushes the dose rate up. Then the crew recovers, and every reading settles."

**0:23–0:30 — Close.** Cut to the settings screen showing No AI / on-device / Ollama, then the title card.
> "Rules run instantly. The AI runs on your device, or not at all. ExMonitor — simulated training, not a medical
> device."

Keep the capture at 1080p, 30 fps, system audio muted, and add captions. Do not use NASA logos or music you do
not have rights to.

## Pre-submit checklist

- [ ] `npm run build` passes with no TypeScript errors.
- [ ] **Start Demo** was run on a machine with the network disconnected, and the alert fired during low oxygen.
- [ ] The three screenshots in `docs/` match the current build (no stale UI).
- [ ] The live URL opens and shows the new footer and the Start Demo button.
- [ ] The repository is public and the default branch is the one you want judged.
- [ ] The video is uploaded, public or link-accessible, and under the challenge limit.
- [ ] Team name, challenge title, members and roles are filled in above.
- [ ] `CREDITS.md` has no missing dependency and the licence line matches your decision.
- [ ] No secret, token or `.env` file is committed (scan is clean as of commit `e6f2829`).
- [ ] No NASA logo, meatball, flag or mission patch appears anywhere.
- [ ] The submission text still says "simulated" and "not a medical device".
- [ ] You have pasted the challenge's exact title, not a paraphrase.
