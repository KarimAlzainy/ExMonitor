import { EmergencyEvent } from '../types/telemetry';

export type AlertPermission = NotificationPermission | 'unsupported';

export function alertPermission(): AlertPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && window.isSecureContext;
}

export async function requestAlertPermission(): Promise<AlertPermission> {
  if (!notificationsSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function persistentStorageStatus(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persisted) return false;
  try {
    return await navigator.storage.persisted();
  } catch {
    return false;
  }
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    const already = await navigator.storage.persisted?.();
    if (already) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((window.navigator as unknown as { standalone?: boolean }).standalone)
  );
}

function focusConsole(): void {
  try {
    window.focus();
  } catch {
    // Some browsers refuse programmatic focus.
  }
}

async function showWithServiceWorker(title: string, options: NotificationOptions): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker?.ready) return false;
  try {
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 1200))
    ]);
    if (!registration) return false;
    await registration.showNotification(title, options);
    return true;
  } catch {
    return false;
  }
}

function showInPage(title: string, options: NotificationOptions): boolean {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false;
  try {
    const notification = new Notification(title, options);
    notification.onclick = () => {
      focusConsole();
      notification.close();
    };
    return true;
  } catch {
    return false;
  }
}

export async function showAlertNotification(event: EmergencyEvent): Promise<boolean> {
  if (alertPermission() !== 'granted') return false;

  const title = `Emergency alert from ${event.astronautName}`;
  const options: NotificationOptions = {
    body: `${event.title}. Open Ex-Monitor to see the readings and acknowledge.`,
    tag: event.id,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    requireInteraction: true,
    silent: false
  };

  if (showInPage(title, options)) return true;
  return showWithServiceWorker(title, options);
}

export async function showTestNotification(): Promise<boolean> {
  if (alertPermission() !== 'granted') return false;
  const options: NotificationOptions = {
    body: 'Alerts from other crew devices will appear like this while Ex-Monitor is open.',
    tag: 'exmonitor-test',
    icon: '/pwa-192x192.png'
  };
  if (showInPage('Ex-Monitor alerts are on', options)) return true;
  return showWithServiceWorker('Ex-Monitor alerts are on', options);
}
