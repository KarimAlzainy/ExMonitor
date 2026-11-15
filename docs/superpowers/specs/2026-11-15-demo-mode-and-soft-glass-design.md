# Demo mode, sensor fixes, and soft-glass UI

Date: 2026-11-15
Status: awaiting approval

## Intent

Three linked changes to ExMonitor:

1. A one-tap **Start Demo** on the Live readings tab that runs a scripted
   body-sensor simulation through low, high, and critical states, with crew
   alerts, so a presenter never has to pair a second device.
2. Fix the reported bug where changing the situation on the sensor page does
   not move the console: no color change, no alert.
3. Move the UI toward a **soft glass** look, applied to surfaces only — no
   layout or structural change, and no change to the dark palette.

Audience: astronauts and demo presenters in a training simulation. The UI
must stay glanceable under stress.

## Goals

- One tap starts the demo; a short brief sits beside the button.
- Demo uses the real `SensorEngine`, so ECG, vitals, radiation, rules, and
  alerts all react exactly as they would with a paired sensor.
- Demo alternates normal, warning, and critical measurements and fires crew
  alerts at the critical moments.
- Demo is controllable: visible step, progress, pause/resume, stop, and a clean
  return to nominal at the end.
- Choosing a scenario on the sensor page drives a console that has no paired
  sensor yet, with no scanning step.
- Sensor page readouts show severity color.
- Panels get a restrained frosted-glass treatment.

## Non-goals (anti-goals)

- No light mode, no new palette, no change to `space` / `ink` / `chalk`
  values.
- No layout restructure: same tabs, same section order, same nav.
- No floating/neumorphic overhaul, no large whitespace redesign. Glass is a
  surface change, not a redesign.
- No change to the NASA rule thresholds or action-card text.
- No new third-party dependencies, no AI model downloads.
- Demo must not require the WebSocket relay. It must work fully offline.

## Constraints

- React 18 + Vite + Tailwind 3, TypeScript strict build (`npm run build`).
- `prefers-reduced-motion` must disable new animation.
- Existing multi-device pairing, alerts, and presence must keep working.
- No horizontal page scroll at any width.
- The sensor page is a separate entry (`sensors.html`); the console is `/`.

## Approaches considered

### Demo delivery

- **A. In-console virtual sensor (chosen).** A demo runner uses `SensorEngine`
  and pushes frames through the same state path as a relay frame. No extra tab,
  no popups, works offline.
- **B. Open the sensor page in a new tab with `?demo=1`.** Literally runs the
  sensor page, but popup blocking and hidden tabs make it fragile; the console
  still needs pairing.
- **C. Relay-driven scripted sensor.** A fake sensor client on the relay. Most
  realistic, but requires the relay and a second process.

### Glass treatment

- **Overlay-only utility classes** applied to existing card containers
  (chosen): one `.glass` utility plus small variants, so the change is
  reviewable and reversible.
- Global token swap: replace `bg-space-900` everywhere. Faster to apply, but
  blurs the "surfaces only" constraint and risks low contrast in odd places.

## The design

### 1. Demo runner

New `src/services/demoRunner.ts` exporting a timeline and a factory. It owns a
`SensorEngine` with the fixed id `DEMO-01` and steps through this script:

| # | Label | Scenario | Hold | Expected |
|---|-------|----------|------|----------|
| 1 | Baseline | rest | 6 s | nominal (green) |
| 2 | Exercise | exercise | 12 s | caution (amber) |
| 3 | Cooling down | rest | 8 s | nominal |
| 4 | Low oxygen | hypoxia | 15 s | critical (red) + crew alert |
| 5 | Recovering | rest | 10 s | nominal |
| 6 | Radiation storm | radiation | 12 s | critical (red) + crew alert |
| 7 | Back to normal | rest | 10 s | nominal, then stop |

The holds above are the minimum needed for the stock engine's time constants
to cross the real rule thresholds: hypoxia takes ~11 s to fall below 88 %,
and radiation needs ~18 s to fall below 0.30 mSv/hr again. The demo uses
`rest` — not `recovery` — for the settling steps because `recovery` holds
radiation at 0.35 mSv/hr, which the rules classify as caution. Expected
severity in the table is acceptance; the runner may pre-settle (fast-forward)
the final step so the demo ends nominal, and may lengthen a hold, but must not
change `nasaRules.ts` thresholds or the engine's public targets.

The runner ticks at 8 Hz and produces the same `SensorFrame` shape as the
sensor page (ECG and PPG included). It is transport-free: frames go straight
into telemetry state, never onto the crew link.

`TelemetryContext` gains:

- an extracted `applySensorFrame(frame)` used by both the relay listener and
  the demo;
- `demo` state: `{ running, paused, stepIndex, stepCount, label, progress }`;
- `startDemo()`, `pauseDemo()`, `resumeDemo()`, `stopDemo()`;
- guards so the built-in practice generator and the 2 s staleness timer stand
  down while the demo is active, and `sensorStatus` reads `connected`.

The demo sets `vitals.source = 'sensor'` so every existing consumer behaves as
if a real sensor were streaming. Optional: if the sensor page is open in the
same browser, mirror the step label to it over `BroadcastChannel`; not required
for acceptance.

### 2. Alerts during the demo

