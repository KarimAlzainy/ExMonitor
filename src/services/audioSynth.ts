/**
 * Web Audio API Synthesizer for NASA Sound FX
 * Works 100% offline without external audio files.
 */
class AerospaceAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private isAlarmPlaying: boolean = false;
  private alarmInterval: number | null = null;
  private muted: boolean = false;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (muted && this.isAlarmPlaying) {
      this.stopEmergencyKlaxon();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  /**
   * Subtle clinical pulse monitor blip (simulating hospital/spacecraft ECG pulse)
   */
  public playHeartbeatBlip(frequency = 880) {
    if (this.muted) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(frequency * 0.6, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch {
      // AudioContext policy suppression
    }
  }

  /**
   * Aerospace telemetry confirmation chirp
   */
  public playTelemetryPing() {
    if (this.muted) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.setValueAtTime(1800, ctx.currentTime + 0.06);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    } catch {
      // Ignore
    }
  }

  /**
   * NASA Spacecraft Master Alarm / Emergency Klaxon
   * Oscillating two-tone warble (900 Hz to 1400 Hz) that repeats until stopped.
   */
  public startEmergencyKlaxon() {
    if (this.muted || this.isAlarmPlaying) return;
    this.isAlarmPlaying = true;

    const playCycle = () => {
      try {
        const ctx = this.getContext();
        if (!ctx) return;

        // Tone 1: High alert pulse
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(950, ctx.currentTime);
        osc1.frequency.linearRampToValueAtTime(1350, ctx.currentTime + 0.25);
        gain1.gain.setValueAtTime(0.25, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.28);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start();
        osc1.stop(ctx.currentTime + 0.29);

        // Tone 2: Descending return pulse
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(1350, ctx.currentTime + 0.3);
        osc2.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.55);
        gain2.gain.setValueAtTime(0.2, ctx.currentTime + 0.3);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.58);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(ctx.currentTime + 0.3);
        osc2.stop(ctx.currentTime + 0.59);
      } catch {
        // Ignore
      }
    };

    playCycle();
    this.alarmInterval = window.setInterval(playCycle, 650);
  }

  public stopEmergencyKlaxon() {
    this.isAlarmPlaying = false;
    if (this.alarmInterval !== null) {
      clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
  }

  public isAlarmActive(): boolean {
    return this.isAlarmPlaying;
  }
}

export const audioSynth = new AerospaceAudioSynthesizer();
