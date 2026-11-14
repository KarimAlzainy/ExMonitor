import { CrewProfile } from '../types/telemetry';

const PROFILE_KEY = 'exmonitor.profile.v1';

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `crew-${crypto.randomUUID()}`;
  }
  return `crew-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyProfile(): CrewProfile {
  return {
    id: makeId(),
    name: '',
    label: '',
    sensorId: null,
    notificationsAsked: false,
    createdAt: Date.now(),
    completedAt: null
  };
}

function normalize(raw: unknown): CrewProfile | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<CrewProfile>;
  if (typeof value.id !== 'string' || !value.id) return null;
  return {
    id: value.id,
    name: typeof value.name === 'string' ? value.name : '',
    label: typeof value.label === 'string' ? value.label : '',
    sensorId: typeof value.sensorId === 'string' && value.sensorId ? value.sensorId : null,
    notificationsAsked: Boolean(value.notificationsAsked),
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
    completedAt: typeof value.completedAt === 'number' ? value.completedAt : null
  };
}

export function loadProfile(): CrewProfile | null {
  try {
    const stored = window.localStorage.getItem(PROFILE_KEY);
    if (!stored) return null;
    return normalize(JSON.parse(stored));
  } catch {
    return null;
  }
}

export function saveProfile(profile: CrewProfile): void {
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Private browsing or a full quota should not break the console.
  }
}

export function clearProfile(): void {
  try {
    window.localStorage.removeItem(PROFILE_KEY);
  } catch {
    // Ignore.
  }
}

export function isSetupComplete(profile: CrewProfile | null): profile is CrewProfile {
  return Boolean(profile && profile.name.trim() && profile.label.trim() && profile.completedAt);
}

export function profileFromParts(
  base: CrewProfile,
  parts: { name: string; label: string; sensorId?: string | null; notificationsAsked?: boolean }
): CrewProfile {
  return {
    ...base,
    name: parts.name.trim(),
    label: parts.label.trim(),
    sensorId:
      parts.sensorId === undefined
        ? base.sensorId
        : parts.sensorId
          ? parts.sensorId.trim().toUpperCase()
          : null,
    notificationsAsked: parts.notificationsAsked ?? base.notificationsAsked
  };
}
