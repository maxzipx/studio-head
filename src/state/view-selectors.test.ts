import { describe, expect, it } from 'vitest';

import { StudioManager } from '../domain/studio-manager';
import { selectBoxOfficeView, selectInboxView } from './view-selectors';

function buildState() {
  return {
    manager: new StudioManager(),
    lastMessage: null,
    resolveCrisis: () => undefined,
    resolveDecision: () => undefined,
    dismissDecision: () => undefined,
    dismissInboxNotification: () => undefined,
  } as any;
}

describe('view selectors', () => {
  it('selectInboxView returns screen-facing data without manager instance', () => {
    const state = buildState();
    const view = selectInboxView(state);

    expect('manager' in (view as unknown as Record<string, unknown>)).toBe(false);
    expect(view.crisesSignature).toBeTypeOf('string');
    expect(view.decisionsSignature).toBeTypeOf('string');
    expect(view.projectsSignature).toBeTypeOf('string');
  });

  it('selectInboxView signature changes when decision expiry mutates', () => {
    const state = buildState();
    if (state.manager.decisionQueue.length === 0) {
      throw new Error('Expected at least one decision for selector test.');
    }

    const before = selectInboxView(state).decisionsSignature;
    state.manager.decisionQueue[0]!.weeksUntilExpiry -= 1;
    const after = selectInboxView(state).decisionsSignature;

    expect(after).not.toBe(before);
  });

  it('selectBoxOfficeView exposes report signature and updates with report changes', () => {
    const state = buildState();
    const base = selectBoxOfficeView(state);

    state.manager.releaseReports.unshift({
      projectId: 'test-project',
      title: 'Test Project',
      weekResolved: 12,
      totalBudget: 1_000_000,
      totalGross: 2_000_000,
      studioNet: 1_100_000,
      profit: 100_000,
      roi: 1.1,
      openingWeekend: 300_000,
      critics: 65,
      audience: 68,
      outcome: 'hit',
      wasRecordOpening: false,
      breakdown: { script: 1, direction: 2, starPower: 0, marketing: 1, timing: -1, genreCycle: 0 },
    });

    const next = selectBoxOfficeView(state);
    expect(next.reportsSignature).not.toBe(base.reportsSignature);
  });
});
