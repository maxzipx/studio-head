import { PROJECT_BALANCE } from './balance-constants';
import { createId } from './id';
import type { FranchiseTrack, MovieProject, SequelCandidate, SequelEligibility } from './types';

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

function ensureFranchiseForBase(manager: any, baseProject: MovieProject): FranchiseTrack {
  if (baseProject.franchiseId) {
    const existing = manager.franchises.find((item: FranchiseTrack) => item.id === baseProject.franchiseId);
    if (existing) return existing;
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
  };
  baseProject.franchiseId = franchise.id;
  baseProject.franchiseEpisode = baseProject.franchiseEpisode ?? 1;
  baseProject.sequelToProjectId = null;
  baseProject.franchiseCarryoverHype = baseProject.franchiseCarryoverHype ?? 0;
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

export function markFranchiseReleaseForManager(manager: any, projectId: string): void {
  const project = manager.activeProjects.find((item: MovieProject) => item.id === projectId) as MovieProject | undefined;
  if (!project?.franchiseId) return;
  const franchise = manager.franchises.find((item: FranchiseTrack) => item.id === project.franchiseId);
  if (!franchise) return;

  franchise.projectIds = Array.from(new Set([...franchise.projectIds, project.id]));
  franchise.releasedProjectIds = Array.from(new Set([...franchise.releasedProjectIds, project.id]));
  franchise.activeProjectId = franchise.activeProjectId === project.id ? null : franchise.activeProjectId;
  franchise.lastReleaseWeek = manager.currentWeek;

  const audience = project.audienceScore ?? 50;
  const critics = project.criticalScore ?? 50;
  franchise.momentum = clamp(Math.round((franchise.momentum * 0.4 + audience * 0.42 + critics * 0.18) * 10) / 10, 8, 95);
  franchise.fatigue = clamp(
    Math.round((franchise.fatigue * 0.68 + 9 + Math.max(0, 60 - audience) * 0.25 + project.controversy * 0.08) * 10) / 10,
    0,
    92
  );
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
