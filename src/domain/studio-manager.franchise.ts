import { PROJECT_BALANCE } from './balance-constants';
import { createId } from './id';
import type {
  FranchiseStatusSnapshot,
  FranchiseProjectionModifiers,
  FranchiseStrategy,
  FranchiseTrack,
  MovieProject,
  SequelCandidate,
  SequelEligibility,
} from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toRomanNumeral(value: number): string {
  const numerals: [number, string][] = [
    [10, 'X'],
    [9, 'IX'],
    [8, 'VIII'],
    [7, 'VII'],
    [6, 'VI'],
    [5, 'V'],
    [4, 'IV'],
    [3, 'III'],
    [2, 'II'],
    [1, 'I'],
  ];
  let remaining = Math.max(1, Math.floor(value));
  let output = '';
  for (const [amount, glyph] of numerals) {
    while (remaining >= amount) {
      output += glyph;
      remaining -= amount;
    }
  }
  return output || 'I';
}

function deriveMomentum(base: MovieProject, priorFatigue: number): number {
  const audience = base.audienceScore ?? 50;
  const critics = base.criticalScore ?? 50;
  const roi = base.projectedROI ?? 1;
  return clamp(
    46 + (audience - 50) * 0.55 + (critics - 50) * 0.28 + (roi - 1) * 18 - priorFatigue * 0.18,
    10,
    95
  );
}

function deriveFatigue(base: MovieProject, priorFatigue: number, priorReleases: number): number {
  const audience = base.audienceScore ?? 50;
  return clamp(
    priorFatigue * 0.62 + Math.max(0, priorReleases - 1) * 11 + Math.max(0, 58 - audience) * 0.35 + base.controversy * 0.12,
    0,
    88
  );
}

function deriveCarryoverHype(base: MovieProject, projectedMomentum: number, projectedFatigue: number): number {
  const audience = base.audienceScore ?? 50;
  return clamp(
    base.hypeScore * 0.55 + audience * 0.18 + projectedMomentum * 0.22 - projectedFatigue * 0.24,
    8,
    78
  );
}

function deriveUpfrontSequelCost(genre: MovieProject['genre']): number {
  const baseline = PROJECT_BALANCE.INITIAL_BUDGET_BY_GENRE[genre];
  return Math.round(baseline * 0.035 + 220_000);
}

const FRANCHISE_STRATEGY_COST: Record<Exclude<FranchiseStrategy, 'none'>, number> = {
  safe: 90_000,
  balanced: 0,
  reinvention: 220_000,
};

const FRANCHISE_OPS_BALANCE = {
  BRAND_RESET_BASE_COST: 150_000,
  BRAND_RESET_STEP_COST: 40_000,
  LEGACY_CASTING_BASE_COST: 130_000,
  LEGACY_CASTING_STEP_COST: 35_000,
  HIATUS_PLAN_BASE_COST: 90_000,
  HIATUS_PLAN_STEP_COST: 20_000,
} as const;

const FRANCHISE_FLAG_LABELS: Record<string, string> = {
  franchise_rights: 'Sequel Rights Secured',
  franchise_room: 'Universe Room Active',
  franchise_committed: 'Franchise-Committed Studio',
  franchise_legacy_reviewed: 'Legacy Audit Complete',
  franchise_original_director: 'Original Director Reattached',
  franchise_fatigue_warning: 'Fatigue Warning Active',
  franchise_spinoff_active: 'Spinoff In Development',
  legacy_anchor_retired: 'Legacy Anchor Retired',
  franchise_merch_deal: 'Exclusive Merchandise Deal',
  franchise_global_campaign: 'Global Roadshow Campaign',
  franchise_brand_reset: 'Brand Reset Program Active',
  franchise_legacy_campaign: 'Legacy Casting Campaign Active',
  franchise_hiatus_plan: 'Hiatus Planning Active',
};

function nextBrandResetCost(count: number): number {
  return FRANCHISE_OPS_BALANCE.BRAND_RESET_BASE_COST + Math.max(0, count) * FRANCHISE_OPS_BALANCE.BRAND_RESET_STEP_COST;
}

function nextLegacyCastingCost(count: number): number {
  return FRANCHISE_OPS_BALANCE.LEGACY_CASTING_BASE_COST + Math.max(0, count) * FRANCHISE_OPS_BALANCE.LEGACY_CASTING_STEP_COST;
}

