import { EVENT_BALANCE, SEASONAL_RULES } from './balance-constants';
import {
  CRISIS_GENERATION_RULES,
  EVENT_GENERATION_RULES,
  EVENT_WEIGHT_RULES,
  SCRIPT_MARKET_REFILL_RULES,
} from './data/event-eligibility-config';
import { isTierMet, isTierExceeded } from './studio-manager.constants';
import { createId } from './id';
import { createSeedScriptMarket } from './seeds';
import type {
  BuildDecisionContext,
  CrisisEvent,
  DecisionItem,
  EventTemplate,
  MovieProject,
  ScriptPitch,
  StoryArcState,
} from './types';
import type { StudioManager } from './studio-manager';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

type ScriptMarketTier = 'bargain' | 'standard' | 'biddingWar';

function rollScriptMarketTier(manager: StudioManager): ScriptMarketTier {
  const roll = manager.eventRng();
  if (roll < 0.25) return 'bargain';
  if (roll < 0.35) return 'biddingWar';
  return 'standard';
}

function pickScriptByDemandForManager(manager: StudioManager, pool: ScriptPitch[]): ScriptPitch | null {
  if (pool.length === 0) return null;
  const weighted = pool.map((item) => {
    const demand = typeof manager.getGenreDemandMultiplier === 'function' ? manager.getGenreDemandMultiplier(item.genre) : 1;
    const weight = Math.max(0.2, Math.pow(Math.max(0.72, demand), 2));
    return { item, weight };
  });
  weighted.sort((a, b) => b.weight - a.weight);

  // Keep some randomness, but strongly bias toward hot genres so cycles affect the script market.
  if (manager.eventRng() < SCRIPT_MARKET_REFILL_RULES.topDemandBiasChance) {
    const maxWeight = weighted[0]?.weight ?? 0;
    const topTier = weighted.filter((entry) => entry.weight >= maxWeight - SCRIPT_MARKET_REFILL_RULES.topDemandWeightWindow);
    const topIdx = Math.floor(manager.eventRng() * topTier.length);
    return topTier[topIdx]?.item ?? null;
  }

  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = manager.eventRng() * totalWeight;
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.item;
  }
  return weighted[weighted.length - 1]?.item ?? null;
}

export function tickDecisionExpiryForManager(manager: StudioManager, events: string[]): void {
  for (const item of manager.decisionQueue) {
    item.weeksUntilExpiry -= 1;
  }
  const expired = manager.decisionQueue.filter((item) => item.weeksUntilExpiry < 0);
  if (expired.length > 0) {
    for (const item of expired) {
      const flag = item.onExpireClearFlag;
      if (!flag) continue;
      const current = manager.storyFlags[flag] ?? 0;
      if (current <= 1) {
        delete manager.storyFlags[flag];
      } else {
        manager.storyFlags[flag] = current - 1;
      }
    }
    manager.decisionQueue = manager.decisionQueue.filter((item) => item.weeksUntilExpiry >= 0);
    events.push(`${expired.length} decision item(s) expired.`);
    manager.adjustReputation(-expired.length, 'all');
  }
}

export function tickScriptMarketExpiryForManager(manager: StudioManager, events: string[]): void {
  for (const item of manager.scriptMarket) {
    item.expiresInWeeks -= 1;
  }
  const expired = manager.scriptMarket.filter((item) => item.expiresInWeeks < 0);
  if (expired.length > 0) {
    manager.scriptMarket = manager.scriptMarket.filter((item) => item.expiresInWeeks >= 0);
    events.push(`${expired.length} script offer(s) expired from market.`);
  }
}

