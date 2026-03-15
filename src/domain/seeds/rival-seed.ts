import type { RivalStudio } from '../types';
import { createId } from '../id';
import { createInitialRivalMemory } from './talent-seed';

export function createSeedRivals(): RivalStudio[] {
  return [
    {
      id: createId('rival'),
      name: 'Meridian Pictures',
      personality: 'prestigeHunter',
      studioHeat: 61,
      activeReleases: [],
      upcomingReleases: [],
      calendarPressureLockUntilWeek: null,
      lastPressuredProjectId: null,
      lockedTalentIds: [],
      memory: createInitialRivalMemory('prestigeHunter'),
    },
    {
      id: createId('rival'),
      name: 'Apex Global',
      personality: 'blockbusterFactory',
      studioHeat: 74,
      activeReleases: [],
      upcomingReleases: [],
      calendarPressureLockUntilWeek: null,
      lastPressuredProjectId: null,
      lockedTalentIds: [],
      memory: createInitialRivalMemory('blockbusterFactory'),
    },
    {
      id: createId('rival'),
      name: 'Neon Slate',
      personality: 'genreSpecialist',
      studioHeat: 56,
      activeReleases: [],
      upcomingReleases: [],
      calendarPressureLockUntilWeek: null,
      lastPressuredProjectId: null,
      lockedTalentIds: [],
      memory: createInitialRivalMemory('genreSpecialist'),
    },
    {
      id: createId('rival'),
      name: 'Harbor Road',
      personality: 'streamingFirst',
      studioHeat: 52,
      activeReleases: [],
      upcomingReleases: [],
      calendarPressureLockUntilWeek: null,
      lastPressuredProjectId: null,
      lockedTalentIds: [],
      memory: createInitialRivalMemory('streamingFirst'),
    },
    {
      id: createId('rival'),
      name: 'Freehold Films',
      personality: 'scrappyUpstart',
      studioHeat: 41,
      activeReleases: [],
      upcomingReleases: [],
      calendarPressureLockUntilWeek: null,
      lastPressuredProjectId: null,
      lockedTalentIds: [],
      memory: createInitialRivalMemory('scrappyUpstart'),
    },
  ];
}