function nextHiatusPlanCost(count: number): number {
  return FRANCHISE_OPS_BALANCE.HIATUS_PLAN_BASE_COST + Math.max(0, count) * FRANCHISE_OPS_BALANCE.HIATUS_PLAN_STEP_COST;
}

function cadencePressureFromGap(
  lastReleaseWeek: number | null,
  projectedReleaseWeek: number,
  cadenceBufferWeeks: number
): { effectiveGapWeeks: number; cadencePressure: number } {
  if (!lastReleaseWeek || projectedReleaseWeek <= lastReleaseWeek) {
    const effectiveGapWeeks = 26 + cadenceBufferWeeks;
    return { effectiveGapWeeks, cadencePressure: 0 };
  }
  const rawGapWeeks = projectedReleaseWeek - lastReleaseWeek;
  const effectiveGapWeeks = Math.max(1, rawGapWeeks + cadenceBufferWeeks);
  const cadencePressure = clamp((22 - effectiveGapWeeks) / 14, 0, 1.6);
  return { effectiveGapWeeks, cadencePressure };
}

function episodePressure(episode: number): number {
  const depth = Math.max(0, episode - 2);
  return clamp(depth * 0.42 + Math.max(0, depth - 1) * 0.5, 0, 2.6);
}

function getProjectFranchiseTrack(manager: any, project: MovieProject): FranchiseTrack | null {
  if (!project.franchiseId) return null;
  return manager.franchises.find((item: FranchiseTrack) => item.id === project.franchiseId) ?? null;
}

function ensureFranchiseForBase(manager: any, baseProject: MovieProject): FranchiseTrack {
  if (baseProject.franchiseId) {
    const existing = manager.franchises.find((item: FranchiseTrack) => item.id === baseProject.franchiseId);
    if (existing) {
      existing.cadenceBufferWeeks = clamp(existing.cadenceBufferWeeks ?? 0, 0, 40);
      existing.brandResetCount = Math.max(0, Math.round(existing.brandResetCount ?? 0));
      existing.legacyCastingCampaignCount = Math.max(0, Math.round(existing.legacyCastingCampaignCount ?? 0));
      existing.hiatusPlanCount = Math.max(0, Math.round(existing.hiatusPlanCount ?? 0));
      return existing;
    }
  }

  const initialMomentum = deriveMomentum(baseProject, 8);
  const initialFatigue = deriveFatigue(baseProject, 8, 1);
  const franchise: FranchiseTrack = {
    id: createId('franchise'),
    name: baseProject.title,
    genre: baseProject.genre,
    rootProjectId: baseProject.id,
    projectIds: [baseProject.id],
    releasedProjectIds: [baseProject.id],
    activeProjectId: null,
    momentum: initialMomentum,
    fatigue: initialFatigue,
    lastReleaseWeek: baseProject.releaseWeek ?? manager.currentWeek,
    cadenceBufferWeeks: 0,
    brandResetCount: 0,
    legacyCastingCampaignCount: 0,
    hiatusPlanCount: 0,
  };
  baseProject.franchiseId = franchise.id;
  baseProject.franchiseEpisode = baseProject.franchiseEpisode ?? 1;
  baseProject.sequelToProjectId = null;
  baseProject.franchiseCarryoverHype = baseProject.franchiseCarryoverHype ?? 0;
  baseProject.franchiseStrategy = baseProject.franchiseStrategy ?? 'none';
  manager.franchises.push(franchise);
  return franchise;
}

function maxEpisodeInFranchise(manager: any, franchise: FranchiseTrack): number {
  let maxEpisode = 1;
  for (const projectId of franchise.projectIds) {
    const project = manager.activeProjects.find((item: MovieProject) => item.id === projectId);
    if (!project || !project.franchiseEpisode) continue;
    maxEpisode = Math.max(maxEpisode, project.franchiseEpisode);
  }
  return maxEpisode;
}

