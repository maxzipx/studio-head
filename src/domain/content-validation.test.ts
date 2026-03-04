import { describe, expect, it } from 'vitest';

import { getEventDeck } from './event-deck';
import type { BuildDecisionContext, EventTemplate } from './types';

const STUB_CONTEXT: BuildDecisionContext = {
  talentPool: [],
  activeProjects: [],
  rivals: [],
  reputation: { critics: 50, talent: 50, distributor: 50, audience: 50 },
  storyFlags: {},
  cash: 500_000,
  currentWeek: 10,
  studioTier: 'midTier',
  franchises: [],
};

function buildDecisionForValidation(event: EventTemplate) {
  let seed = 0;
  return event.buildDecision({
    idFactory: (prefix: string) => `${prefix}-${seed++}`,
    projectId: 'project-test',
    projectTitle: 'Project Test',
    currentWeek: 10,
    context: STUB_CONTEXT,
  });
}

describe('content validation', () => {
  it('maintains minimum event coverage by category', () => {
    const deck = getEventDeck();
    const counts = deck.reduce<Record<string, number>>((acc, item) => {
      acc[item.category] = (acc[item.category] ?? 0) + 1;
      return acc;
    }, {});

    expect(counts.creative ?? 0).toBeGreaterThanOrEqual(4);
    expect(counts.marketing ?? 0).toBeGreaterThanOrEqual(5);
    expect(counts.operations ?? 0).toBeGreaterThanOrEqual(5);
    expect(counts.finance ?? 0).toBeGreaterThanOrEqual(5);
    expect(counts.talent ?? 0).toBeGreaterThanOrEqual(4);
  });

  it('has unique decision titles and reachable required flags', () => {
    const deck = getEventDeck();
    const decisionTitles = new Set<string>();
    const producedFlags = new Set<string>();

    for (const event of deck) {
      const decision = buildDecisionForValidation(event);
      expect(decisionTitles.has(event.decisionTitle)).toBe(false);
      decisionTitles.add(event.decisionTitle);
      if (!decision) continue;
      for (const option of decision.options) {
        if (option.setFlag) producedFlags.add(option.setFlag);
      }
    }

    const requiredFlags = new Set(deck.flatMap((item) => (item.requiresFlag ? [item.requiresFlag] : [])));
    for (const flag of requiredFlags) {
      expect(producedFlags.has(flag)).toBe(true);
    }
  });

  it('keeps arc chains internally coherent and mutable', () => {
    const deck = getEventDeck();
    const starters = new Set<string>();
    const continuations = new Set<string>();
    const arcsWithMutableOptions = new Set<string>();

    for (const event of deck) {
      const decision = buildDecisionForValidation(event);
      if (!decision) continue;
      const arcId = decision.arcId ?? event.requiresArc?.id ?? event.blocksArc?.id;
      if (!arcId) continue;

      if (!event.requiresArc) starters.add(arcId);
      if (event.requiresArc) continuations.add(event.requiresArc.id);

      const hasMutation = decision.options.some(
        (option) =>
          typeof option.setArcStage === 'number' ||
          typeof option.advanceArcBy === 'number' ||
          option.resolveArc === true ||
          option.failArc === true
      );
      if (hasMutation) arcsWithMutableOptions.add(arcId);
    }

    for (const arcId of continuations) {
      expect(starters.has(arcId)).toBe(true);
      expect(arcsWithMutableOptions.has(arcId)).toBe(true);
    }
  });
});
