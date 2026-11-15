# ExMonitor demo runbook

A one-page script for showing ExMonitor live. It works offline, on one laptop,
with no second device, no camera and no network.

## What "Start Demo" does

The **Start Demo** button asks the console to run a sensor inside itself. It is
the same simulated sensor that the phone page uses, driven on a timer, so the
vital cards, the heart trace and the alert engine react exactly as they would to
a real sensor. It never makes a network request.

It cycles five situations, about 8 seconds each, and shows the current one on
screen above the vital cards:

| Order | Situation | What the judge sees |
| ----- | --------- | ------------------- |
| 1 | At rest | Calm heart trace, all five vital cards green |
| 2 | Exercise | Heart rate and temperature climb, skin response rises |
| 3 | Low oxygen | **Blood oxygen drops below 88 percent and the crew alert fires** |
| 4 | Radiation storm | Dose rate spikes into the critical band |
| 5 | Recovery | Readings settle back toward normal |

After the fifth situation the list repeats from the top until you press
**Stop demo**.

## The 30-second script

1. Open the console. If onboarding appears, press **Start Demo** on the first
   screen; it skips the rest of setup, keeps **No AI** (nothing downloads) and
   goes straight to live readings.
2. On the console, point at the banner: "Demo running · At rest". Say: *this is
   a simulated sensor running inside the console — no phone, no network.*
3. Wait for **Exercise**: point at the heart trace and the heart-rate card
   turning caution.
4. Wait for **Low oxygen**: the alert appears. Say: *the rules engine raised a
   critical alert and the console sent an SOS to the crew link.*
5. Explain the write-up: the alert stays until each device acknowledges it, or
   the sender cancels it.
6. Wait for **Radiation storm**: point at the radiation card and the 600 mSv
   career bar.
7. Press **Stop demo**. The banner disappears and the console goes back to
   whatever else is showing.

To restart: press **Start Demo** again. If the alert from the last run is still
open, the demo clears it on restart and replays the whole cycle, so the alert
fires again. Cancelling the alert in the sender panel also clears it on every
crew screen.

## Running it yourself

Offline, from a built copy:

```bash
npm install
npm run build
npm start
```

`npm start` prints the console address and, for each network address, the exact
sensor page URL. It opens the console in your browser.

During development:

```bash
npm run dev      # console and sensor page with hot reload
npm run relay    # optional: run the crew-link relay on its own
```

## Two-device demo (optional)

If you have a second screen or a phone on the same Wi-Fi:

1. Run `npm start` on the laptop. Note the **Sensor page** URL it prints.
2. Open that URL on the phone. The page shows its code in large text.
3. In the console, open **Settings → Scan sensor code** and scan the square, or
   type the code by hand.
4. On the phone, pick a situation. Readings stream to the console.

If the phone will not load: make sure both devices are on the same Wi-Fi or
hotspot, and that the computer firewall allows the printed port. The demo above
needs neither.

## What is real and what is not

- Every reading is simulated. This is a training simulation, not a medical
  device and not connected to any real sensor or NASA system.
- The written rules use teaching values for a training simulation. The only
  figure taken from a published NASA document is the 600 mSv career radiation
  limit (NASA-STD-3001 Volume 1, Revision C).
- The AI assistant runs on your device (WebLLM) or against your own local
  Ollama server. It can be wrong. The written action cards stay available on
  every copy and need no model at all.
