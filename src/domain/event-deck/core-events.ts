import type { EventTemplate } from '../types';

import { foundationCoreEvents } from './core/foundation-events';
import { leakAwardsCoreEvents } from './core/leak-awards-events';
import { marketFinanceCoreEvents } from './core/market-finance-events';
import { talentExhibitorCoreEvents } from './core/talent-exhibitor-events';
import { franchisePivotCoreEvents } from './core/franchise-pivot-events';

export const coreEventDeck: EventTemplate[] = [
  ...foundationCoreEvents,
  ...leakAwardsCoreEvents,
  ...marketFinanceCoreEvents,
  ...talentExhibitorCoreEvents,
  ...franchisePivotCoreEvents,
];