export function refillScriptMarketForManager(manager: StudioManager, events: string[]): void {
  const targetOffers = SCRIPT_MARKET_REFILL_RULES.targetOffers;
  if (manager.scriptMarket.length >= targetOffers) return;

  const catalog = createSeedScriptMarket().filter(
    (item) => manager.animationDivisionUnlocked || item.genre !== 'animation'
  );
  const existingTitles = new Set([
    ...manager.scriptMarket.map((item) => item.title),
    ...manager.activeProjects.map((item) => item.title),
  ]);
  let added = 0;
  let weightedDemandAccumulator = 0;

  while (manager.scriptMarket.length < targetOffers) {
    const uniquePool = catalog.filter((item) => !existingTitles.has(item.title));
    const pool = uniquePool.length > 0 ? uniquePool : catalog;
    const source = pickScriptByDemandForManager(manager, pool);
    if (!source) break;

    const tier = rollScriptMarketTier(manager);
    let scriptQuality = source.scriptQuality;
    let conceptStrength = source.conceptStrength;
    let askingPrice = source.askingPrice;

    if (tier === 'bargain') {
      const qualityPenalty =
        SCRIPT_MARKET_REFILL_RULES.bargain.qualityPenaltyBase +
        manager.eventRng() * SCRIPT_MARKET_REFILL_RULES.bargain.qualityPenaltySpread;
      const conceptPenalty =
        SCRIPT_MARKET_REFILL_RULES.bargain.conceptPenaltyBase +
        manager.eventRng() * SCRIPT_MARKET_REFILL_RULES.bargain.conceptPenaltySpread;
      const priceMultiplier =
        SCRIPT_MARKET_REFILL_RULES.bargain.priceMultiplierBase +
        manager.eventRng() * SCRIPT_MARKET_REFILL_RULES.bargain.priceMultiplierSpread;
      scriptQuality = clamp(source.scriptQuality * qualityPenalty, 1, 9.9);
      conceptStrength = clamp(source.conceptStrength * conceptPenalty, 1, 9.9);
      askingPrice = Math.max(25_000, Math.round(source.askingPrice * priceMultiplier));
    } else if (tier === 'biddingWar') {
      const qualityBoost =
        SCRIPT_MARKET_REFILL_RULES.biddingWar.qualityBoostBase +
        manager.eventRng() * SCRIPT_MARKET_REFILL_RULES.biddingWar.qualityBoostSpread;
      const conceptBoost =
        SCRIPT_MARKET_REFILL_RULES.biddingWar.conceptBoostBase +
        manager.eventRng() * SCRIPT_MARKET_REFILL_RULES.biddingWar.conceptBoostSpread;
      const priceMultiplier =
        SCRIPT_MARKET_REFILL_RULES.biddingWar.priceMultiplierBase +
        manager.eventRng() * SCRIPT_MARKET_REFILL_RULES.biddingWar.priceMultiplierSpread;
      scriptQuality = clamp(source.scriptQuality + qualityBoost, 1, 9.8);
      conceptStrength = clamp(source.conceptStrength + conceptBoost, 1, 9.8);
      askingPrice = Math.max(25_000, Math.round(source.askingPrice * priceMultiplier));
    } else {
      const qualityJitter = (manager.eventRng() - 0.5) * SCRIPT_MARKET_REFILL_RULES.standard.qualityJitterSpread;
      const conceptJitter = (manager.eventRng() - 0.5) * SCRIPT_MARKET_REFILL_RULES.standard.conceptJitterSpread;
      const priceMultiplier =
        SCRIPT_MARKET_REFILL_RULES.standard.priceMultiplierBase +
        manager.eventRng() * SCRIPT_MARKET_REFILL_RULES.standard.priceMultiplierSpread;
      scriptQuality = clamp(source.scriptQuality + qualityJitter, 1, 9.9);
      conceptStrength = clamp(source.conceptStrength + conceptJitter, 1, 9.9);
      askingPrice = Math.max(25_000, Math.round(source.askingPrice * priceMultiplier));
    }

    const refreshed: ScriptPitch = {
      ...source,
      id: createId('script'),
      marketTier: tier,
      askingPrice,
      scriptQuality,
      conceptStrength,
      expiresInWeeks: 3 + Math.floor(manager.eventRng() * 4),
    };

    manager.scriptMarket.push(refreshed);
    existingTitles.add(refreshed.title);
    added += 1;
    weightedDemandAccumulator += typeof manager.getGenreDemandMultiplier === 'function' ? manager.getGenreDemandMultiplier(refreshed.genre) : 1;
    if (added > SCRIPT_MARKET_REFILL_RULES.refillSafetyCap) break;
  }

  if (added > 0) {
    const meanDemand = weightedDemandAccumulator / Math.max(1, added);
    const tilt =
      meanDemand >= SCRIPT_MARKET_REFILL_RULES.hotDemandTiltThreshold
        ? 'Market is chasing hotter audience cycles.'
        : meanDemand <= SCRIPT_MARKET_REFILL_RULES.coldDemandTiltThreshold
          ? 'Market is leaning into contrarian script bets.'
          : 'Market mix is balanced this week.';
    events.push(`${added} new script offer(s) entered the market. ${tilt}`);
  }
}