export function getSequelEligibilityForManager(manager: any, projectId: string): SequelEligibility | null {
  const baseProject = manager.activeProjects.find((item: MovieProject) => item.id === projectId) as MovieProject | undefined;
  if (!baseProject) return null;

  const fallback: Omit<SequelEligibility, 'eligible'> = {
    projectId: baseProject.id,
    franchiseId: baseProject.franchiseId,
    nextEpisode: 2,
    projectedMomentum: 40,
    projectedFatigue: 12,
    upfrontCost: deriveUpfrontSequelCost(baseProject.genre),
    carryoverHype: 12,
  };

  if (baseProject.phase !== 'released' || !baseProject.releaseResolved) {
    return {
      ...fallback,
      eligible: false,
      reason: 'Only fully resolved released projects can spawn sequels.',
    };
  }

  const existingFranchise = baseProject.franchiseId
    ? manager.franchises.find((item: FranchiseTrack) => item.id === baseProject.franchiseId)
    : null;
  const priorReleases = Math.max(1, existingFranchise?.releasedProjectIds.length ?? 1);
  const priorFatigue = existingFranchise?.fatigue ?? 8;
  const projectedMomentum = deriveMomentum(baseProject, priorFatigue);
  const projectedFatigue = deriveFatigue(baseProject, priorFatigue, priorReleases);
  const carryoverHype = deriveCarryoverHype(baseProject, projectedMomentum, projectedFatigue);
  const upfrontCost = deriveUpfrontSequelCost(baseProject.genre);
  const nextEpisode = existingFranchise ? maxEpisodeInFranchise(manager, existingFranchise) + 1 : 2;

  if (existingFranchise) {
    const activeFranchiseProject = manager.activeProjects.find(
      (item: MovieProject) => item.franchiseId === existingFranchise.id && item.phase !== 'released'
    );
    if (activeFranchiseProject) {
      return {
        projectId: baseProject.id,
        franchiseId: existingFranchise.id,
        nextEpisode,
        projectedMomentum,
        projectedFatigue,
        upfrontCost,
        carryoverHype,
        eligible: false,
        reason: `Finish ${activeFranchiseProject.title} before opening another sequel.`,
      };
    }
  }

  if (manager.cash < upfrontCost) {
    return {
      projectId: baseProject.id,
      franchiseId: existingFranchise?.id ?? null,
      nextEpisode,
      projectedMomentum,
      projectedFatigue,
      upfrontCost,
      carryoverHype,
      eligible: false,
      reason: `Need $${Math.round(upfrontCost / 1000)}K cash to open sequel development.`,
    };
  }

  return {
    projectId: baseProject.id,
    franchiseId: existingFranchise?.id ?? null,
    nextEpisode,
    projectedMomentum,
    projectedFatigue,
    upfrontCost,
    carryoverHype,
    eligible: true,
  };
}

export function getSequelCandidatesForManager(manager: any): SequelCandidate[] {
  return manager.activeProjects
    .filter((project: MovieProject) => project.phase === 'released')
    .map((project: MovieProject) => {
      const eligibility = getSequelEligibilityForManager(manager, project.id);
      if (!eligibility) return null;
      return {
        title: project.title,
        genre: project.genre,
        ...eligibility,
      } satisfies SequelCandidate;
    })
    .filter((item: SequelCandidate | null): item is SequelCandidate => !!item)
    .sort((a: SequelCandidate, b: SequelCandidate) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      return b.projectedMomentum - a.projectedMomentum;
    });
}

