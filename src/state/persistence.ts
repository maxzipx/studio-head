import AsyncStorage from '@react-native-async-storage/async-storage';

import { StudioManager } from '@/src/domain/studio-manager';

const SAVE_KEY = 'pg.save.v1';
const SAVE_VERSION = 1;

interface SaveEnvelope {
  version: number;
  savedAt: string;
  manager: StudioManager;
}

function restoreStudioManager(input: StudioManager): StudioManager {
  const manager = new StudioManager();
  Object.assign(manager, input);
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
