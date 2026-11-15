/**
 * Tiny helper so the onboarding screen can ask the console to start the
 * built-in demo as soon as it mounts. This is only a one-shot flag in
 * localStorage and never leaves the device.
 */
const PENDING_KEY = 'exmonitor.demo.pending';

export function requestDemoAutostart(): void {
  try {
    window.localStorage.setItem(PENDING_KEY, '1');
  } catch {
    // Ignore.
  }
}

export function consumeDemoAutostart(): boolean {
  try {
    if (window.localStorage.getItem(PENDING_KEY) === '1') {
      window.localStorage.removeItem(PENDING_KEY);
      return true;
    }
  } catch {
    // Ignore.
  }
  return false;
}
