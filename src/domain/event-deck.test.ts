import { describe, expect, it } from 'vitest';

import { getEventDeck, resolveEventTemplate } from './event-deck';
import type { EventTemplateDraft } from './types';

const baseTemplate: EventTemplateDraft = {
  id: 'test-event',
  category: 'creative',
  scope: 'studio',
  title: 'Test Event',
  decisionTitle: 'Test Decision',
  body: 'Test body.',
  buildDecision: () => null,
};

describe('event-deck', () => {
  it('prefers centralized eligibility config over inline metadata when both exist', () => {
    const resolved = resolveEventTemplate(
      {
        ...baseTemplate,
        cooldownWeeks: 2,
        baseWeight: 0.4,
        minWeek: 3,
        minStudioTier: 'indieStudio',
      },
      {
        cooldownWeeks: 9,
        baseWeight: 1.3,
        minWeek: 8,
        minStudioTier: 'midTier',
        targetPhases: ['production'],
      }
    );

    expect(resolved.cooldownWeeks).toBe(9);
    expect(resolved.baseWeight).toBe(1.3);
    expect(resolved.minWeek).toBe(8);
    expect(resolved.minStudioTier).toBe('midTier');
    expect(resolved.targetPhases).toEqual(['production']);
  });

  it('fails safely when a template is missing centralized eligibility config', () => {
    const resolved = resolveEventTemplate({
      ...baseTemplate,
      id: 'missing-config-event',
      cooldownWeeks: 5,
      baseWeight: 0.75,
      minWeek: 4,
      maxStudioTier: 'majorStudio',
    });

    expect(resolved.cooldownWeeks).toBe(5);
    expect(resolved.baseWeight).toBe(0.75);
    expect(resolved.minWeek).toBe(4);
    expect(resolved.maxStudioTier).toBe('majorStudio');
  });

  it('hydrates authored deck entries with centralized eligibility metadata', () => {
    const rewriteWindow = getEventDeck().find((event) => event.id === 'rewrite-window');

    expect(rewriteWindow).toMatchObject({
      id: 'rewrite-window',
      targetPhases: ['development', 'preProduction'],
      cooldownWeeks: 3,
      baseWeight: 1.4,
      minWeek: 1,
      maxStudioTier: 'midTier',
    });
  });
});