export function startSequelForManager(
  manager: any,
  baseProjectId: string
): { success: boolean; message: string; projectId?: string } {
  const baseProject = manager.activeProjects.find((item: MovieProject) => item.id === baseProjectId) as MovieProject | undefined;
  if (!baseProject) return { success: false, message: 'Base project not found.' };

  const eligibility = getSequelEligibilityForManager(manager, baseProjectId);
  if (!eligibility) return { success: false, message: 'Unable to evaluate sequel eligibility.' };
  if (!eligibility.eligible) return { success: false, message: eligibility.reason ?? 'Sequel not available.' };

  let franchise = eligibility.franchiseId
    ? manager.franchises.find((item: FranchiseTrack) => item.id === eligibility.franchiseId)
    : null;
  if (!franchise) {
    franchise = ensureFranchiseForBase(manager, baseProject);
  } else {
    franchise.cadenceBufferWeeks = clamp(franchise.cadenceBufferWeeks ?? 0, 0, 40);
    franchise.brandResetCount = Math.max(0, Math.round(franchise.brandResetCount ?? 0));
    franchise.legacyCastingCampaignCount = Math.max(0, Math.round(franchise.legacyCastingCampaignCount ?? 0));
    franchise.hiatusPlanCount = Math.max(0, Math.round(franchise.hiatusPlanCount ?? 0));
  }

  const sequelNumber = eligibility.nextEpisode;
  const sequelTitle = `${franchise.name} ${toRomanNumeral(sequelNumber)}`;
  const budgetBase = PROJECT_BALANCE.INITIAL_BUDGET_BY_GENRE[baseProject.genre];
  const budgetMultiplier = clamp(0.9 + eligibility.projectedMomentum / 180 - eligibility.projectedFatigue / 260, 0.75, 1.25);
  const ceiling = Math.round(budgetBase * budgetMultiplier);
  const scriptQuality = clamp(
    baseProject.scriptQuality * 0.72 + (baseProject.criticalScore ?? 60) * 0.028 - eligibility.projectedFatigue * 0.01 + 0.45,
    5.5,
    8.8
  );
  const conceptStrength = clamp(baseProject.conceptStrength * 0.86 + 0.75 - eligibility.projectedFatigue * 0.008, 5.2, 9.1);

  manager.adjustCash(-eligibility.upfrontCost);

  const sequel: MovieProject = {
    id: createId('project'),
    title: sequelTitle,
    genre: baseProject.genre,
    phase: 'development',
    budget: {
      ceiling,
      aboveTheLine: ceiling * 0.3,
      belowTheLine: ceiling * 0.5,
      postProduction: ceiling * 0.15,
      contingency: ceiling * 0.1,
      overrunRisk: clamp(baseProject.budget.overrunRisk * 0.92 + 0.04, 0.12, 0.62),
      actualSpend: eligibility.upfrontCost,
    },
    scriptQuality,
    conceptStrength,
    editorialScore: 5,
    postPolishPasses: 0,
    directorId: null,
    castIds: [],
    productionStatus: 'onTrack',
    scheduledWeeksRemaining: 6,
    hypeScore: eligibility.carryoverHype,
    marketingBudget: 0,
    releaseWindow: null,
    releaseWeek: null,
    distributionPartner: null,
    studioRevenueShare: 0.52,
    projectedROI: clamp(baseProject.projectedROI * (1.02 - eligibility.projectedFatigue * 0.003), 0.75, 2.8),
    openingWeekendGross: null,
    weeklyGrossHistory: [],
    releaseWeeksRemaining: 0,
    releaseResolved: false,
    finalBoxOffice: null,
    criticalScore: null,
    audienceScore: null,
    awardsNominations: 0,
    awardsWins: 0,
    festivalStatus: 'none',
    festivalTarget: null,
    festivalSubmissionWeek: null,
    festivalResolutionWeek: null,
    festivalBuzz: 0,
    prestige: clamp(Math.round(baseProject.prestige * 0.84 + 8 - eligibility.projectedFatigue * 0.08), 0, 100),
    commercialAppeal: clamp(Math.round(baseProject.commercialAppeal * 0.9 + eligibility.projectedMomentum * 0.18), 0, 100),
    originality: clamp(Math.round(baseProject.originality * 0.82 - Math.max(0, sequelNumber - 2) * 3), 0, 100),
    controversy: clamp(Math.round(baseProject.controversy * 0.9), 0, 100),
    franchiseId: franchise.id,
    franchiseEpisode: sequelNumber,
    sequelToProjectId: baseProject.id,
    franchiseCarryoverHype: eligibility.carryoverHype,
    franchiseStrategy: 'balanced',
    adaptedFromIpId: baseProject.adaptedFromIpId ?? null,
  };

  manager.activeProjects.push(sequel);
  franchise.projectIds = Array.from(new Set([...franchise.projectIds, baseProject.id, sequel.id]));
  franchise.releasedProjectIds = Array.from(new Set([...franchise.releasedProjectIds, baseProject.id]));
  franchise.activeProjectId = sequel.id;
  franchise.momentum = clamp(Math.round((franchise.momentum * 0.5 + eligibility.projectedMomentum * 0.5) * 10) / 10, 8, 95);
  franchise.fatigue = clamp(Math.round((franchise.fatigue * 0.45 + eligibility.projectedFatigue * 0.55 + 6) * 10) / 10, 0, 92);
  franchise.lastReleaseWeek = baseProject.releaseWeek ?? manager.currentWeek;

  return {
    success: true,
    message: `Sequel greenlit: ${sequel.title}. Development opened for $${Math.round(eligibility.upfrontCost / 1000)}K.`,
    projectId: sequel.id,
  };
}

function strategyOpeningBonus(strategy: FranchiseStrategy): number {
  if (strategy === 'safe') return 0.08;
  if (strategy === 'reinvention') return -0.05;
  return 0;
}