export function rollForCrisesForManager(manager: StudioManager, events: string[]): void {
  if (manager.generatedCrisisThisTurn) return;

  const weeksSinceLastGeneratedCrisis =
    manager.lastGeneratedCrisisWeek === null ? Number.POSITIVE_INFINITY : manager.currentWeek - manager.lastGeneratedCrisisWeek;
  const recentCrisisSuppression =
    weeksSinceLastGeneratedCrisis <= CRISIS_GENERATION_RULES.recentSuppressionWeeks
      ? CRISIS_GENERATION_RULES.recentSuppressionMultiplier
      : 1;

  for (const project of manager.activeProjects) {
    if (!['preProduction', 'production', 'postProduction'].includes(project.phase)) continue;
    const riskBoost = project.budget.overrunRisk * 0.2;
    const baseThreshold =
      project.phase === 'production'
        ? CRISIS_GENERATION_RULES.baseThresholdByPhase.production
        : project.phase === 'postProduction'
          ? CRISIS_GENERATION_RULES.baseThresholdByPhase.postProduction
          : CRISIS_GENERATION_RULES.baseThresholdByPhase.preProduction;
    const rollThreshold = (baseThreshold + riskBoost) * recentCrisisSuppression;
    if (manager.crisisRng() > rollThreshold) continue;

    const crisis = buildOperationalCrisisForManager(manager, project);
    manager.pendingCrises.push(crisis);
    project.productionStatus = 'inCrisis';
    manager.generatedCrisisThisTurn = true;
    manager.lastGeneratedCrisisWeek = manager.currentWeek;
    events.push('1 crisis event(s) triggered.');
    break;
  }
}

function buildContextSnapshot(manager: StudioManager): BuildDecisionContext {
  return {
    talentPool: manager.talentPool,
    activeProjects: manager.activeProjects,
    rivals: manager.rivals,
    reputation: manager.reputation,
    storyFlags: manager.storyFlags,
    cash: manager.cash,
    currentWeek: manager.currentWeek,
    studioTier: manager.studioTier,
    franchises: manager.franchises,
  };
}

export function generateEventDecisionsForManager(manager: StudioManager, events: string[]): void {
  if (manager.decisionQueue.length >= EVENT_GENERATION_RULES.maxQueuedDecisions) return;

  const queuedTitles = new Set(manager.decisionQueue.map((item) => item.title));
  const candidates = manager.eventDeck
    .filter((event: EventTemplate) => {
      if (manager.currentWeek < event.minWeek) return false;
      if (event.minStudioTier && !isTierMet(manager.studioTier, event.minStudioTier)) return false;
      if (event.maxStudioTier && isTierExceeded(manager.studioTier, event.maxStudioTier)) return false;
      if (queuedTitles.has(event.decisionTitle)) return false;
      if (event.requiresFlag && !hasStoryFlagForManager(manager, event.requiresFlag)) return false;
      if (event.blocksFlag && hasStoryFlagForManager(manager, event.blocksFlag)) return false;
      if (event.requiresArc && !matchesArcRequirementForManager(manager, event.requiresArc)) return false;
      if (event.blocksArc && matchesArcRequirementForManager(manager, event.blocksArc)) return false;
      const lastWeek = manager.lastEventWeek.get(event.id);
      if (lastWeek !== undefined && manager.currentWeek - lastWeek < event.cooldownWeeks) return false;
      return true;
    })
    .map((event: EventTemplate) => ({ event, weight: eventWeightForManager(manager, event) }))
    .filter((entry) => entry.weight > 0);

  const context = buildContextSnapshot(manager);

  for (let attempt = 0; attempt < Math.min(EVENT_GENERATION_RULES.maxPickAttempts, candidates.length); attempt++) {
    if (candidates.length === 0) break;

    const total = candidates.reduce((sum, item) => sum + item.weight, 0);
    let roll = manager.eventRng() * total;
    let picked: EventTemplate | null = null;
    let pickedIdx = -1;
    for (let i = 0; i < candidates.length; i++) {
      roll -= candidates[i].weight;
      if (roll <= 0) {
        picked = candidates[i].event;
        pickedIdx = i;
        break;
      }
    }
    if (!picked) {
      picked = candidates[candidates.length - 1].event;
      pickedIdx = candidates.length - 1;
    }

    const project = chooseProjectForEventForManager(manager, picked);
    if (picked.scope === 'project' && !project) {
      candidates.splice(pickedIdx, 1);
      continue;
    }

    const decision = picked.buildDecision({
      idFactory: createId,
      projectId: project?.id ?? null,
      projectTitle: project?.title ?? null,
      currentWeek: manager.currentWeek,
      context,
    });

    if (decision === null) {
      candidates.splice(pickedIdx, 1);
      continue;
    }

    decision.category ??= picked.category;
    decision.sourceEventId ??= picked.id;
    manager.decisionQueue.push(decision);
    manager.lastEventWeek.set(picked.id, manager.currentWeek);
    manager.recentDecisionCategories.unshift(picked.category);
    manager.recentDecisionCategories = manager.recentDecisionCategories.slice(0, 5);
    events.push(`New event: ${picked.title}.`);
    break;
  }
}

