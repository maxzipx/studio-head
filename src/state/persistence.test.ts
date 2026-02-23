import { describe, expect, it, vi } from 'vitest';
import { StudioManager } from '../domain/studio-manager';
import { restoreStudioManager } from './persistence';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => {}),
  },
}));

describe('persistence restore', () => {
  it('preserves runtime map behavior after JSON snapshot hydration', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0.2 });
    const snapshot = JSON.parse(JSON.stringify(manager)) as StudioManager;

    const restored = restoreStudioManager(snapshot);

    expect(() => restored.endWeek()).not.toThrow();
  });
});