function strategyCriticalBonus(strategy: FranchiseStrategy): number {
  if (strategy === 'safe') return -2;
  if (strategy === 'reinvention') return 4;
  return 0;
}

function strategyAudienceBonus(strategy: FranchiseStrategy): number {
  if (strategy === 'safe') return 5;
  if (strategy === 'reinvention') return -2;
  return 0;
}

export function getFranchiseProjectionModifiersForManager(
  manager: any,
  project: MovieProject,
  projectedReleaseWeek?: number
): FranchiseProjectionModifiers {
  const strategy = project.franchiseStrategy ?? (project.franchiseId ? 'balanced' : 'none');
  const episode = Math.max(1, project.franchiseEpisode ?? 1);
  if (!project.franchiseId) {
    return {
      momentum: 50,
      fatigue: 0,
      strategy: 'none',
      episode,
      effectiveGapWeeks: 26,
      cadencePressure: 0,
      structuralPressure: 0,
      returningDirector: false,
      returningCastCount: 0,
      openingMultiplier: 1,
      roiMultiplier: 1,
      openingPenaltyPct: 0,
      roiPenaltyPct: 0,
      criticalDelta: 0,
      audienceDelta: 0,
    };
  }

  const franchise = getProjectFranchiseTrack(manager, project);
  const momentum = franchise?.momentum ?? 50;
  const fatigue = franchise?.fatigue ?? 8;
  const cadenceBufferWeeks = clamp(Math.round(franchise?.cadenceBufferWeeks ?? 0), 0, 40);
  const releaseWeek = Math.max(manager.currentWeek + 1, Math.round(projectedReleaseWeek ?? project.releaseWeek ?? manager.currentWeek + 4));
  const cadence = cadencePressureFromGap(franchise?.lastReleaseWeek ?? null, releaseWeek, cadenceBufferWeeks);
  const structuralPressure = clamp(episodePressure(episode) + cadence.cadencePressure, 0, 4.2);
  const openingPenaltyPct = clamp(structuralPressure * 0.08, 0, 0.34);
  const roiPenaltyPct = clamp(structuralPressure * 0.1, 0, 0.4);
  const predecessor = project.sequelToProjectId
    ? manager.activeProjects.find((item: MovieProject) => item.id === project.sequelToProjectId)
    : null;

  const returningDirector =
    !!(project.directorId && predecessor?.directorId && project.directorId === predecessor.directorId);
  const returningCastCount = predecessor
    ? project.castIds.filter((idValue: string) => predecessor.castIds.includes(idValue)).length
    : 0;

  const openingMultiplier = clamp(
    1 +
      (momentum - 50) * 0.006 +
      -fatigue * 0.0045 +
      strategyOpeningBonus(strategy) +
      (returningDirector ? 0.06 : 0) +
      Math.min(2, returningCastCount) * 0.03 -
      openingPenaltyPct,
    0.62,
    1.45
  );
  const roiMultiplier = clamp(1 - roiPenaltyPct, 0.6, 1.12);
  const criticalDelta = clamp(
    (momentum - 50) * 0.08 +
      -fatigue * 0.06 +
      strategyCriticalBonus(strategy) +
      (returningDirector ? 1.5 : 0) +
      Math.min(2, returningCastCount) * 0.7 +
      -structuralPressure * 1.4,
    -16,
    18
  );
  const audienceDelta = clamp(
    (momentum - 50) * 0.09 +
      -fatigue * 0.07 +
      strategyAudienceBonus(strategy) +
      (returningDirector ? 2 : 0) +
      Math.min(2, returningCastCount) * 1 +
      -structuralPressure * 2.3,
    -20,
    20
  );

  return {
    momentum,
    fatigue,
    strategy,
    episode,
    effectiveGapWeeks: cadence.effectiveGapWeeks,
    cadencePressure: cadence.cadencePressure,
    structuralPressure,
    returningDirector,
    returningCastCount,
    openingMultiplier,
    roiMultiplier,
    openingPenaltyPct,
    roiPenaltyPct,
    criticalDelta,
    audienceDelta,
  };
}

