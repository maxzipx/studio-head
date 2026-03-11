import type { MovieProject, PlayerNegotiation, Talent } from '../../domain/types';

interface ProjectCastStatus {
  actorCount: number;
  actressCount: number;
  total: number;
  requiredTotal: number;
}

export interface TalentScreenProjectView {
  openNegotiations: PlayerNegotiation[];
  rosterTalent: Talent[];
  rosterDirectors: Talent[];
  rosterActors: Talent[];
  rosterActresses: Talent[];
  marketTalent: Talent[];
  marketDirectors: Talent[];
  marketActors: Talent[];
  marketActresses: Talent[];
  marketDirectorCount: number;
  marketActorCount: number;
  marketActressCount: number;
  attachedCount: number;
  neededSlots: number;
}

function sortTalentForDisplay(a: Talent, b: Talent): number {
  if (a.role !== b.role) return a.role === 'director' ? -1 : 1;
  return b.starPower - a.starPower;
}

export function buildTalentScreenProjectView(input: {
  activeProject: MovieProject | null;
  playerNegotiations: PlayerNegotiation[];
  talentPool: Talent[];
  getProjectCastStatus: (projectId: string) => ProjectCastStatus | null;
}): TalentScreenProjectView {
  const { activeProject, playerNegotiations, talentPool, getProjectCastStatus } = input;

  if (!activeProject) {
    return {
      openNegotiations: [],
      rosterTalent: [],
      rosterDirectors: [],
      rosterActors: [],
      rosterActresses: [],
      marketTalent: [],
      marketDirectors: [],
      marketActors: [],
      marketActresses: [],
      marketDirectorCount: 0,
      marketActorCount: 0,
      marketActressCount: 0,
      attachedCount: 0,
      neededSlots: 0,
    };
  }

  const castStatus = getProjectCastStatus(activeProject.id);
  const actorShortfall = Math.max(0, activeProject.castRequirements.actorCount - (castStatus?.actorCount ?? 0));
  const actressShortfall = Math.max(0, activeProject.castRequirements.actressCount - (castStatus?.actressCount ?? 0));
  const needsDirector = !activeProject.directorId;
  const neededRoles = new Set<Talent['role']>();
  if (needsDirector) neededRoles.add('director');
  if (actorShortfall > 0) neededRoles.add('leadActor');
  if (actressShortfall > 0) neededRoles.add('leadActress');

  const openNegotiations = playerNegotiations.filter((entry) => entry.projectId === activeProject.id);
  const rosterTalent = talentPool
    .filter((talent) => talent.attachedProjectId === activeProject.id)
    .sort(sortTalentForDisplay);
  const marketTalent = talentPool
    .filter(
      (talent) =>
        talent.availability === 'available' &&
        talent.marketWindowExpiresWeek !== null &&
        neededRoles.has(talent.role)
    )
    .sort(sortTalentForDisplay);

  const marketDirectors = marketTalent.filter((talent) => talent.role === 'director');
  const marketActors = marketTalent.filter((talent) => talent.role === 'leadActor');
  const marketActresses = marketTalent.filter((talent) => talent.role === 'leadActress');

  return {
    openNegotiations,
    rosterTalent,
    rosterDirectors: rosterTalent.filter((talent) => talent.role === 'director'),
    rosterActors: rosterTalent.filter((talent) => talent.role === 'leadActor'),
    rosterActresses: rosterTalent.filter((talent) => talent.role === 'leadActress'),
    marketTalent,
    marketDirectors,
    marketActors,
    marketActresses,
    marketDirectorCount: marketDirectors.length,
    marketActorCount: marketActors.length,
    marketActressCount: marketActresses.length,
    attachedCount: rosterTalent.length,
    neededSlots: (needsDirector ? 1 : 0) + actorShortfall + actressShortfall,
  };
}
