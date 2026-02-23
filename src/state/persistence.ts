import AsyncStorage from '@react-native-async-storage/async-storage';

import { StudioManager } from '../domain/studio-manager';

const SAVE_KEY = 'pg.save.v1';
const SAVE_VERSION = 1;

interface SaveEnvelope {
  version: number;
  savedAt: string;
  manager: StudioManager;
}

const RESTORE_BLOCKED_KEYS = new Set([
  'crisisRng',
  'eventRng',
  'negotiationRng',
  'rivalRng',
  'eventDeck',
  'lastEventWeek',
]);

export function restoreStudioManager(input: StudioManager): StudioManager {
  const manager = new StudioManager();
  for (const [key, value] of Object.entries(input as unknown as Record<string, unknown>)) {
    if (RESTORE_BLOCKED_KEYS.has(key)) continue;
    (manager as unknown as Record<string, unknown>)[key] = value;
  }

  const sourceLastEventWeek = (input as unknown as { lastEventWeek?: unknown }).lastEventWeek;
  const targetLastEventWeek = (manager as unknown as { lastEventWeek: Map<string, number> }).lastEventWeek;

  if (Array.isArray(sourceLastEventWeek)) {
    for (const entry of sourceLastEventWeek) {
      if (!Array.isArray(entry) || entry.length !== 2) continue;
      if (typeof entry[0] !== 'string' || typeof entry[1] !== 'number') continue;
      targetLastEventWeek.set(entry[0], entry[1]);
    }
  } else if (sourceLastEventWeek && typeof sourceLastEventWeek === 'object') {
    for (const [eventId, week] of Object.entries(sourceLastEventWeek)) {
      if (typeof week === 'number') {
        targetLastEventWeek.set(eventId, week);
      }
    }
  }

  return manager;
}

export async function loadManagerFromStorage(): Promise<StudioManager | null> {
  const raw = await AsyncStorage.getItem(SAVE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as SaveEnvelope;
    if (!parsed || parsed.version !== SAVE_VERSION || !parsed.manager) return null;
    return restoreStudioManager(parsed.manager);
  } catch {
    return null;
  }
}

export async function saveManagerToStorage(manager: StudioManager): Promise<void> {
  const envelope: SaveEnvelope = {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    manager,
  };
  await AsyncStorage.setItem(SAVE_KEY, JSON.stringify(envelope));
}