export function setFranchiseStrategyForManager(
  manager: any,
  projectId: string,
  strategy: Exclude<FranchiseStrategy, 'none'>
): { success: boolean; message: string } {
  const project = manager.activeProjects.find((item: MovieProject) => item.id === projectId);
  if (!project) return { success: false, message: 'Project not found.' };
  if (!project.franchiseId || !project.franchiseEpisode || project.franchiseEpisode <= 1) {
    return { success: false, message: 'Franchise strategy only applies to sequel projects.' };
  }
  if (project.phase !== 'development' && project.phase !== 'preProduction') {
    return { success: false, message: 'Franchise strategy can only be set during development or pre-production.' };
  }

  const currentStrategy = project.franchiseStrategy ?? 'balanced';
  if (currentStrategy === strategy) {
    return { success: true, message: `${project.title} is already set to ${strategy}.` };
  }
  if (currentStrategy !== 'balanced') {
    return {
      success: false,
      message: `Franchise strategy is locked after first commitment (${currentStrategy}).`,
    };
  }

  const cost = FRANCHISE_STRATEGY_COST[strategy];
  if (cost > 0 && manager.cash < cost) {
    return { success: false, message: `Insufficient cash to set ${strategy} strategy (${Math.round(cost / 1000)}K needed).` };
  }
  if (cost > 0) {
    manager.adjustCash(-cost);
  }

  if (strategy === 'safe') {
    project.commercialAppeal = clamp(project.commercialAppeal + 6, 0, 100);
    project.originality = clamp(project.originality - 4, 0, 100);
    project.hypeScore = clamp(project.hypeScore + 3, 0, 100);
    project.controversy = clamp(project.controversy - 2, 0, 100);
  } else if (strategy === 'reinvention') {
    project.scriptQuality = clamp(project.scriptQuality + 0.4, 0, 10);
    project.originality = clamp(project.originality + 10, 0, 100);
    project.prestige = clamp(project.prestige + 6, 0, 100);
    project.commercialAppeal = clamp(project.commercialAppeal - 4, 0, 100);
    project.controversy = clamp(project.controversy + 3, 0, 100);
  }

  project.franchiseStrategy = strategy;
  manager.evaluateBankruptcy?.();
  return {
    success: true,
    message:
      strategy === 'safe'
        ? `Set ${project.title} to Safe Continuation. Familiar beats prioritized.`
        : `Set ${project.title} to Reinvention. Risky creative reset greenlit.`,
  };
}

export function runFranchiseBrandResetForManager(
  manager: any,
  projectId: string
): { success: boolean; message: string } {
  const project = manager.activeProjects.find((item: MovieProject) => item.id === projectId) as MovieProject | undefined;
  if (!project) return { success: false, message: 'Project not found.' };
  if (!project.franchiseId || (project.franchiseEpisode ?? 0) <= 1) {
    return { success: false, message: 'Brand reset is available for sequel entries only.' };
  }
  if (project.phase !== 'development' && project.phase !== 'preProduction') {
    return { success: false, message: 'Brand reset is only available in development or pre-production.' };
  }

  const franchise = getProjectFranchiseTrack(manager, project);
  if (!franchise) return { success: false, message: 'Franchise record not found.' };

  const priorCount = Math.max(0, franchise.brandResetCount ?? 0);
  const cost = nextBrandResetCost(priorCount);
  if (manager.cash < cost) {
    return { success: false, message: `Insufficient cash for brand reset (${Math.round(cost / 1000)}K needed).` };
  }

  const fatigueRelief = clamp(10 - priorCount * 2, 4, 10);
  const momentumTradeoff = clamp(2 + priorCount, 2, 6);

  manager.adjustCash(-cost);
  franchise.fatigue = clamp(franchise.fatigue - fatigueRelief, 0, 92);
  franchise.momentum = clamp(franchise.momentum - momentumTradeoff, 8, 95);
  franchise.brandResetCount = priorCount + 1;
  project.scriptQuality = clamp(project.scriptQuality + 0.2, 0, 10);
  project.originality = clamp(project.originality + 4, 0, 100);
  project.hypeScore = clamp(project.hypeScore - 2, 0, 100);
  manager.storyFlags.franchise_brand_reset = (manager.storyFlags.franchise_brand_reset ?? 0) + 1;
  manager.evaluateBankruptcy?.();

  return {
    success: true,
    message: `Brand reset executed on ${franchise.name}. Fatigue -${fatigueRelief.toFixed(0)}, momentum -${momentumTradeoff.toFixed(0)}.`,
  };
}

