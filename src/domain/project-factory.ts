import { createId } from './id';
import { initialBudgetForGenre } from './studio-manager.constants';
import type {
  CastRequirements,
  MovieGenre,
  MovieProject,
  OwnedIp,
  ProjectBudgetPlan,
  ScriptPitch,
} from './types';
import { clamp } from './utils';

const GENRE_COMMERCIAL_APPEAL: Record<string, number> = {
  action: 68,
  sciFi: 62,
  animation: 60,
  drama: 32,
  documentary: 18,
};

const GENRE_CONTROVERSY: Partial<Record<MovieGenre, number>> = {
  horror: 35,
  thriller: 28,
  action: 22,
};

function createProjectDefaults(): Omit<
  MovieProject,
  'id' | 'title' | 'genre' | 'budget' | 'budgetPlan' | 'castRequirements' |
  'scriptQuality' | 'conceptStrength' | 'hypeScore' | 'prestige' |
  'commercialAppeal' | 'originality' | 'controversy'
> {
  return {
    phase: 'development',
    editorialScore: 5,
    postPolishPasses: 0,
    directorId: null,
    castIds: [],
    productionStatus: 'onTrack',
    scheduledWeeksRemaining: 6,
    marketingBudget: 0,
    releaseWindow: null,
    releaseWeek: null,
    releaseWeekLocked: false,
    distributionPartner: null,
    studioRevenueShare: 0.52,
    projectedROI: 1,
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
    franchiseId: null,
    franchiseEpisode: null,
    sequelToProjectId: null,
    franchiseCarryoverHype: 0,
    franchiseStrategy: 'none',
    greenlightApproved: false,
  };
}

function buildBudget(ceiling: number, actualSpend: number, overrunRisk: number): MovieProject['budget'] {
  return {
    ceiling,
    aboveTheLine: ceiling * 0.3,
    belowTheLine: ceiling * 0.5,
    postProduction: ceiling * 0.15,
    contingency: ceiling * 0.1,
    overrunRisk,
    actualSpend,
  };
}

export function createProjectFromScript(
  pitch: ScriptPitch,
  budgetPlan: ProjectBudgetPlan,
  castRequirements: CastRequirements,
): MovieProject {
  const ceiling = initialBudgetForGenre(pitch.genre);
  const baseCommercial = GENRE_COMMERCIAL_APPEAL[pitch.genre] ?? 48;

  return {
    ...createProjectDefaults(),
    id: createId('project'),
    title: pitch.title,
    genre: pitch.genre,
    budget: buildBudget(ceiling, pitch.askingPrice, 0.28),
    budgetPlan,
    castRequirements,
    scriptQuality: pitch.scriptQuality,
    conceptStrength: pitch.conceptStrength,
    hypeScore: 8,
    prestige: clamp(
      Math.round(pitch.scriptQuality * 7 + (pitch.genre === 'drama' || pitch.genre === 'documentary' ? 18 : 0)),
      0, 100,
    ),
    commercialAppeal: clamp(Math.round(baseCommercial + pitch.conceptStrength * 3), 0, 100),
    originality: clamp(Math.round(pitch.conceptStrength * 8 + 10), 0, 100),
    controversy: GENRE_CONTROVERSY[pitch.genre] ?? 15,
    greenlightWeek: null,
    greenlightFeePaid: 0,
    greenlightLockedCeiling: null,
    sentBackForRewriteCount: 0,
    testScreeningCompleted: false,
    testScreeningWeek: null,
    testScreeningCriticalLow: null,
    testScreeningCriticalHigh: null,
    testScreeningAudienceSentiment: null,
    reshootCount: 0,
    trackingProjectionOpening: null,
    trackingConfidence: null,
    trackingLeverageAmount: 0,
    trackingSettled: false,
    merchandiseWeeksRemaining: 0,
    merchandiseWeeklyRevenue: 0,
    adaptedFromIpId: null,
  };
}

export function createProjectFromIp(
  ip: OwnedIp,
  title: string,
  budgetPlan: ProjectBudgetPlan,
  castRequirements: CastRequirements,
): MovieProject {
  const budget = initialBudgetForGenre(ip.genre) * (ip.major ? 1.3 : 1.05);

  return {
    ...createProjectDefaults(),
    id: createId('project'),
    title,
    genre: ip.genre,
    budget: buildBudget(budget, Math.round(ip.acquisitionCost * 0.4), 0.27),
    budgetPlan,
    castRequirements,
    scriptQuality: clamp(6.1 + ip.qualityBonus, 0, 9.2),
    conceptStrength: clamp(6.4 + ip.commercialBonus * 0.12, 0, 9.5),
    hypeScore: clamp(8 + ip.hypeBonus, 0, 100),
    prestige: clamp(40 + ip.prestigeBonus, 0, 100),
    commercialAppeal: clamp(45 + ip.commercialBonus, 0, 100),
    originality: clamp(38 + ip.qualityBonus * 5, 0, 100),
    controversy: 10,
    adaptedFromIpId: ip.id,
  };
}
