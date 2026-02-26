import type { EventTemplate } from './types';

import { coreEventDeck } from './event-deck/core-events';
import { franchiseIdentityEventDeck } from './event-deck/franchise-identity-events';
import { passionProjectEventDeck } from './event-deck/passion-project-events';
import { standaloneEventDeck } from './event-deck/standalone-events';

export function getEventDeck(): EventTemplate[] {
  return [
    ...coreEventDeck,
    ...franchiseIdentityEventDeck,
    ...passionProjectEventDeck,
    ...standaloneEventDeck,
  ];
}
