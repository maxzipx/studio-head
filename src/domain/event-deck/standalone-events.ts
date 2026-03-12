import type { EventTemplateDraft } from '../types';

import { developmentPreproductionEvents } from './standalone/development-preproduction';
import { productionPostEvents } from './standalone/production-post';
import { studioStrategyEvents } from './standalone/studio-strategy';
import { lateCycleEvents } from './standalone/late-cycle';

export const standaloneEventDeck: EventTemplateDraft[] = [
  ...developmentPreproductionEvents,
  ...productionPostEvents,
  ...studioStrategyEvents,
  ...lateCycleEvents,
];