export function pickWeightedEventForManager(manager: StudioManager): EventTemplate | null {
  const queuedTitles = new Set(manager.decisionQueue.map((item) => item.title));
  const weighted = manager.eventDeck
    .filter((event: EventTemplate) => {
      if (manager.currentWeek < event.minWeek) return false;
      if (event.minStudioTier && !isTierMet(manager.studioTier, event.minStudioTier)) return false;
      if (event.maxStudioTier && isTierExceeded(manager.studioTier, event.maxStudioTier)) return false;
      if (queuedTitles.has(event.decisionTitle)) return false;
      if (event.requiresFlag && !hasStoryFlagForManager(manager, event.requiresFlag)) return false;
      if (event.blocksFlag && hasStoryFlagForManager(manager, event.blocksFlag)) return false;
      if (event.requiresArc && !matchesArcRequirementForManager(manager, event.requiresArc)) return false;
      if (event.blocksArc && matchesArcRequirementForManager(manager, event.blocksArc)) return false;
      const lastWeek = manager.lastEventWeek.get(event.id);
      if (lastWeek !== undefined && manager.currentWeek - lastWeek < event.cooldownWeeks) return false;
      return true;
    })
    .map((event: EventTemplate) => ({ event, weight: eventWeightForManager(manager, event) }))
    .filter((entry) => entry.weight > 0);

  if (weighted.length === 0) return null;

  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let roll = manager.eventRng() * total;
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.event;
  }
  return weighted[weighted.length - 1].event;
}

export function eventWeightForManager(manager: StudioManager, event: EventTemplate): number {
  let weight = event.baseWeight;
  const modifiers = manager.getArcOutcomeModifiers();
  const candidates = getEventProjectCandidatesForManager(manager, event);
  if (event.scope === 'project' && candidates.length === 0) return 0;

  if (event.scope === 'project') {
    weight += Math.min(EVENT_WEIGHT_RULES.projectScopeWeightCap, candidates.length * EVENT_WEIGHT_RULES.projectScopeWeightStep);
  }

  if (event.category === 'finance' && manager.cash < EVENT_WEIGHT_RULES.financeLowCashThreshold) {
    weight += EVENT_WEIGHT_RULES.financeWeightBonus;
  }
  if (event.category === 'marketing' && manager.studioHeat < EVENT_BALANCE.LOW_HEAT_MARKETING_WEIGHT_THRESHOLD) {
    weight += EVENT_WEIGHT_RULES.marketingLowHeatWeightBonus;
  }
  if (event.category === 'operations' && manager.pendingCrises.length > 0) {
    weight *= EVENT_WEIGHT_RULES.operationsActiveCrisisMultiplier;
  }
  weight += modifiers.categoryBias[event.category] ?? 0;

  const arcId = getEventArcIdForManager(manager, event);
  if (arcId) {
    weight += getArcPressureFromRivalsForManager(manager, arcId);
  }

  if (manager.recentDecisionCategories[0] === event.category) {
    weight *= EVENT_WEIGHT_RULES.repeatCategoryPenalty;
  }
  if (manager.recentDecisionCategories[0] === event.category && manager.recentDecisionCategories[1] === event.category) {
    weight *= EVENT_WEIGHT_RULES.repeatCategoryStackPenalty;
  }

  // Seasonal weight modifier
  const weekInYear = manager.currentWeek % 52;
  if (weekInYear >= SEASONAL_RULES.AWARDS_SEASON.startWeek && weekInYear <= SEASONAL_RULES.AWARDS_SEASON.endWeek) {
    if (event.category === 'marketing' || event.id.includes('award')) weight *= EVENT_WEIGHT_RULES.awardsSeasonMultiplier;
  }
  if (weekInYear >= SEASONAL_RULES.SUMMER_BLOCKBUSTER.startWeek && weekInYear <= SEASONAL_RULES.SUMMER_BLOCKBUSTER.endWeek) {
    if (event.category === 'marketing' || event.category === 'finance') weight *= EVENT_WEIGHT_RULES.summerCampaignMultiplier;
  }
  if (weekInYear >= SEASONAL_RULES.HOLIDAY_CORRIDOR.startWeek && weekInYear <= SEASONAL_RULES.HOLIDAY_CORRIDOR.endWeek) {
    if (event.category === 'operations') weight *= EVENT_WEIGHT_RULES.holidayOperationsMultiplier;
  }

  return weight;
}

