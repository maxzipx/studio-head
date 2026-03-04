import type { BuildDecisionContext } from '../types/events';
import type { Talent, MovieGenre, FranchiseTrack, RivalStudio } from '../types';

/**
 * Find the highest-starPower active actor attached to a project.
 */
export function findStarOnProject(
  context: BuildDecisionContext,
  projectId: string | null,
): Talent | null {
  if (!projectId) return null;
  const project = context.activeProjects.find((p) => p.id === projectId);
  if (!project) return null;
  const attachedIds = new Set([project.directorId, ...project.castIds].filter(Boolean));
  let best: Talent | null = null;
  for (const talent of context.talentPool) {
    if (talent.status !== 'active') continue;
    if (!attachedIds.has(talent.id)) continue;
    if (!best || talent.starPower > best.starPower) best = talent;
  }
  return best;
}

/**
 * Find an active rival whose upcoming release collides with the player's project release week.
 */
export function findRivalCounterprogramming(
  context: BuildDecisionContext,
  projectId: string | null,
): { rival: RivalStudio; rivalFilmTitle: string } | null {
  if (!projectId) return null;
  const project = context.activeProjects.find((p) => p.id === projectId);
  if (!project?.releaseWeek) return null;
  for (const rival of context.rivals) {
    for (const rf of rival.upcomingReleases) {
      if (Math.abs(rf.releaseWeek - project.releaseWeek!) <= 2) {
        return { rival, rivalFilmTitle: rf.title };
      }
    }
  }
  return null;
}

/**
 * Find a talent with low trust attached to a project — potential troublemaker.
 */
export function findDisgruntledTalent(
  context: BuildDecisionContext,
  projectId: string | null,
): Talent | null {
  if (!projectId) return null;
  const project = context.activeProjects.find((p) => p.id === projectId);
  if (!project) return null;
  const attachedIds = new Set([project.directorId, ...project.castIds].filter(Boolean));
  let worst: Talent | null = null;
  let worstTrust = Infinity;
  for (const talent of context.talentPool) {
    if (talent.status !== 'active') continue;
    if (!attachedIds.has(talent.id)) continue;
    const trust = talent.relationshipMemory?.trust ?? 50;
    if (trust < worstTrust) {
      worstTrust = trust;
      worst = talent;
    }
  }
  // Only return if trust is meaningfully low
  return worstTrust < 45 ? worst : null;
}

/**
 * Find the player's most commercially successful genre based on released films.
 */
export function findStudioStrengthGenre(
  context: BuildDecisionContext,
): MovieGenre | null {
  const genreHits: Partial<Record<MovieGenre, number>> = {};
  for (const project of context.activeProjects) {
    if (project.phase !== 'released') continue;
    if (project.projectedROI >= 1.0) {
      genreHits[project.genre] = (genreHits[project.genre] ?? 0) + 1;
    }
  }
  let bestGenre: MovieGenre | null = null;
  let bestCount = 0;
  for (const [genre, count] of Object.entries(genreHits)) {
    if (count > bestCount) {
      bestCount = count;
      bestGenre = genre as MovieGenre;
    }
  }
  return bestGenre;
}

/**
 * Find a franchise with high fatigue or low momentum.
 */
export function findStrugglingFranchise(
  context: BuildDecisionContext,
): FranchiseTrack | null {
  let worst: FranchiseTrack | null = null;
  let worstScore = Infinity;
  for (const franchise of context.franchises) {
    const score = franchise.momentum - franchise.fatigue;
    if (score < worstScore) {
      worstScore = score;
      worst = franchise;
    }
  }
  // Only return if franchise is actually struggling
  return worstScore < 0 ? worst : null;
}
