# Demo Mode, Sensor Fixes, and Soft-Glass UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-tap scripted sensor demo, make the sensor page drive the console without pairing, and apply a restrained frosted-glass surface treatment.

**Architecture:** A virtual demo sensor runs inside `TelemetryContext`, using the existing `SensorEngine` and the same frame path as relay frames. Sensor adoption happens on `SENSOR_HELLO` when nothing is paired. Glass is one CSS utility applied to existing card containers; layout, palette, and order do not change.

**Tech Stack:** React 18, TypeScript, Vite 6, Tailwind 3. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-15-demo-mode-and-soft-glass-design.md`

## Global Constraints

- Do not change `tailwind.config.js` color values (`space`, `ink`, `chalk`, semantic tones).
- Do not change layout order, tab structure, or copy except the demo brief.
- Do not change `nasaRules.ts` thresholds or action-card text.
- No new dependencies. Must work offline; demo is transport-free.
- Respect `prefers-reduced-motion`.
- `npm run build` must pass; no horizontal scroll at 800 px and laptop widths.
- The repo has no test runner. Verification is `npm run build` plus browser checks with `tools.browser.evaluate`.

## Review Focus

- A real paired sensor is streaming when the demo starts: the demo must not flicker between two sources.
- Stopping the demo mid-critical-step: no stranded alert, overlay, or `connected` status.
- A second critical step must raise a new alert after the first was cleared.
- Sensor page opened with no pairing: console must adopt it, but two sensors announcing must not thrash.
- Glass over status-tinted panels: amber/red identity must survive the translucent base.

---

### Task 1: Shared severity helpers

**Files:**
- Create: `src/services/severity.ts`
- Modify: `src/components/dashboard/DashboardTab.tsx` (remove local helpers, import)
- Modify: `src/components/dashboard/RadiationHazardBadge.tsx`
- Modify: `src/sensors/SensorPage.tsx` (color five metric cards)

**Interfaces:**
- Produces: `heartRateSeverity(hr: number): AlertSeverity`, `oxygenSeverity(spo2: number): AlertSeverity`, `temperatureSeverity(c: number): AlertSeverity`, `stressSeverity(gsr: number): AlertSeverity`, `radiationSeverity(rate: number): AlertSeverity`, `severityTone(s: AlertSeverity): { text: string; dot: string; border: string }`.

- [ ] Create `severity.ts` with the five helpers (thresholds copied verbatim from `DashboardTab`/`RadiationHazardBadge`) and `severityTone`.
- [ ] Replace `DashboardTab` local helpers with imports; no behavior change.
- [ ] Sensor page: color the five core metrics with `severityTone(...).text`; add a status line (`Normal` / `Watch` / `Critical`) derived from `evaluateBiometrics`.
- [ ] Run `npm run build`.

### Task 2: Sensor auto-adoption

**Files:**
- Modify: `src/context/TelemetryContext.tsx`

**Interfaces:**
- Produces: console adopts an announcing sensor when `profile.sensorId === null`; 10 s adoption cooldown ref.

- [ ] In the `SENSOR_HELLO` branch, if no active sensor and `Date.now() - lastAdoptAtRef.current > 10000`, call `connectSensor(payload.sensorId)`; record `lastAdoptAtRef.current`.
- [ ] Guard against adopting while the demo runs (`demoActiveRef.current`).
- [ ] Run `npm run build`.

### Task 3: Demo runner and context state

**Files:**
- Create: `src/services/demoRunner.ts`
- Modify: `src/context/TelemetryContext.tsx`
- Modify: `src/types/telemetry.ts` (demo types)

**Interfaces:**
- Produces:
  - `DEMO_STEPS: DemoStep[]` with `{ scenario, label, note, seconds, critical }`.
  - `DEMO_SENSOR_ID = 'DEMO-01'`.
  - Context: `demo: DemoState`, `startDemo()`, `pauseDemo()`, `resumeDemo()`, `stopDemo()`, `demoOverlay: DemoOverlay | null`, `dismissDemoOverlay()`.
  - `DemoState = { running: boolean; paused: boolean; stepIndex: number; stepCount: number; label: string; note: string; progress: number }`.
  - Internal `applySensorFrame(frame: SensorFrame, origin: 'relay' | 'demo')`.

- [ ] Extract `applySensorFrame`; relay branch keeps the `sensorId === active` guard.
- [ ] Add `demoRunner.ts` timeline: rest 6 s, exercise 12 s, rest 8 s, hypoxia 15 s, rest 10 s, radiation 12 s, rest 10 s (last may pre-settle).
- [ ] `startDemo` creates a `SensorEngine(DEMO_SENSOR_ID)`, pre-settles to rest, starts a 125 ms interval emitting frames through `applySensorFrame(frame, 'demo')`, advances steps, and sets `demoActiveRef` synchronously.
- [ ] While `demoActiveRef.current`, the built-in generator and staleness timer return early; `sensorStatus` stays `connected`.
- [ ] On entering a critical step, after 2.5 s set `demoOverlay`; on leaving it, cancel + dismiss the sender alert so the next critical step can fire.
- [ ] `stopDemo` clears the interval, alert, overlay, resets vitals to the `INITIAL_VITALS` baseline, restores `sensorStatus` from pairing, and resumes the generator.
- [ ] `pauseDemo`/`resumeDemo` clear/restart the interval while keeping demo mode active.
- [ ] Run `npm run build`.

### Task 4: Demo UI

**Files:**
- Create: `src/components/dashboard/DemoPanel.tsx`
- Create: `src/components/dashboard/DemoAlertOverlay.tsx`
- Modify: `src/components/dashboard/DashboardTab.tsx`
- Modify: `src/App.tsx` (mount overlay)

**Interfaces:**
- Consumes: `demo`, `startDemo`, `pauseDemo`, `resumeDemo`, `stopDemo`, `demoOverlay`, `dismissDemoOverlay`.

- [ ] Idle panel at the top of DashboardTab: chalk **Start demo** button + one-sentence brief; note it runs ~75 s.
- [ ] Running panel: step `n of 7`, label, progress bar, Pause/Resume and Stop.
- [ ] Demo overlay: fixed, `z-[80]`, critical styling, title/description, Acknowledge; labelled as demo-only.
- [ ] Run `npm run build`; browser-check start → step change → stop.

### Task 5: Soft-glass surfaces

**Files:**
- Modify: `src/index.css` (`.glass`, `.glass-strong`, `.glass-tint-caution`, `.glass-tint-critical`, `.lift`)
- Modify: `src/App.tsx` (ambient glow)
- Modify: `src/components/layout/Header.tsx`
- Modify: `src/components/dashboard/*.tsx`
- Modify: `src/components/ai/AiCopilotTab.tsx`
- Modify: `src/components/setup/SettingsTab.tsx`
- Modify: `src/components/guide/GuideTab.tsx`
- Modify: `src/components/emergency/EmergencyOverlay.tsx`, `SenderAlertPanel.tsx`
- Modify: `src/sensors/SensorPage.tsx`

- [ ] Add glass utilities with 18–20 px radii, hairline borders, inset top highlight, soft shadow, `backdrop-filter: blur(18px)`.
- [ ] Swap neutral card surfaces to `glass`; status surfaces to `glass-tint-*` preserving hue/opacity.
- [ ] Header becomes `glass-strong`; add the fixed ambient glow behind the page.
- [ ] Add 150–200 ms transitions and a 2 px hover lift; disabled by reduced-motion.
- [ ] Run `npm run build`; browser-check contrast and no horizontal scroll.

### Task 6: Final verification

- [ ] `npm run build` passes.
- [ ] Browser at 800 px and 1280 px: no horizontal scroll, no console errors.
- [ ] Demo: start, all 7 steps, alerts on steps 4 and 6, pause/resume, stop returns to normal.
- [ ] Sensor page: pick Radiation storm with no pairing → console turns red and alerts.