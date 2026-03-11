import type { OutcomeType } from '@/src/ui/components';

// Re-export shared utilities so existing imports from project-helpers keep working.
export {
  money,
  pct,
  phaseColor,
  burnBarColor,
  roiColor,
  franchiseStrategyLabel,
} from '@/src/ui/helpers/formatting';

export function resolveParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}


export function outcomeFromReport(outcome: string): OutcomeType {
  if (outcome === 'blockbuster') return 'blockbuster';
  if (outcome === 'hit') return 'hit';
  if (outcome === 'solid') return 'solid';
  if (outcome === 'flop') return 'flop';
  return 'bomb';
}


type AdvanceProject = {
  phase: string;
  directorId: string | null;
  castIds: string[];
  castRequirements: { actorCount: number; actressCount: number };
  scriptQuality: number;
  greenlightApproved?: boolean;
  scheduledWeeksRemaining: number;
  marketingBudget: number;
  releaseWindow: string | null;
  releaseWeek: number | null;
  releaseWeekLocked: boolean;
};

type CastStatus = { actorCount: number; actressCount: number; total: number };

export function advanceBlockers(
  project: AdvanceProject,
  currentWeek: number,
  crisisCount: number,
  castStatus?: CastStatus
): string[] {
  const blockers: string[] = [];
  if (project.phase === 'development') {
    if (!project.directorId) blockers.push('Director not attached');
    if (castStatus) {
      if (castStatus.actorCount < project.castRequirements.actorCount) {
        blockers.push(`Need ${project.castRequirements.actorCount} actor(s) (${castStatus.actorCount} attached)`);
      }
      if (castStatus.actressCount < project.castRequirements.actressCount) {
        blockers.push(`Need ${project.castRequirements.actressCount} actress(es) (${castStatus.actressCount} attached)`);
      }
    } else if (project.castIds.length < 1) {
      blockers.push('No cast attached');
    }
    if (project.scriptQuality < 6) blockers.push(`Script quality too low (${project.scriptQuality.toFixed(1)} / min 6.0)`);
    if (!project.greenlightApproved) blockers.push('Greenlight decision not approved');
  } else if (project.phase === 'preProduction' || project.phase === 'production' || project.phase === 'postProduction') {
    if (project.scheduledWeeksRemaining > 0) blockers.push(`${project.scheduledWeeksRemaining}w remaining in phase`);
    if (project.phase === 'production' && crisisCount > 0) blockers.push(`${crisisCount} unresolved crisis`);
    if (project.phase === 'postProduction' && project.marketingBudget <= 0) blockers.push('Marketing budget required (use push below)');
  } else if (project.phase === 'distribution') {
    if (project.scheduledWeeksRemaining > 0) blockers.push(`${project.scheduledWeeksRemaining}w setup remaining`);
    if (!project.releaseWindow) blockers.push('Distribution deal not selected');
    if (!project.releaseWeek) blockers.push('Release week not set');
    if (project.releaseWeek && !project.releaseWeekLocked) blockers.push(`Release week W${project.releaseWeek} still needs confirmation`);
    if (project.releaseWeek && currentWeek < project.releaseWeek) blockers.push(`Release date is week ${project.releaseWeek} (now week ${currentWeek})`);
  }
  return blockers;
}
