import AsyncStorage from '@react-native-async-storage/async-storage';

import { StudioManager } from '../domain/studio-manager';

import { sanitizeRestoredManager } from './persistence-sanitizers';

const SAVE_KEY = 'pg.save.v1';
const CURRENT_SAVE_VERSION = 2;

interface StoredManager extends Record<string, unknown> {
  lastEventWeek?: [string, number][];
  studioHeat?: number;
}

interface SaveEnvelope {
  version: number;
  savedAt: string;
  manager: StoredManager;
}

type SaveMigration = (manager: StoredManager) => StoredManager;

function hasOwn(input: Record<string, unknown>, key: string): boolean {
  return Object.hasOwn(input, key);
}

const SAVE_MIGRATIONS: Record<number, SaveMigration> = {
  1: (manager) => ({ ...manager }),
};

function applyMigrations(input: StoredManager, version: number): StoredManager {
  let nextVersion = Math.max(1, Math.floor(version));
  let migrated = { ...input };
  while (nextVersion < CURRENT_SAVE_VERSION) {
    const migration = SAVE_MIGRATIONS[nextVersion];
    if (!migration) {
      break;
    }
    migrated = migration(migrated);
    nextVersion += 1;
  }
  return migrated;
}

export const SERIALIZE_MANAGER_KEYS = [
  'studioName',
  'cash',
  'reputation',
  'isBankrupt',
  'bankruptcyReason',
  'consecutiveLowCashWeeks',
  'firstSessionComplete',
  'currentWeek',
  'turnLengthWeeks',
  'pendingCrises',
  'distributionOffers',
  'pendingReleaseReveals',
  'decisionQueue',
  'inboxNotifications',
  'activeProjects',
  'franchises',
  'talentSeed',
  'talentPool',
  'scriptMarket',
  'rivals',
  'industryNewsLog',
  'playerNegotiations',
  'storyFlags',
  'storyArcs',
  'recentDecisionCategories',
  'lastWeekSummary',
  'awardsHistory',
  'awardsSeasonsProcessed',
  'genreCycles',
  'studioChronicle',
  'releaseReports',
  'pendingFinalReleaseReveals',
  'milestones',
  'lifetimeRevenue',
  'lifetimeProfit',
  'lifetimeExpenses',
  'marketingTeamLevel',
  'ownedIps',
  'studioCapacityUpgrades',
  'studioSpecialization',
  'pendingSpecialization',
  'specializationCommittedWeek',
  'foundingProfile',
  'needsFoundingSetup',
  'foundingSetupCompletedWeek',
  'animationDivisionUnlocked',
  'lastGeneratedCrisisWeek',
  'generatedCrisisThisTurn',
  'lastScaleOverheadWeek',
  'tutorialState',
  'tutorialCompleted',
  'tutorialDismissed',
  'departmentLevels',
  'exclusiveDistributionPartner',
  'exclusivePartnerUntilWeek',
  'executiveNetworkLevel',
  'marketInitialized',
  'lastMarketBurstWeek',
  'marketDirectorIdx',
  'marketActorIdx',
  'marketLeadActorIdx',
  'marketLeadActressIdx',
] as const;

export function serializeStudioManager(manager: StudioManager): StoredManager {
  const serialized: StoredManager = {};
  const source = manager as unknown as Record<string, unknown>;
  for (const key of SERIALIZE_MANAGER_KEYS) {
    serialized[key] = source[key];
  }

  const sourceLastEventWeek = (manager as unknown as { lastEventWeek?: unknown }).lastEventWeek;
  if (sourceLastEventWeek instanceof Map) {
    serialized.lastEventWeek = Array.from(sourceLastEventWeek.entries()).filter(
      (entry): entry is [string, number] => typeof entry[0] === 'string' && typeof entry[1] === 'number'
    );
  }

  return serialized;
}

/**
 * Copies only data fields from `source` into `target`, leaving target's service
 * bindings intact. Use this instead of Object.assign when hydrating a manager
 * whose services must stay bound to `target` (not the source).
 *
 * Object.assign would overwrite the private service fields (eventService,
 * releaseService, etc.) with instances that hold `this.manager = source`.
 * Once any service replaces an array field on `source` the two managers diverge
 * silently, causing decisions and script offers to work on a shadow copy that
 * the store and UI never see.
 */
export function hydrateManagerData(target: StudioManager, source: StudioManager): void {
  const src = source as unknown as Record<string, unknown>;
  const tgt = target as unknown as Record<string, unknown>;
  for (const key of SERIALIZE_MANAGER_KEYS) {
    tgt[key] = src[key];
  }
  // lastEventWeek is a readonly Map — mutate it in-place rather than replacing the reference.
  const srcMap = src.lastEventWeek as Map<string, number> | undefined;
  const tgtMap = tgt.lastEventWeek as Map<string, number>;
  tgtMap.clear();
  if (srcMap instanceof Map) {
    for (const [k, v] of srcMap) {
      tgtMap.set(k, v);
    }
  }
}

export function restoreStudioManager(input: StoredManager): StudioManager {
  const manager = new StudioManager();
  const target = manager as unknown as Record<string, unknown>;
  for (const key of SERIALIZE_MANAGER_KEYS) {
    if (hasOwn(input, key)) {
      target[key] = input[key];
    }
  }
  sanitizeRestoredManager(manager, input);

  const sourceLastEventWeek = input.lastEventWeek;
  const targetLastEventWeek = (manager as unknown as { lastEventWeek: Map<string, number> }).lastEventWeek;

  if (Array.isArray(sourceLastEventWeek)) {
    for (const entry of sourceLastEventWeek) {
      if (!Array.isArray(entry) || entry.length !== 2) continue;
      if (typeof entry[0] !== 'string' || typeof entry[1] !== 'number') continue;
      targetLastEventWeek.set(entry[0], entry[1]);
    }
  } else if (sourceLastEventWeek && typeof sourceLastEventWeek === 'object') {
    for (const [eventId, week] of Object.entries(sourceLastEventWeek)) {
      if (typeof week === 'number') {
        targetLastEventWeek.set(eventId, week);
      }
    }
  }

  return manager;
}

export async function loadManagerFromStorage(): Promise<StudioManager | null> {
  const raw = await AsyncStorage.getItem(SAVE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as SaveEnvelope;
    if (!parsed || !Number.isFinite(parsed.version) || !parsed.manager) return null;
    if (parsed.version > CURRENT_SAVE_VERSION) return null;
    return restoreStudioManager(applyMigrations(parsed.manager, parsed.version));
  } catch {
    return null;
  }
}

export async function saveManagerToStorage(manager: StudioManager): Promise<void> {
  const serializedManager = serializeStudioManager(manager);
  await saveSerializedManagerToStorage(serializedManager);
}

export async function saveSerializedManagerToStorage(serializedManager: StoredManager): Promise<void> {
  const envelope: SaveEnvelope = {
    version: CURRENT_SAVE_VERSION,
    savedAt: new Date().toISOString(),
    manager: serializedManager,
  };
  await AsyncStorage.setItem(SAVE_KEY, JSON.stringify(envelope));
}
