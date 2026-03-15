import { describe, expect, it } from 'vitest';
import { StudioManager } from '../studio-manager';
import type { DecisionItem, RivalStudio } from '../types';

function createManager(): StudioManager {
  const manager = new StudioManager({ talentSeed: 42, startWithSeedProjects: false, includeOpeningDecisions: false });
  manager.operationsService.completeFoundingSetup({ specialization: 'balanced', foundingProfile: 'none' });
  return manager;
}

describe('RivalAiService', () => {
  it('getRivalMemory() returns an initialized memory object', () => {
    const manager = createManager();
    const rival = manager.rivals[0];
    // Clear any pre-existing memory
    rival.memory = undefined as any;

    const memory = manager.rivalAiService.getRivalMemory(rival);

    expect(memory.hostility).toBeGreaterThanOrEqual(0);
    expect(memory.respect).toBeGreaterThanOrEqual(0);
    expect(memory.retaliationBias).toBe(50);
    expect(memory.cooperationBias).toBe(45);
    expect(Array.isArray(memory.interactionHistory)).toBe(true);
  });

  it('getRivalStance() returns stance based on hostility vs respect', () => {
    const manager = createManager();
    const rival = manager.rivals[0];

    // High hostility, low respect => 'rival'
    rival.memory = {
      hostility: 90, respect: 30,
      retaliationBias: 50, cooperationBias: 45, interactionHistory: [],
    };
    expect(manager.rivalAiService.getRivalStance(rival)).toBe('rival');

    // Low hostility, high respect => 'friendly'
    rival.memory = {
      hostility: 20, respect: 70,
      retaliationBias: 50, cooperationBias: 45, interactionHistory: [],
    };
    expect(manager.rivalAiService.getRivalStance(rival)).toBe('friendly');

    // Balanced => 'neutral'
    rival.memory = {
      hostility: 50, respect: 50,
      retaliationBias: 50, cooperationBias: 45, interactionHistory: [],
    };
    expect(manager.rivalAiService.getRivalStance(rival)).toBe('neutral');
  });

  it('recordRivalInteraction() updates hostility/respect and adds to history', () => {
    const manager = createManager();
    const rival = manager.rivals[0];
    rival.memory = {
      hostility: 50, respect: 50,
      retaliationBias: 50, cooperationBias: 45, interactionHistory: [],
    };

    manager.rivalAiService.recordRivalInteraction(rival, {
      kind: 'talentPoach',
      hostilityDelta: 10,
      respectDelta: -5,
      note: 'Poached a star actor.',
    });

    expect(rival.memory.hostility).toBe(60);
    expect(rival.memory.respect).toBe(45);
    expect(rival.memory.interactionHistory).toHaveLength(1);
    expect(rival.memory.interactionHistory[0].kind).toBe('talentPoach');
    expect(rival.memory.interactionHistory[0].note).toBe('Poached a star actor.');
  });

  it('recordRivalInteraction() clamps values to 0-100', () => {
    const manager = createManager();
    const rival = manager.rivals[0];
    rival.memory = {
      hostility: 95, respect: 5,
      retaliationBias: 90, cooperationBias: 10, interactionHistory: [],
    };

    manager.rivalAiService.recordRivalInteraction(rival, {
      kind: 'counterplayEscalation',
      hostilityDelta: 20,
      respectDelta: -20,
      note: 'Major escalation.',
    });

    expect(rival.memory.hostility).toBe(100);
    expect(rival.memory.respect).toBe(0);
    expect(rival.memory.retaliationBias).toBe(100);
    expect(rival.memory.cooperationBias).toBe(0);
  });

  it('applyRivalMemoryReversion() moves memory scores toward baseline', () => {
    const manager = createManager();
    const rival = manager.rivals[0];
    rival.memory = {
      hostility: 80, respect: 20,
      retaliationBias: 80, cooperationBias: 20, interactionHistory: [],
    };

    // Apply reversion multiple times to see movement toward baseline
    for (let i = 0; i < 20; i++) {
      manager.rivalAiService.applyRivalMemoryReversion();
    }

    // Hostility should have moved toward 50 (baseline)
    expect(rival.memory.hostility).toBeLessThan(80);
    expect(rival.memory.hostility).toBeGreaterThan(50);
    // Respect should have moved toward 50 (baseline)
    expect(rival.memory.respect).toBeGreaterThan(20);
    expect(rival.memory.respect).toBeLessThan(50);
  });

  it('applyRivalDecisionMemory() processes escalation when option has negative cashDelta', () => {
    const manager = createManager();
    const rival = manager.rivals[0];
    rival.memory = {
      hostility: 50, respect: 50,
      retaliationBias: 50, cooperationBias: 45, interactionHistory: [],
    };

    const decision: DecisionItem = {
      id: 'dec-1',
      title: `Counterplay: Tentpole Clash with ${rival.name}`,
      description: 'A rival move.',
      category: 'industry',
      options: [
        { label: 'Fight back', cashDelta: -500_000, hypeDelta: 0 },
      ],
      expiresWeek: 10,
      projectId: null,
    } as any;

    manager.rivalAiService.applyRivalDecisionMemory(decision, decision.options[0]);

    expect(rival.memory.hostility).toBe(53);
    expect(rival.memory.respect).toBe(51);
    expect(rival.memory.interactionHistory).toHaveLength(1);
    expect(rival.memory.interactionHistory[0].kind).toBe('releaseCollision');
  });

  it('applyRivalDecisionMemory() processes acceptance when option label includes "accept"', () => {
    const manager = createManager();
    const rival = manager.rivals[0];
    rival.memory = {
      hostility: 50, respect: 50,
      retaliationBias: 50, cooperationBias: 45, interactionHistory: [],
    };

    const decision: DecisionItem = {
      id: 'dec-2',
      title: `Counterplay: Awards Pressure from ${rival.name}`,
      description: 'Rival is pushing.',
      category: 'industry',
      options: [
        { label: 'Accept the loss', cashDelta: 0, hypeDelta: 0 },
      ],
      expiresWeek: 10,
      projectId: null,
    } as any;

    manager.rivalAiService.applyRivalDecisionMemory(decision, decision.options[0]);

    expect(rival.memory.hostility).toBe(48);
    expect(rival.memory.respect).toBe(49);
    expect(rival.memory.interactionHistory[0].kind).toBe('prestigePressure');
  });

  it('applyRivalDecisionMemory() ignores non-counterplay decisions', () => {
    const manager = createManager();
    const rival = manager.rivals[0];
    rival.memory = {
      hostility: 50, respect: 50,
      retaliationBias: 50, cooperationBias: 45, interactionHistory: [],
    };

    const decision: DecisionItem = {
      id: 'dec-3',
      title: 'Regular Decision',
      description: 'Not a counterplay.',
      category: 'studio',
      options: [{ label: 'Do something', cashDelta: 0, hypeDelta: 0 }],
      expiresWeek: 10,
      projectId: null,
    } as any;

    manager.rivalAiService.applyRivalDecisionMemory(decision, decision.options[0]);

    expect(rival.memory.hostility).toBe(50);
    expect(rival.memory.interactionHistory).toHaveLength(0);
  });

  it('checkRivalReleaseResponses() runs without error for a released project', () => {
    const manager = createManager();
    const events: string[] = [];
    const project = {
      id: 'proj-1', title: 'Test Film', genre: 'action',
      phase: 'released', releaseWeek: manager.currentWeek,
    } as any;

    // Should not throw
    manager.rivalAiService.checkRivalReleaseResponses(project, events);

    // The function may or may not add events depending on rival state,
    // but it should complete without error
    expect(Array.isArray(events)).toBe(true);
  });
});
