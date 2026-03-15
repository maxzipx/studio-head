import { describe, expect, it } from 'vitest';

import { restoreStudioManager } from './persistence';

describe('persistence sanitizers via restoreStudioManager', () => {
  it('restores a minimal valid save with currentWeek and cash', () => {
    const manager = restoreStudioManager({ currentWeek: 10, cash: 30_000_000 });
    expect(manager.currentWeek).toBe(10);
    expect(manager.cash).toBe(30_000_000);
  });

  it('handles missing studioName by applying default', () => {
    const manager = restoreStudioManager({ currentWeek: 1, cash: 50_000_000 });
    expect(typeof manager.studioName).toBe('string');
    expect(manager.studioName.length).toBeGreaterThan(0);
  });

  it('handles non-finite cash by applying default', () => {
    const manager = restoreStudioManager({ currentWeek: 1, cash: NaN });
    expect(Number.isFinite(manager.cash)).toBe(true);
    expect(manager.cash).toBeGreaterThan(0);
  });

  it('handles missing reputation by applying defaults', () => {
    const manager = restoreStudioManager({ currentWeek: 1, cash: 50_000_000 });
    expect(manager.reputation).toBeDefined();
    expect(Number.isFinite(manager.reputation.critics)).toBe(true);
    expect(Number.isFinite(manager.reputation.talent)).toBe(true);
    expect(Number.isFinite(manager.reputation.distributor)).toBe(true);
    expect(Number.isFinite(manager.reputation.audience)).toBe(true);
  });

  it('handles legacy studioHeat field by converting to reputation pillars', () => {
    const manager = restoreStudioManager({ currentWeek: 5, cash: 40_000_000, studioHeat: 75 });
    expect(manager.reputation.critics).toBe(75);
    expect(manager.reputation.talent).toBe(75);
    expect(manager.reputation.distributor).toBe(75);
    expect(manager.reputation.audience).toBe(75);
  });

  it('handles missing tutorialState on old save by setting to complete', () => {
    const manager = restoreStudioManager({ currentWeek: 20, cash: 50_000_000 });
    expect(manager.tutorialState).toBe('complete');
    expect(manager.tutorialCompleted).toBe(true);
  });

  it('handles invalid specialization by defaulting to balanced', () => {
    const manager = restoreStudioManager({ currentWeek: 1, cash: 50_000_000, studioSpecialization: 'garbage' as any });
    expect(manager.studioSpecialization).toBe('balanced');
  });

  it('handles missing departmentLevels by providing zeros', () => {
    const manager = restoreStudioManager({ currentWeek: 1, cash: 50_000_000 });
    expect(manager.departmentLevels).toEqual({ development: 0, production: 0, distribution: 0 });
  });

  it('clamps reputation values to 0-100', () => {
    const manager = restoreStudioManager({
      currentWeek: 1,
      cash: 50_000_000,
      reputation: { critics: 150, talent: -20, distributor: 50, audience: 999 },
    });
    expect(manager.reputation.critics).toBeLessThanOrEqual(100);
    expect(manager.reputation.talent).toBeGreaterThanOrEqual(0);
    expect(manager.reputation.distributor).toBe(50);
    expect(manager.reputation.audience).toBeLessThanOrEqual(100);
  });

  it('handles missing/invalid decisionQueue by providing defaults', () => {
    const manager = restoreStudioManager({ currentWeek: 1, cash: 50_000_000, decisionQueue: 'not-an-array' as any });
    expect(Array.isArray(manager.decisionQueue)).toBe(true);
  });
});
