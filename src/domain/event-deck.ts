import { EVENT_ELIGIBILITY } from './data/event-eligibility-config';
import type { EventEligibilityConfig, EventTemplate, EventTemplateDraft } from './types';

import { coreEventDeck } from './event-deck/core-events';
import { franchiseIdentityEventDeck } from './event-deck/franchise-identity-events';
import { passionProjectEventDeck } from './event-deck/passion-project-events';
import { standaloneEventDeck } from './event-deck/standalone-events';

export function resolveEventTemplate(
  template: EventTemplateDraft,
  eligibility: EventEligibilityConfig | undefined = EVENT_ELIGIBILITY[template.id]
): EventTemplate {
  return {
    ...template,
    targetPhases: eligibility?.targetPhases ?? template.targetPhases,
    minStudioTier: eligibility?.minStudioTier ?? template.minStudioTier,
    maxStudioTier: eligibility?.maxStudioTier ?? template.maxStudioTier,
    cooldownWeeks: eligibility?.cooldownWeeks ?? template.cooldownWeeks ?? 0,
    baseWeight: eligibility?.baseWeight ?? template.baseWeight ?? 1,
    minWeek: eligibility?.minWeek ?? template.minWeek ?? 1,
  };
}

export function getEventDeck(): EventTemplate[] {
  return [
    ...coreEventDeck,
    ...franchiseIdentityEventDeck,
    ...passionProjectEventDeck,
    ...standaloneEventDeck,
  ].map((template) => resolveEventTemplate(template));
}
