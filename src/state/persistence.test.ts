import { describe, expect, it, vi } from 'vitest';
import { StudioManager } from '../domain/studio-manager';
import { restoreStudioManager, serializeStudioManager } from './persistence';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => {}),
  },
}));

describe('persistence restore', () => {
  it('omits heavyweight runtime-only fields from serialized save payload', () => {
    const manager = new StudioManager();
    const serialized = serializeStudioManager(manager);

    expect(Object.hasOwn(serialized, 'eventDeck')).toBe(false);
    expect(Object.hasOwn(serialized, 'crisisRng')).toBe(false);
    expect(Object.hasOwn(serialized, 'eventRng')).toBe(false);
    expect(Object.hasOwn(serialized, 'negotiationRng')).toBe(false);
    expect(Object.hasOwn(serialized, 'rivalRng')).toBe(false);
  });

  it('stores lastEventWeek map as serializable entries', () => {
    const manager = new StudioManager();
    const lastEventWeek = (manager as unknown as { lastEventWeek: Map<string, number> }).lastEventWeek;
    lastEventWeek.set('arc-test', 8);

    const serialized = serializeStudioManager(manager);

    expect(Array.isArray(serialized.lastEventWeek)).toBe(true);
    expect(serialized.lastEventWeek).toContainEqual(['arc-test', 8]);
  });

  it('preserves runtime map behavior after JSON snapshot hydration', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0.2 });
    const snapshot = JSON.parse(JSON.stringify(serializeStudioManager(manager))) as ReturnType<typeof serializeStudioManager>;

    const restored = restoreStudioManager(snapshot);

    expect(() => restored.endWeek()).not.toThrow();
  });

  it('normalizes invalid turn length while preserving valid values', () => {
    const manager = new StudioManager();
    manager.turnLengthWeeks = 2;
    const validSnapshot = JSON.parse(JSON.stringify(serializeStudioManager(manager))) as ReturnType<typeof serializeStudioManager>;
    const validRestored = restoreStudioManager(validSnapshot);
    expect(validRestored.turnLengthWeeks).toBe(2);

    const invalidSnapshot = {
      ...validSnapshot,
      turnLengthWeeks: 7,
    } as ReturnType<typeof serializeStudioManager>;
    const invalidRestored = restoreStudioManager(invalidSnapshot);
    expect(invalidRestored.turnLengthWeeks).toBe(1);
  });

  it('backfills and normalizes editorial fields on restored projects', () => {
    const manager = new StudioManager();
    const snapshot = JSON.parse(JSON.stringify(serializeStudioManager(manager))) as ReturnType<typeof serializeStudioManager>;

    const firstProject = (snapshot.activeProjects as Record<string, unknown>[])[0];
    delete firstProject.editorialScore;
    firstProject.postPolishPasses = 9;

    const restored = restoreStudioManager(snapshot);
    const project = restored.activeProjects[0];
    expect(project.editorialScore).toBe(5);
    expect(project.postPolishPasses).toBe(2);
  });
});
