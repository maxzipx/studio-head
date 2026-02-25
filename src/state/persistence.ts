import AsyncStorage from '@react-native-async-storage/async-storage';

import { MEMORY_RULES, STUDIO_STARTING } from '../domain/balance-constants';
import { StudioManager } from '../domain/studio-manager';

const SAVE_KEY = 'pg.save.v1';
const SAVE_VERSION = 1;

interface StoredManager extends Record<string, unknown> {
  lastEventWeek?: [string, number][];
}

interface SaveEnvelope {
  version: number;
  savedAt: string;
  manager: StoredManager;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeRestoredManager(manager: StudioManager): void {
  const defaults = new StudioManager();

  if (typeof manager.studioName !== 'string' || manager.studioName.trim().length < 1) {
    manager.studioName = defaults.studioName;
  }
  if (!Number.isFinite(manager.cash)) manager.cash = defaults.cash;
  manager.cash = Math.round(manager.cash);
  if (typeof manager.isBankrupt !== 'boolean') manager.isBankrupt = false;
  if (typeof manager.bankruptcyReason !== 'string' && manager.bankruptcyReason !== null) {
    manager.bankruptcyReason = null;
  }
  if (!Number.isFinite(manager.consecutiveLowCashWeeks)) manager.consecutiveLowCashWeeks = 0;
  if (typeof manager.firstSessionComplete !== 'boolean') manager.firstSessionComplete = false;

  if (!isRecord(manager.reputation)) {
    manager.reputation = {
      critics: STUDIO_STARTING.REPUTATION_PILLAR,
      talent: STUDIO_STARTING.REPUTATION_PILLAR,
      distributor: STUDIO_STARTING.REPUTATION_PILLAR,
      audience: STUDIO_STARTING.REPUTATION_PILLAR,
    };
  } else {
    const rep = manager.reputation as Record<string, unknown>;
    for (const field of ['critics', 'talent', 'distributor', 'audience']) {
      if (!Number.isFinite(rep[field])) rep[field] = STUDIO_STARTING.REPUTATION_PILLAR;
      rep[field] = Math.min(100, Math.max(0, rep[field] as number));
    }
  }

  if (!Number.isFinite(manager.currentWeek) || manager.currentWeek < 1) {
    manager.currentWeek = defaults.currentWeek;
  }
  manager.currentWeek = Math.max(1, Math.round(manager.currentWeek));
  if (manager.turnLengthWeeks !== 1 && manager.turnLengthWeeks !== 2) {
    manager.turnLengthWeeks = defaults.turnLengthWeeks;
  }

  if (!Array.isArray(manager.pendingCrises)) manager.pendingCrises = [];
  if (!Array.isArray(manager.distributionOffers)) manager.distributionOffers = [];
  if (!Array.isArray(manager.pendingReleaseReveals)) manager.pendingReleaseReveals = [];
  if (!Array.isArray(manager.decisionQueue)) manager.decisionQueue = defaults.decisionQueue;
  if (!Array.isArray(manager.activeProjects)) manager.activeProjects = defaults.activeProjects;
  for (const project of manager.activeProjects) {
    if (!Number.isFinite(project.editorialScore)) project.editorialScore = 5;
    project.editorialScore = Math.min(10, Math.max(0, project.editorialScore));
    if (!Number.isFinite(project.postPolishPasses)) project.postPolishPasses = 0;
    project.postPolishPasses = Math.min(2, Math.max(0, Math.round(project.postPolishPasses)));
    if (!Number.isFinite(project.awardsNominations)) project.awardsNominations = 0;
    if (!Number.isFinite(project.awardsWins)) project.awardsWins = 0;
    project.awardsNominations = Math.max(0, Math.round(project.awardsNominations));
    project.awardsWins = Math.max(0, Math.round(project.awardsWins));
  }
  if (!Array.isArray(manager.talentPool)) manager.talentPool = defaults.talentPool;
  for (const talent of manager.talentPool) {
    if (!isRecord(talent.relationshipMemory)) {
      const baselineTrust = Math.round(Math.min(100, Math.max(0, 35 + talent.studioRelationship * 45)));
      const baselineLoyalty = Math.round(Math.min(100, Math.max(0, 30 + talent.studioRelationship * 40)));
      talent.relationshipMemory = {
        trust: baselineTrust,
        loyalty: baselineLoyalty,
        interactionHistory: [],
      };
    } else {
      if (!Number.isFinite(talent.relationshipMemory.trust)) talent.relationshipMemory.trust = 50;
      if (!Number.isFinite(talent.relationshipMemory.loyalty)) talent.relationshipMemory.loyalty = 50;
      talent.relationshipMemory.trust = Math.min(100, Math.max(0, Math.round(talent.relationshipMemory.trust)));
      talent.relationshipMemory.loyalty = Math.min(100, Math.max(0, Math.round(talent.relationshipMemory.loyalty)));
      if (!Array.isArray(talent.relationshipMemory.interactionHistory)) {
        talent.relationshipMemory.interactionHistory = [];
      }
      talent.relationshipMemory.interactionHistory = talent.relationshipMemory.interactionHistory
        .filter((entry) => isRecord(entry) && typeof entry.note === 'string')
        .slice(-MEMORY_RULES.TALENT_INTERACTION_HISTORY_MAX)
        .map((entry) => ({
          week: Number.isFinite(entry.week) ? Math.max(1, Math.round(entry.week as number)) : manager.currentWeek,
          kind: typeof entry.kind === 'string' ? entry.kind : 'negotiationOpened',
          trustDelta: Number.isFinite(entry.trustDelta) ? Math.round(entry.trustDelta as number) : 0,
          loyaltyDelta: Number.isFinite(entry.loyaltyDelta) ? Math.round(entry.loyaltyDelta as number) : 0,
          note: String(entry.note),
          projectId: typeof entry.projectId === 'string' || entry.projectId === null ? entry.projectId : null,
        }));
    }
    talent.studioRelationship = Math.min(
      1,
      Math.max(0, (talent.relationshipMemory.trust * 0.62 + talent.relationshipMemory.loyalty * 0.38) / 100)
    );
  }
  if (!Array.isArray(manager.scriptMarket)) manager.scriptMarket = defaults.scriptMarket;
  if (!Array.isArray(manager.rivals)) manager.rivals = defaults.rivals;
  for (const rival of manager.rivals) {
    const baseline = defaults.rivals.find((item) => item.personality === rival.personality) ?? defaults.rivals[0];
    if (!isRecord(rival.memory)) {
      rival.memory = {
        hostility: baseline.memory.hostility,
        respect: baseline.memory.respect,
        retaliationBias: baseline.memory.retaliationBias,
        cooperationBias: baseline.memory.cooperationBias,
        interactionHistory: [],
      };
    } else {
      if (!Number.isFinite(rival.memory.hostility)) rival.memory.hostility = baseline.memory.hostility;
      if (!Number.isFinite(rival.memory.respect)) rival.memory.respect = baseline.memory.respect;
      if (!Number.isFinite(rival.memory.retaliationBias)) rival.memory.retaliationBias = baseline.memory.retaliationBias;
      if (!Number.isFinite(rival.memory.cooperationBias)) rival.memory.cooperationBias = baseline.memory.cooperationBias;
      rival.memory.hostility = Math.min(100, Math.max(0, Math.round(rival.memory.hostility)));
      rival.memory.respect = Math.min(100, Math.max(0, Math.round(rival.memory.respect)));
      rival.memory.retaliationBias = Math.min(100, Math.max(0, Math.round(rival.memory.retaliationBias)));
      rival.memory.cooperationBias = Math.min(100, Math.max(0, Math.round(rival.memory.cooperationBias)));
      if (!Array.isArray(rival.memory.interactionHistory)) rival.memory.interactionHistory = [];
      rival.memory.interactionHistory = rival.memory.interactionHistory
        .filter((entry) => isRecord(entry) && typeof entry.note === 'string')
        .slice(-MEMORY_RULES.RIVAL_INTERACTION_HISTORY_MAX)
        .map((entry) => ({
          week: Number.isFinite(entry.week) ? Math.max(1, Math.round(entry.week as number)) : manager.currentWeek,
          kind: typeof entry.kind === 'string' ? entry.kind : 'counterplayEscalation',
          hostilityDelta: Number.isFinite(entry.hostilityDelta) ? Math.round(entry.hostilityDelta as number) : 0,
          respectDelta: Number.isFinite(entry.respectDelta) ? Math.round(entry.respectDelta as number) : 0,
          note: String(entry.note),
          projectId: typeof entry.projectId === 'string' || entry.projectId === null ? entry.projectId : null,
        }));
    }
  }
  if (!Array.isArray(manager.industryNewsLog)) manager.industryNewsLog = [];
  if (!Array.isArray(manager.awardsHistory)) manager.awardsHistory = [];
  manager.awardsHistory = manager.awardsHistory
    .filter((entry) => isRecord(entry) && Array.isArray(entry.results))
    .map((entry) => ({
      seasonYear: Number.isFinite(entry.seasonYear) ? Math.max(1, Math.round(entry.seasonYear as number)) : 1,
      week: Number.isFinite(entry.week) ? Math.max(1, Math.round(entry.week as number)) : manager.currentWeek,
      showName: typeof entry.showName === 'string' ? entry.showName : 'Global Film Honors',
      headline: typeof entry.headline === 'string' ? entry.headline : 'Awards season update.',
      results: (entry.results as unknown[])
        .filter((result): result is Record<string, unknown> => isRecord(result) && typeof result.title === 'string')
        .map((result) => ({
          projectId: typeof result.projectId === 'string' ? result.projectId : 'unknown',
          title: String(result.title),
          nominations: Number.isFinite(result.nominations) ? Math.max(0, Math.round(result.nominations as number)) : 0,
          wins: Number.isFinite(result.wins) ? Math.max(0, Math.round(result.wins as number)) : 0,
          score: Number.isFinite(result.score) ? Math.max(0, Math.min(100, Number(result.score))) : 0,
        })),
    }))
    .slice(0, 24);
  if (!Array.isArray(manager.awardsSeasonsProcessed)) manager.awardsSeasonsProcessed = [];
  manager.awardsSeasonsProcessed = manager.awardsSeasonsProcessed
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.max(1, Math.round(value)))
    .slice(-20);
  if (!Array.isArray(manager.playerNegotiations)) manager.playerNegotiations = [];
  if (!Array.isArray(manager.recentDecisionCategories)) manager.recentDecisionCategories = [];