export function runFranchiseLegacyCastingCampaignForManager(
  manager: any,
  projectId: string
): { success: boolean; message: string } {
  const project = manager.activeProjects.find((item: MovieProject) => item.id === projectId) as MovieProject | undefined;
  if (!project) return { success: false, message: 'Project not found.' };
  if (!project.franchiseId || (project.franchiseEpisode ?? 0) <= 1) {
    return { success: false, message: 'Legacy casting campaign is available for sequel entries only.' };
  }
  if (project.phase === 'released') {
    return { success: false, message: 'Legacy casting campaign is unavailable after release.' };
  }

  const franchise = getProjectFranchiseTrack(manager, project);
  if (!franchise) return { success: false, message: 'Franchise record not found.' };

  const priorCount = Math.max(0, franchise.legacyCastingCampaignCount ?? 0);
  const cost = nextLegacyCastingCost(priorCount);
  if (manager.cash < cost) {
    return { success: false, message: `Insufficient cash for legacy campaign (${Math.round(cost / 1000)}K needed).` };
  }

  const hypeBoost = clamp(5 - priorCount, 2, 5);
  const momentumBoost = clamp(3 - priorCount, 1, 3);
  const fatigueLift = clamp(2 + Math.floor(priorCount / 2), 2, 4);

  manager.adjustCash(-cost);
  franchise.momentum = clamp(franchise.momentum + momentumBoost, 8, 95);
  franchise.fatigue = clamp(franchise.fatigue + fatigueLift, 0, 92);
  franchise.legacyCastingCampaignCount = priorCount + 1;
  project.hypeScore = clamp(project.hypeScore + hypeBoost, 0, 100);
  project.commercialAppeal = clamp(project.commercialAppeal + 3, 0, 100);
  project.originality = clamp(project.originality - 2, 0, 100);
  manager.storyFlags.franchise_legacy_campaign = (manager.storyFlags.franchise_legacy_campaign ?? 0) + 1;
  manager.evaluateBankruptcy?.();

  return {
    success: true,
    message: `Legacy casting campaign launched for ${franchise.name}. Hype +${hypeBoost.toFixed(0)}, fatigue +${fatigueLift.toFixed(0)}.`,
  };
}

export function runFranchiseHiatusPlanningForManager(
  manager: any,
  projectId: string
): { success: boolean; message: string } {
  const project = manager.activeProjects.find((item: MovieProject) => item.id === projectId) as MovieProject | undefined;
  if (!project) return { success: false, message: 'Project not found.' };
  if (!project.franchiseId || (project.franchiseEpisode ?? 0) <= 1) {
    return { success: false, message: 'Hiatus planning is available for sequel entries only.' };
  }
  if (project.phase === 'production' || project.phase === 'released') {
    return { success: false, message: 'Hiatus planning is only available before production lock or during distribution planning.' };
  }

  const franchise = getProjectFranchiseTrack(manager, project);
  if (!franchise) return { success: false, message: 'Franchise record not found.' };

  const priorCount = Math.max(0, franchise.hiatusPlanCount ?? 0);
  const cost = nextHiatusPlanCost(priorCount);
  if (manager.cash < cost) {
    return { success: false, message: `Insufficient cash for hiatus plan (${Math.round(cost / 1000)}K needed).` };
  }

  const bufferGain = clamp(10 - priorCount * 2, 4, 10);
  const momentumTradeoff = clamp(2 + Math.floor(priorCount / 2), 2, 5);
  const fatigueRelief = clamp(3 - Math.floor(priorCount / 2), 1, 3);

  manager.adjustCash(-cost);
  franchise.cadenceBufferWeeks = clamp((franchise.cadenceBufferWeeks ?? 0) + bufferGain, 0, 40);
  franchise.momentum = clamp(franchise.momentum - momentumTradeoff, 8, 95);
  franchise.fatigue = clamp(franchise.fatigue - fatigueRelief, 0, 92);
  franchise.hiatusPlanCount = priorCount + 1;
  project.hypeScore = clamp(project.hypeScore - 1, 0, 100);
  manager.storyFlags.franchise_hiatus_plan = (manager.storyFlags.franchise_hiatus_plan ?? 0) + 1;
  manager.evaluateBankruptcy?.();

  return {
    success: true,
    message: `Hiatus plan logged for ${franchise.name}. Cadence buffer +${bufferGain.toFixed(0)}w.`,
  };
}

