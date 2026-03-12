import { computeArcOutcomeModifiers, computeStudioModifiers, getDepartmentModifiers } from './modifier-service';
import type { StudioManager } from './studio-manager';
import { getRivalBehaviorProfileForManager } from './studio-manager.rivals';
import { MOVIE_GENRES, TIER_RANK, clamp, phaseBurnMultiplier } from './studio-manager.constants';
import type { MovieGenre, MovieProject, ReleaseReport, RivalStudio, Talent } from './types';

function findProjectById(manager: Pick<StudioManager, 'activeProjects'>, projectId: string): MovieProject | null {
  return manager.activeProjects.find((project) => project.id === projectId) ?? null;
}

function findTalentById(manager: Pick<StudioManager, 'talentPool'>, talentId: string): Talent | null {
  return manager.talentPool.find((talent) => talent.id === talentId) ?? null;
}

export function getGenreDemandMultiplierForStudio(manager: Pick<StudioManager, 'genreCycles'>, genre: MovieGenre): number {
  return manager.genreCycles[genre]?.demand ?? 1;
}

export function getProjectCastStatusForStudio(
  manager: Pick<StudioManager, 'activeProjects' | 'talentPool'>,
  projectId: string
): { actorCount: number; actressCount: number; total: number; requiredTotal: number } | null {
  const project = findProjectById(manager, projectId);
  if (!project) return null;

  let actorCount = 0;
  let actressCount = 0;
  for (const talentId of project.castIds) {
    const talent = findTalentById(manager, talentId);
    if (!talent) continue;
    if (talent.role === 'leadActress') {
      actressCount += 1;
    } else if (talent.role === 'leadActor' || talent.role === 'supportingActor') {
      actorCount += 1;
    }
  }

  return {
    actorCount,
    actressCount,
    total: actorCount + actressCount,
    requiredTotal: project.castRequirements.actorCount + project.castRequirements.actressCount,
  };
}

export function getActiveMilestonesForStudio(manager: Pick<StudioManager, 'milestones'>) {
  return [...manager.milestones].sort((a, b) => b.unlockedWeek - a.unlockedWeek);
}

export function getLatestReleaseReportForStudio(
  manager: Pick<StudioManager, 'releaseReports'>,
  projectId: string
): ReleaseReport | null {
  return manager.releaseReports.find((report) => report.projectId === projectId) ?? null;
}

export function getIndustryHeatLeaderboardForStudio(
  manager: Pick<StudioManager, 'studioName' | 'studioHeat' | 'rivals'>
): { name: string; heat: number; isPlayer: boolean }[] {
  const rows = [
    { name: manager.studioName, heat: manager.studioHeat, isPlayer: true },
    ...manager.rivals.map((rival) => ({ name: rival.name, heat: rival.studioHeat, isPlayer: false })),
  ];
  return rows.sort((a, b) => b.heat - a.heat);
}

export function getGenreCycleSnapshotForStudio(
  manager: Pick<StudioManager, 'genreCycles' | 'currentWeek'>
): {
  genre: MovieGenre;
  demand: number;
  momentum: number;
  shockLabel: string | null;
  shockDirection: 'surge' | 'slump' | null;
  shockWeeksRemaining: number;
}[] {
  return MOVIE_GENRES.map((genre) => ({
    genre,
    demand: getGenreDemandMultiplierForStudio(manager, genre),
    momentum: manager.genreCycles[genre]?.momentum ?? 0,
    shockLabel: manager.genreCycles[genre]?.shockLabel ?? null,
    shockDirection: manager.genreCycles[genre]?.shockDirection ?? null,
    shockWeeksRemaining: Math.max(0, (manager.genreCycles[genre]?.shockUntilWeek ?? manager.currentWeek) - manager.currentWeek),
  })).sort((a, b) => b.demand - a.demand);
}

export function getRivalBehaviorProfileForStudio(
  manager: Pick<StudioManager, 'studioHeat' | 'reputation' | 'rivals' | 'currentWeek'> & StudioManager,
  rival: RivalStudio
) {
  return getRivalBehaviorProfileForManager(manager, rival);
}

export function getArcPressureFromRivalsForStudio(
  manager: Pick<StudioManager, 'rivals' | 'studioHeat' | 'reputation' | 'currentWeek'> & StudioManager,
  arcId: string
): number {
  let pressure = 0;
  for (const rival of manager.rivals) {
    const profile = getRivalBehaviorProfileForStudio(manager, rival);
    pressure += profile.arcPressure[arcId] ?? 0;
  }
  return clamp(pressure / Math.max(1, manager.rivals.length), 0, 0.7);
}

export function getArcOutcomeModifiersForStudio(manager: Pick<StudioManager, 'storyArcs' | 'studioSpecialization' | 'foundingProfile' | 'departmentLevels' | 'executiveNetworkLevel'>) {
  return computeArcOutcomeModifiers(manager);
}

export function getScaleOverheadCostForStudio(manager: Pick<StudioManager, 'studioTier' | 'projectCapacityLimit'>): number {
  return 250_000 * TIER_RANK[manager.studioTier] + 100_000 * manager.projectCapacityLimit;
}

export function projectedBurnForProjectForStudio(
  manager: Pick<StudioManager, 'studioSpecialization' | 'foundingProfile' | 'departmentLevels'>,
  project: MovieProject,
  burnMultiplier: number
): number {
  const studioModifiers = computeStudioModifiers(manager);
  const departmentModifiers = getDepartmentModifiers(manager);
  return (
    project.budget.ceiling *
    phaseBurnMultiplier(project.phase) *
    burnMultiplier *
    studioModifiers.specializationProfile.burnMultiplier *
    departmentModifiers.productionEfficiencyMultiplier
  );
}

export function estimateWeeklyBurnForStudio(
  manager: Pick<StudioManager, 'activeProjects' | 'storyArcs' | 'studioSpecialization' | 'foundingProfile' | 'departmentLevels' | 'executiveNetworkLevel'>
): number {
  const arcModifiers = getArcOutcomeModifiersForStudio(manager);
  return manager.activeProjects.reduce((sum, project) => {
    if (project.phase === 'released') return sum;
    return sum + projectedBurnForProjectForStudio(manager, project, arcModifiers.burnMultiplier);
  }, 0);
}