  if (!isRecord(manager.storyFlags)) manager.storyFlags = {};
  if (!isRecord(manager.storyArcs)) manager.storyArcs = {};
  if (
    manager.lastWeekSummary &&
    (!Number.isFinite(manager.lastWeekSummary.week) ||
      !Number.isFinite(manager.lastWeekSummary.cashDelta) ||
      !Array.isArray(manager.lastWeekSummary.events))
  ) {
    manager.lastWeekSummary = null;
  }
}

const SERIALIZE_BLOCKED_KEYS = new Set([
  'crisisRng',
  'eventRng',
  'negotiationRng',
  'rivalRng',
  'eventDeck',
  'lastEventWeek',
  'studioHeat',
  'studioTier',
  'legacyScore',
]);

export function serializeStudioManager(manager: StudioManager): StoredManager {
  const serialized: StoredManager = {};
  for (const [key, value] of Object.entries(manager as unknown as Record<string, unknown>)) {
    if (SERIALIZE_BLOCKED_KEYS.has(key)) continue;
    serialized[key] = value;
  }

  const sourceLastEventWeek = (manager as unknown as { lastEventWeek?: unknown }).lastEventWeek;
  if (sourceLastEventWeek instanceof Map) {
    serialized.lastEventWeek = Array.from(sourceLastEventWeek.entries()).filter(
      (entry): entry is [string, number] => typeof entry[0] === 'string' && typeof entry[1] === 'number'
    );
  }

  return serialized;
}

export function restoreStudioManager(input: StoredManager): StudioManager {
  const manager = new StudioManager();
  for (const [key, value] of Object.entries(input)) {
    if (SERIALIZE_BLOCKED_KEYS.has(key)) continue;
    (manager as unknown as Record<string, unknown>)[key] = value;
  }

  // Migrate old saves that had studioHeat but no reputation
  if (!('reputation' in input) && typeof input.studioHeat === 'number') {
    const legacyHeat = Math.min(100, Math.max(0, input.studioHeat));
    manager.reputation = { critics: legacyHeat, talent: legacyHeat, distributor: legacyHeat, audience: legacyHeat };
  }

  sanitizeRestoredManager(manager);

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
    if (!parsed || parsed.version !== SAVE_VERSION || !parsed.manager) return null;
    return restoreStudioManager(parsed.manager);
  } catch {
    return null;
  }
}

export async function saveManagerToStorage(manager: StudioManager): Promise<void> {
  const serializedManager = serializeStudioManager(manager);
  const envelope: SaveEnvelope = {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    manager: serializedManager,
  };
  await AsyncStorage.setItem(SAVE_KEY, JSON.stringify(envelope));
}