export function getEventArcIdForManager(_manager: StudioManager, event: EventTemplate): string | null {
  return event.requiresArc?.id ?? event.blocksArc?.id ?? null;
}

export function getArcPressureFromRivalsForManager(manager: StudioManager, arcId: string): number {
  let pressure = 0;
  for (const rival of manager.rivals) {
    const profile = manager.getRivalBehaviorProfile(rival);
    pressure += profile.arcPressure[arcId] ?? 0;
  }
  return clamp(pressure / Math.max(1, manager.rivals.length), 0, 0.7);
}

export function getEventProjectCandidatesForManager(manager: StudioManager, event: EventTemplate): MovieProject[] {
  if (event.scope !== 'project') return [];
  if (!event.targetPhases || event.targetPhases.length === 0) {
    return manager.activeProjects.filter((project: MovieProject) => project.phase !== 'released');
  }
  return manager.activeProjects.filter((project: MovieProject) => event.targetPhases?.includes(project.phase));
}

export function chooseProjectForEventForManager(manager: StudioManager, event: EventTemplate): MovieProject | null {
  const candidates = getEventProjectCandidatesForManager(manager, event);
  if (candidates.length === 0) return null;
  const ranked = [...candidates].sort((a, b) => b.hypeScore - a.hypeScore);
  const selectionPool = ranked.slice(0, Math.min(3, ranked.length));
  const index = Math.floor(manager.eventRng() * selectionPool.length);
  return selectionPool[index] ?? selectionPool[0] ?? null;
}

export function hasStoryFlagForManager(manager: StudioManager, flag: string): boolean {
  return (manager.storyFlags[flag] ?? 0) > 0;
}

export function matchesArcRequirementForManager(
  manager: StudioManager,
  input: { id: string; minStage?: number; maxStage?: number; status?: 'active' | 'resolved' | 'failed' }
): boolean {
  const arc = manager.storyArcs[input.id];
  if (!arc) return false;
  if (input.status && arc.status !== input.status) return false;
  if (typeof input.minStage === 'number' && arc.stage < input.minStage) return false;
  if (typeof input.maxStage === 'number' && arc.stage > input.maxStage) return false;
  return true;
}

export function ensureArcStateForManager(manager: StudioManager, arcId: string): StoryArcState {
  if (!manager.storyArcs[arcId]) {
    manager.storyArcs[arcId] = {
      stage: 0,
      status: 'active',
      lastUpdatedWeek: manager.currentWeek,
    };
  }
  return manager.storyArcs[arcId];
}

export function applyArcMutationForManager(manager: StudioManager, arcId: string, option: DecisionItem['options'][number]): void {
  const arc = ensureArcStateForManager(manager, arcId);
  if (typeof option.setArcStage === 'number') {
    arc.stage = Math.max(0, option.setArcStage);
  }
  if (typeof option.advanceArcBy === 'number') {
    arc.stage = Math.max(0, arc.stage + option.advanceArcBy);
  }
  if (option.resolveArc) {
    arc.status = 'resolved';
  } else if (option.failArc) {
    arc.status = 'failed';
  } else {
    arc.status = 'active';
  }
  arc.lastUpdatedWeek = manager.currentWeek;
}

