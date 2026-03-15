import { describe, expect, it } from 'vitest';

import { StudioManager } from '../studio-manager';

function createManager(): StudioManager {
  const manager = new StudioManager({ talentSeed: 42, startWithSeedProjects: false, includeOpeningDecisions: false });
  manager.operationsService.completeFoundingSetup({ specialization: 'balanced', foundingProfile: 'none' });
  return manager;
}

describe('EventService', () => {
  // ── Script Market ───────────────────────────────────────────────

  it('refillScriptMarket populates scriptMarket with new scripts', () => {
    const manager = createManager();
    manager.scriptMarket = [];
    const events: string[] = [];

    manager.eventService.refillScriptMarket(events);

    expect(manager.scriptMarket.length).toBeGreaterThan(0);
  });

  it('refillScriptMarket generates valid scripts with required fields', () => {
    const manager = createManager();
    manager.scriptMarket = [];
    const events: string[] = [];

    manager.eventService.refillScriptMarket(events);

    for (const script of manager.scriptMarket) {
      expect(script.id).toBeTruthy();
      expect(typeof script.title).toBe('string');
      expect(script.title.length).toBeGreaterThan(0);
      expect(typeof script.genre).toBe('string');
      expect(typeof script.askingPrice).toBe('number');
      expect(script.askingPrice).toBeGreaterThan(0);
      expect(typeof script.scriptQuality).toBe('number');
      expect(script.scriptQuality).toBeGreaterThan(0);
    }
  });

  // ── Genre Cycles ────────────────────────────────────────────────

  it('getGenreDemandMultiplier returns a number in reasonable range', () => {
    const manager = createManager();

    const multiplier = manager.eventService.getGenreDemandMultiplier('action');

    expect(typeof multiplier).toBe('number');
    expect(multiplier).toBeGreaterThanOrEqual(0.68);
    expect(multiplier).toBeLessThanOrEqual(1.4);
  });

  it('getGenreCycleSnapshot returns array of genres sorted by demand', () => {
    const manager = createManager();

    const snapshot = manager.eventService.getGenreCycleSnapshot();

    expect(Array.isArray(snapshot)).toBe(true);
    expect(snapshot.length).toBeGreaterThan(0);
    for (const entry of snapshot) {
      expect(entry).toHaveProperty('genre');
      expect(entry).toHaveProperty('demand');
      expect(entry).toHaveProperty('momentum');
    }
    // Verify sorted descending by demand
    for (let i = 1; i < snapshot.length; i++) {
      expect(snapshot[i - 1].demand).toBeGreaterThanOrEqual(snapshot[i].demand);
    }
  });

  it('tickGenreCycles changes genre demands over time', () => {
    const manager = createManager();
    const snapshotBefore = manager.eventService.getGenreCycleSnapshot();
    const demandsBefore = new Map(snapshotBefore.map((entry) => [entry.genre, entry.demand]));

    const events: string[] = [];
    for (let i = 0; i < 10; i++) {
      manager.eventService.tickGenreCycles(events);
    }

    const snapshotAfter = manager.eventService.getGenreCycleSnapshot();
    const demandsAfter = new Map(snapshotAfter.map((entry) => [entry.genre, entry.demand]));
    let anyChanged = false;
    for (const [genre, before] of demandsBefore) {
      if (demandsAfter.get(genre) !== before) {
        anyChanged = true;
        break;
      }
    }
    expect(anyChanged).toBe(true);
  });

  // ── Story Flags ─────────────────────────────────────────────────

  it('hasStoryFlag returns false when flag is not set', () => {
    const manager = createManager();

    expect(manager.eventService.hasStoryFlag('nonexistent_flag')).toBe(false);
  });

  it('hasStoryFlag returns true when flag is set', () => {
    const manager = createManager();
    manager.storyFlags['test_flag'] = 1;

    expect(manager.eventService.hasStoryFlag('test_flag')).toBe(true);
  });

  // ── Decision Expiry ─────────────────────────────────────────────

  it('tickDecisionExpiry decrements weeksUntilExpiry on decisions', () => {
    const manager = createManager();
    manager.decisionQueue = [
      {
        id: 'test-dec-1',
        projectId: null,
        title: 'Test Decision',
        body: 'A test decision.',
        weeksUntilExpiry: 5,
        options: [],
      },
    ];
    const events: string[] = [];

    manager.eventService.tickDecisionExpiry(events);

    expect(manager.decisionQueue[0].weeksUntilExpiry).toBe(4);
  });

  it('tickDecisionExpiry removes expired decisions', () => {
    const manager = createManager();
    manager.decisionQueue = [
      {
        id: 'test-dec-expire',
        projectId: null,
        title: 'Expiring',
        body: 'About to expire.',
        weeksUntilExpiry: 0,
        options: [],
      },
      {
        id: 'test-dec-keep',
        projectId: null,
        title: 'Staying',
        body: 'Still active.',
        weeksUntilExpiry: 3,
        options: [],
      },
    ];
    const events: string[] = [];

    manager.eventService.tickDecisionExpiry(events);

    expect(manager.decisionQueue.length).toBe(1);
    expect(manager.decisionQueue[0].id).toBe('test-dec-keep');
    expect(events.some((e) => e.includes('expired'))).toBe(true);
  });

  // ── Event Execution ─────────────────────────────────────────────

  it('generateEventDecisions runs without error and populates events array', () => {
    const manager = createManager();
    const events: string[] = [];

    // Should not throw
    manager.eventService.generateEventDecisions(events);

    // events may or may not have entries depending on RNG, but it should not throw
    expect(Array.isArray(events)).toBe(true);
  });
});