export function getFranchiseStatusForManager(manager: any, projectId: string): FranchiseStatusSnapshot | null {
  const project = manager.activeProjects.find((item: MovieProject) => item.id === projectId) as MovieProject | undefined;
  if (!project?.franchiseId) return null;
  const franchise = getProjectFranchiseTrack(manager, project);
  if (!franchise) return null;

  const projectedReleaseWeek = Math.max(manager.currentWeek + 1, Math.round(project.releaseWeek ?? manager.currentWeek + 4));
  const modifiers = getFranchiseProjectionModifiersForManager(manager, project, projectedReleaseWeek);
  const activeFlags = Object.entries(FRANCHISE_FLAG_LABELS)
    .filter(([flag]) => (manager.storyFlags?.[flag] ?? 0) > 0)
    .map(([, label]) => label);

  return {
    franchiseId: franchise.id,
    franchiseName: franchise.name,
    episode: Math.max(1, project.franchiseEpisode ?? 1),
    releasedEntries: Math.max(1, franchise.releasedProjectIds.length),
    momentum: franchise.momentum,
    fatigue: franchise.fatigue,
    lastReleaseWeek: franchise.lastReleaseWeek,
    projectedReleaseWeek,
    cadenceBufferWeeks: franchise.cadenceBufferWeeks ?? 0,
    brandResetCount: franchise.brandResetCount ?? 0,
    legacyCastingCampaignCount: franchise.legacyCastingCampaignCount ?? 0,
    hiatusPlanCount: franchise.hiatusPlanCount ?? 0,
    activeFlags,
    modifiers,
    nextBrandResetCost: nextBrandResetCost(franchise.brandResetCount ?? 0),
    nextLegacyCastingCampaignCost: nextLegacyCastingCost(franchise.legacyCastingCampaignCount ?? 0),
    nextHiatusPlanCost: nextHiatusPlanCost(franchise.hiatusPlanCount ?? 0),
  };
}

export function markFranchiseReleaseForManager(manager: any, projectId: string): void {
  const project = manager.activeProjects.find((item: MovieProject) => item.id === projectId) as MovieProject | undefined;
  if (!project?.franchiseId) return;
  const franchise = manager.franchises.find((item: FranchiseTrack) => item.id === project.franchiseId);
  if (!franchise) return;

  franchise.projectIds = Array.from(new Set([...franchise.projectIds, project.id]));
  franchise.releasedProjectIds = Array.from(new Set([...franchise.releasedProjectIds, project.id]));
  franchise.activeProjectId = franchise.activeProjectId === project.id ? null : franchise.activeProjectId;
  const cadenceSnapshot = cadencePressureFromGap(franchise.lastReleaseWeek, manager.currentWeek, franchise.cadenceBufferWeeks ?? 0);
  const episode = Math.max(1, project.franchiseEpisode ?? 1);
  const structuralPressure = clamp(episodePressure(episode) + cadenceSnapshot.cadencePressure, 0, 4.2);
  franchise.lastReleaseWeek = manager.currentWeek;

  const audience = project.audienceScore ?? 50;
  const critics = project.criticalScore ?? 50;
  franchise.momentum = clamp(
    Math.round((franchise.momentum * 0.4 + audience * 0.42 + critics * 0.18 - structuralPressure * 1.6) * 10) / 10,
    8,
    95
  );
  franchise.fatigue = clamp(
    Math.round(
      (franchise.fatigue * 0.68 +
        9 +
        Math.max(0, 60 - audience) * 0.25 +
        project.controversy * 0.08 +
        structuralPressure * 5.5) *
        10
    ) / 10,
    0,
    92
  );
  franchise.cadenceBufferWeeks = clamp(Math.round((franchise.cadenceBufferWeeks ?? 0) * 0.45), 0, 40);
}

export function removeProjectFromFranchiseForManager(manager: any, projectId: string): void {
  const project = manager.activeProjects.find((item: MovieProject) => item.id === projectId) as MovieProject | undefined;
  if (!project?.franchiseId) return;
  const franchise = manager.franchises.find((item: FranchiseTrack) => item.id === project.franchiseId);
  if (!franchise) return;

  franchise.projectIds = franchise.projectIds.filter((idValue: string) => idValue !== project.id);
  franchise.releasedProjectIds = franchise.releasedProjectIds.filter((idValue: string) => idValue !== project.id);
  if (franchise.activeProjectId === project.id) {
    franchise.activeProjectId = null;
  }
  if (franchise.rootProjectId === project.id) {
    franchise.rootProjectId = franchise.projectIds[0] ?? franchise.rootProjectId;
  }

  if (franchise.projectIds.length === 0) {
    manager.franchises = manager.franchises.filter((item: FranchiseTrack) => item.id !== franchise.id);
  }
}