export function applyStoryFlagMutationsForManager(manager: StudioManager, setFlag?: string, clearFlag?: string): void {
  if (setFlag) {
    manager.storyFlags[setFlag] = (manager.storyFlags[setFlag] ?? 0) + 1;
  }
  if (clearFlag) {
    delete manager.storyFlags[clearFlag];
  }
}

export function getDecisionTargetProjectForManager(manager: StudioManager, decision: DecisionItem): MovieProject | null {
  if (decision.projectId) {
    return manager.activeProjects.find((item: MovieProject) => item.id === decision.projectId) ?? null;
  }
  const ranked = manager.activeProjects
    .filter((project: MovieProject) => project.phase !== 'released')
    .sort((a: MovieProject, b: MovieProject) => b.hypeScore - a.hypeScore);
  return ranked[0] ?? manager.activeProjects[0] ?? null;
}

export function buildOperationalCrisisForManager(manager: StudioManager, project: MovieProject): CrisisEvent {
  const sharedProductionTemplates = [
    {
      title: 'Key Talent Scheduling Conflict',
      body: 'A hard availability conflict puts next week production work at risk.',
      severity: project.productionStatus === 'atRisk' ? 'red' : 'orange',
      options: [
        {
          id: createId('c-opt'),
          label: 'Pay Overtime to Keep Schedule',
          preview: '-$450K now, no schedule slip.',
          cashDelta: -450_000,
          scheduleDelta: 0,
          hypeDelta: 0,
        },
        {
          id: createId('c-opt'),
          label: 'Delay One Week',
          preview: 'Save cash, but schedule slips and press chatter starts.',
          cashDelta: -50_000,
          scheduleDelta: 1,
          hypeDelta: -3,
        },
      ],
    },
  ] satisfies {
    title: string;
    body: string;
    severity: CrisisEvent['severity'];
    options: CrisisEvent['options'];
  }[];
  const liveActionProductionTemplates = [
    {
      title: 'Set Build Failure',
      body: 'A key practical set failed safety checks before principal photography.',
      severity: 'orange',
      options: [
        {
          id: createId('c-opt'),
          label: 'Rebuild Immediately',
          preview: '-$380K now, schedule protected.',
          cashDelta: -380_000,
          scheduleDelta: 0,
          hypeDelta: 0,
        },
        {
          id: createId('c-opt'),
          label: 'Rewrite Around Set',
          preview: 'Save cash, but lose one week and some excitement.',
          cashDelta: -90_000,
          scheduleDelta: 1,
          hypeDelta: -2,
        },
      ],
    },
    {
      title: 'Second Unit Incident',
      body: 'A second unit incident pauses action coverage for safety review.',
      severity: 'red',
      options: [
        {
          id: createId('c-opt'),
          label: 'Bring In Replacement Unit',
          preview: '-$520K now to hold momentum.',
          cashDelta: -520_000,
          scheduleDelta: 0,
          hypeDelta: -1,
        },
        {
          id: createId('c-opt'),
          label: 'Hold For Safety Reset',
          preview: 'Lower immediate spend, but lose two shooting weeks.',
          cashDelta: -120_000,
          scheduleDelta: 2,
          hypeDelta: -3,
        },
      ],
    },
  ] satisfies {
    title: string;
    body: string;
    severity: CrisisEvent['severity'];
    options: CrisisEvent['options'];
  }[];
  const animationProductionTemplates = [
    {
      title: 'Render Farm Outage',
      body: 'A render farm failure corrupted queued shots and stalled the pipeline.',
      severity: 'orange',
      options: [
        {
          id: createId('c-opt'),
          label: 'Rent Emergency Compute',
          preview: '-$340K now, protect delivery timing.',
          cashDelta: -340_000,
          scheduleDelta: 0,
          hypeDelta: 0,
        },
        {
          id: createId('c-opt'),
          label: 'Rebuild The Queue',
          preview: 'Spend less now, but lose one production week.',
          cashDelta: -110_000,
          scheduleDelta: 1,
          hypeDelta: -1,
        },
      ],
    },
    {
      title: 'Asset Pipeline Corruption',
      body: 'A versioning failure wiped approved animation assets from the latest build.',
      severity: 'orange',
      options: [
        {
          id: createId('c-opt'),
          label: 'Bring In Recovery Team',
          preview: '-$290K now, preserve the milestone.',
          cashDelta: -290_000,
          scheduleDelta: 0,
          hypeDelta: 0,
        },
        {
          id: createId('c-opt'),
          label: 'Rework The Sequence',
          preview: 'Lower spend, but schedule slips and buzz softens.',
          cashDelta: -80_000,
          scheduleDelta: 1,
          hypeDelta: -2,
        },
      ],
    },
  ] satisfies {
    title: string;
    body: string;
    severity: CrisisEvent['severity'];
    options: CrisisEvent['options'];
  }[];
  const phaseTemplates: {
    title: string;
    body: string;
    severity: CrisisEvent['severity'];
    options: CrisisEvent['options'];
  }[] =
    project.phase === 'preProduction'
      ? [
        {
          title: 'Location Permit Reversal',
          body: 'Primary location permits were rescinded. Prep schedule is at risk.',
          severity: 'orange',
          options: [
            {
              id: createId('c-opt'),
              label: 'Pay Fast-Track Permit Counsel',
              preview: '-$260K now, keep prep moving.',
              cashDelta: -260_000,
              scheduleDelta: 0,
              hypeDelta: 0,
            },
            {
              id: createId('c-opt'),
              label: 'Re-scout Alternate Locations',
              preview: 'Lower spend, but schedule slips one week.',
              cashDelta: -80_000,
              scheduleDelta: 1,
              hypeDelta: -1,
            },
          ],
        },
        {
          title: 'Department Head Walkout Threat',
          body: 'A key department requests contract revisions before lock.',
          severity: 'orange',
          options: [
            {
              id: createId('c-opt'),
              label: 'Approve Contract Bump',
              preview: '-$220K now, no delay.',
              cashDelta: -220_000,
              scheduleDelta: 0,
              hypeDelta: 0,
            },
            {
              id: createId('c-opt'),
              label: 'Re-negotiate Through Delay',
              preview: 'Save cash but lose one prep week and confidence.',
              cashDelta: -40_000,
              scheduleDelta: 1,
              hypeDelta: -2,
            },
          ],
        },
      ]
      : project.phase === 'postProduction'
        ? [
          {
            title: 'VFX Vendor Capacity Crunch',
            body: 'Your primary vendor lost capacity to a tentpole competitor.',
            severity: 'orange',
            options: [
              {
                id: createId('c-opt'),
                label: 'Pay For Priority Lane',
                preview: '-$300K now, lock delivery date.',
                cashDelta: -300_000,
                scheduleDelta: 0,
                hypeDelta: 0,
              },
              {
                id: createId('c-opt'),
                label: 'Delay Final Deliverables',
                preview: 'Smaller immediate cost, but post slips by one week.',
                cashDelta: -70_000,
                scheduleDelta: 1,
                hypeDelta: -2,
              },
            ],
          },
          {
            title: 'Score Recording Overrun',
            body: 'Orchestral sessions are exceeding booked stage time.',
            severity: 'yellow',
            options: [
              {
                id: createId('c-opt'),
                label: 'Extend Sessions',
                preview: '-$180K now, preserve score quality.',
                cashDelta: -180_000,
                scheduleDelta: 0,
                hypeDelta: 1,
              },
              {
                id: createId('c-opt'),
                label: 'Scale Back Arrangement',
                preview: 'Save cash, but lose some polish and buzz.',
                cashDelta: -40_000,
                scheduleDelta: 0,
                hypeDelta: -2,
              },
            ],
          },
        ]
        : [
          ...sharedProductionTemplates,
          ...(project.genre === 'animation' ? animationProductionTemplates : liveActionProductionTemplates),
        ];

  const selected = phaseTemplates[Math.floor(manager.crisisRng() * phaseTemplates.length)] ?? phaseTemplates[0];
  return {
    id: createId('crisis'),
    projectId: project.id,
    kind: 'production',
    title: `${project.title}: ${selected.title}`,
    severity: selected.severity,
    body: `${project.title} is affected. ${selected.body}`,
    options: selected.options,
  };
}
