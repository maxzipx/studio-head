import { colors } from '@/src/ui/tokens';
import type { OutcomeType } from '@/src/ui/components';

export function money(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`;
}

export function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function resolveParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export function franchiseStrategyLabel(strategy: string): string {
  if (strategy === 'safe') return 'Safe Continuation';
  if (strategy === 'reinvention') return 'Reinvention';
  if (strategy === 'balanced') return 'Balanced';
  return 'Standalone';
}

export function outcomeFromReport(outcome: string): OutcomeType {
  if (outcome === 'blockbuster') return 'blockbuster';
  if (outcome === 'hit') return 'hit';
  if (outcome === 'solid') return 'solid';
  if (outcome === 'flop') return 'flop';
  return 'bomb';
}

export function phaseColor(phase: string): string {
  if (phase === 'development') return colors.accentTeal;
  if (phase === 'preProduction' || phase === 'production') return colors.goldMid;
  if (phase === 'postProduction') return colors.accentTeal;
  if (phase === 'distribution') return '#6FAEEA';
  if (phase === 'released') return colors.accentGreen;
  return colors.textMuted;
}

export function burnBarColor(percent: number): string {
  if (percent < 80) return colors.accentTeal;
  if (percent < 95) return colors.goldMid;
  return colors.accentRed;
}

export function roiColor(roi: number): string {
  if (roi >= 1.5) return colors.accentTeal;
  if (roi >= 1.0) return colors.goldMid;
  return colors.accentRed;
}

type AdvanceProject = {
  phase: string;
  directorId: string | null;
  castIds: string[];
  scriptQuality: number;
  greenlightApproved?: boolean;
  scheduledWeeksRemaining: number;
  marketingBudget: number;
  releaseWindow: string | null;
  releaseWeek: number | null;
};

export function advanceBlockers(project: AdvanceProject, currentWeek: number, crisisCount: number): string[] {
  const blockers: string[] = [];
  if (project.phase === 'development') {
    if (!project.directorId) blockers.push('Director not attached');
    if (project.castIds.length < 1) blockers.push('No lead actor attached');
    if (project.scriptQuality < 6) blockers.push(`Script quality too low (${project.scriptQuality.toFixed(1)} / min 6.0)`);
    if (!project.greenlightApproved) blockers.push('Greenlight decision not approved');
  } else if (project.phase === 'preProduction' || project.phase === 'production' || project.phase === 'postProduction') {
    if (project.scheduledWeeksRemaining > 0) blockers.push(`${project.scheduledWeeksRemaining}w remaining in phase`);
    if (project.phase === 'production' && crisisCount > 0) blockers.push(`${crisisCount} unresolved crisis`);
    if (project.phase === 'postProduction' && project.marketingBudget <= 0) blockers.push('Marketing budget required (use push below)');
  } else if (project.phase === 'distribution') {
    if (project.scheduledWeeksRemaining > 0) blockers.push(`${project.scheduledWeeksRemaining}w setup remaining`);
    if (!project.releaseWindow) blockers.push('Distribution deal not selected');
    if (project.releaseWeek && currentWeek < project.releaseWeek) blockers.push(`Release date is week ${project.releaseWeek} (now week ${currentWeek})`);
  }
  return blockers;
}
