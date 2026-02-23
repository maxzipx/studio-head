import { describe, expect, it } from 'vitest';

import { StudioManager } from './studio-manager';

describe('StudioManager', () => {
  it('advances week and returns a summary when no blocking crises exist', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95 });
    const startingWeek = manager.currentWeek;

    const summary = manager.endWeek();

    expect(manager.currentWeek).toBe(startingWeek + 1);
    expect(summary.week).toBe(manager.currentWeek);
    expect(summary.events.length).toBeGreaterThan(0);
  });

  it('blocks endWeek when unresolved crises exist', () => {
    const manager = new StudioManager({ crisisRng: () => 0.0 });
    manager.endWeek();
    expect(manager.pendingCrises.length).toBeGreaterThan(0);

    expect(() => manager.endWeek()).toThrow('Resolve all crises before ending the week.');
  });

  it('allows progression after resolving crisis', () => {
    const manager = new StudioManager({ crisisRng: () => 0.0 });
    manager.endWeek();

    const crisis = manager.pendingCrises[0];
    manager.resolveCrisis(crisis.id, crisis.options[0].id);

    expect(manager.pendingCrises.length).toBe(0);

    const summary = manager.endWeek();
    expect(summary.week).toBe(manager.currentWeek);
  });

  it('applies decision option effects and removes decision item', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95 });
    const decision = manager.decisionQueue[0];
    const cashBefore = manager.cash;

    manager.resolveDecision(decision.id, decision.options[0].id);

    expect(manager.decisionQueue.find((item) => item.id === decision.id)).toBeUndefined();
    expect(manager.cash).toBeLessThan(cashBefore);
  });

  it('acquires script from market and creates development project', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95 });
    const beforeProjects = manager.activeProjects.length;
    const beforeScripts = manager.scriptMarket.length;
    const targetScript = manager.scriptMarket[0];

    const result = manager.acquireScript(targetScript.id);

    expect(result.success).toBe(true);
    expect(manager.activeProjects.length).toBe(beforeProjects + 1);
    expect(manager.scriptMarket.length).toBe(beforeScripts - 1);
  });

  it('attaches available talent through negotiation', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, negotiationRng: () => 0 });
    const project = manager.activeProjects.find((item) => item.phase === 'development');
    const director = manager.talentPool.find((item) => item.role === 'director');
    expect(project).toBeTruthy();
    expect(director).toBeTruthy();

    const result = manager.negotiateAndAttachTalent(project!.id, director!.id);

    expect(result.success).toBe(true);
    expect(project!.directorId).toBe(director!.id);
    expect(director!.availability).toBe('attached');
  });

  it('enforces phase progression gates and advances when requirements are met', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, negotiationRng: () => 0 });
    const project = manager.activeProjects.find((item) => item.phase === 'development');
    const director = manager.talentPool.find((item) => item.role === 'director');
    const lead = manager.talentPool.find((item) => item.role === 'leadActor');
    expect(project).toBeTruthy();
    expect(director).toBeTruthy();
    expect(lead).toBeTruthy();

    let result = manager.advanceProjectPhase(project!.id);
    expect(result.success).toBe(false);

    manager.negotiateAndAttachTalent(project!.id, director!.id);
    manager.negotiateAndAttachTalent(project!.id, lead!.id);
    result = manager.advanceProjectPhase(project!.id);
    expect(result.success).toBe(true);
    expect(project!.phase).toBe('preProduction');
  });

  it('does not spam duplicate event titles in same queue', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0.1 });

    manager.endWeek();
    manager.endWeek();
    manager.endWeek();

    const titles = manager.decisionQueue.map((item) => item.title);
    const unique = new Set(titles);
    expect(unique.size).toBe(titles.length);
  });
});