The existing `isTriggerEmergency` path already calls `triggerEmergencySOS`, so
hypoxia and radiation raise an alert without new logic. Two adjustments:

- The demo cancels its previous alert about 8 s after it fires, so the second
  critical step can raise a new one (the sender refuses a new alert while one
  is active).
- On the first critical step, the console also shows the receiver-style
  full-screen overlay once, clearly labelled "Demo — this is what other crew
  see", with an Acknowledge button. This makes the single-screen demo show the
  whole alert experience. It is demo-only and never changes the sender state.

### 3. Sensor discovery fix

In `TelemetryContext`, `SENSOR_HELLO` currently only answers when
`profile.sensorId` already matches. Change it to also adopt when no sensor is
paired:

- if `profile.sensorId` is null, adopt the announcing `sensorId`, set
  `sensorStatus = 'waiting'`, and send `SENSOR_PAIR`;
- ignore further adoption for 10 s after the first adopt to avoid thrashing
  when several sensors announce;
- Settings' explicit scan still wins and can replace the adopted sensor.

This makes "open sensor page → pick Radiation storm → console turns red"
work without scanning. Console shows a one-line notice that it adopted a
sensor, with a link to Settings.

### 4. Sensor page severity color

Export small severity helpers from `nasaRules.ts` (or reuse
`evaluateBiometrics` on a constructed `VitalsData`) and color the five metric
cards the same way the console's `VitalCard` does: nominal = neutral ink,
caution = amber, critical = red. Also tint the selected scenario card by its
expected severity, and add a status line above the readouts ("Normal",
"Watch", "Critical") so the page itself tells the story.

### 5. Soft glass surfaces

Add to `src/index.css`:

- `.glass`: translucent panel — `bg-white/[0.045]`, hairline
  `border-white/[0.09]`, `backdrop-blur-xl`, a 1px inset top highlight, and a
  soft outer shadow.
- `.glass-strong`: for the sticky header and overlays.
- `.glass-tint-<tone>` variants that keep a status tint (critical/caution)
  while adding the same blur.

Then swap the card container classes across Dashboard, AI, Settings, Guide,
Sensor page, Setup wizard, header, and overlays. Keep every color and every
size; change only surface, border, radius (to 18–20 px), blur, and shadow.

Add a fixed, very low-opacity ambient glow behind the page and keep the ECG's
grid. The chalk "What to do now" panel stays solid (contrast), optionally with
a faint top-to-bottom gradient.

Motion: 150–200 ms value color transitions, 2 px hover lift on interactive
cards, and a fade for alert entry. All suppressed by reduced-motion.

## Acceptance

- Start Demo appears at the top of Live readings with a one-sentence brief.
- One tap starts it; vitals, ECG, vital colors, status hero, and radiation card
  all react; pause/resume/stop work; it ends at nominal.
- Critical steps raise a crew alert, and the demo recovers so a later critical
  step can raise another.
- Opening the sensor page, choosing Radiation storm with no prior pairing
  turns the console critical and raises an alert.
- Sensor page values are color-coded by severity.
- Panels look frosted but the layout, palette, and information order are
  unchanged.
- `npm run build` passes; no console errors; no horizontal scroll at 800 px and
  at laptop widths.

## Builder check resolutions

These were the open points a reviewer raised. Each is settled here as the
builder's call:

- **Demo is exclusive while running.** Starting the demo pauses live-sensor
  frames and sensor auto-adoption. The relay listener keeps its
  `frame.sensorId === profile.sensorId` guard; the demo calls the shared
  `applySensorFrame(frame, 'demo')` which bypasses that guard. When the demo
  stops, live frames and adoption resume.
- **Overlay is demo-only.** Add a dedicated `demoAlert` state and a
  demo-labelled variant of the receiver overlay. Acknowledge clears only that
  state; it never broadcasts `ACKNOWLEDGE_EMERGENCY`. The demo klaxon is
  allowed because it is local audio, not transport.
- **Alert reuse uses existing calls.** After ~8 s the demo calls
  `cancelOwnAlert()` then `dismissOwnAlert()`. The settling step drops
  `isTriggerEmergency` to false, which resets `autoSosRef`, so the second
  critical step can raise a new alert. No change to the alert guards.
- **Stop is total.** Stop cancels/clears the demo alert, dismisses the demo
  overlay, resets vitals to the built-in baseline, restores `sensorStatus` to
  `waiting`/`off` from pairing, and lets the practice generator resume.
- **Severity helpers are shared.** New `src/services/severity.ts` exports the
  per-vital helpers (including radiation: `>= 1.0` critical, `>= 0.3`
  caution). `DashboardTab`, `RadiationHazardBadge`, and the sensor page use
  them. Only the five core vitals are color-coded on the sensor page (heart
  rate, SpO2, temperature, stress, radiation dose); total dose, signal
  quality, and battery stay neutral.
- **Glass keeps the tint.** Status-tinted panels become `glass-tint-caution` /
  `glass-tint-critical`, preserving the same hue and tint opacity over the
  frosted base. "Keep every color" means semantic colors are preserved; only
  the neutral surface base becomes translucent white.

## Left to the builder

- Exact glass opacities, blur radius, radii, and shadow values.
- Whether the demo mirrors to an open sensor page.
- Whether the adoption notice is a dismissible banner or an inline line.