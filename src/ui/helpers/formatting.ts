/**
 * Shared UI formatting and color-mapping utilities.
 *
 * All screens and helper modules must import from here instead of
 * re-defining these functions locally.
 */

import { colors } from '@/src/ui/tokens';

// ─── Currency ────────────────────────────────────────────────────────────────

/** Formats a dollar amount with B/M/comma suffixes. Handles negative values. */
export function money(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) return `$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(abs).toLocaleString()}`;
}

/** Formats a dollar amount prefixed with + or − based on sign. */
export function signedMoney(amount: number): string {
  return `${amount >= 0 ? '+' : '-'}${money(Math.abs(amount))}`;
}

// ─── Percentage ──────────────────────────────────────────────────────────────

/** Converts a 0–1 fraction to a rounded percentage string, e.g. 0.75 → "75%". */
export function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

// ─── String ──────────────────────────────────────────────────────────────────

/** Capitalises the first letter of a string. */
export function capitalized(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Capitalises the first letter of every word (handles hyphens). */
export function capitalize(str: string): string {
  if (!str) return str;
  return str
    .split(/(\s+|-)/)
    .map((part) => (part.match(/^[a-z]/) ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join('');
}

// ─── Phase ───────────────────────────────────────────────────────────────────

/** Returns the accent color for a project phase pill. */
export function phaseColor(phase: string): string {
  if (phase === 'development') return colors.accentTeal;
  if (phase === 'preProduction' || phase === 'production') return colors.goldMid;
  if (phase === 'postProduction') return colors.accentTeal;
  if (phase === 'distribution') return colors.ctaAmber;
  if (phase === 'released') return colors.accentGreen;
  return colors.textMuted;
}

/**
 * Converts a camelCase phase name to a readable label,
 * e.g. "postProduction" → "Post-Production".
 */
export function phaseLabel(phase: string): string {
  return phase
    .replace(/([A-Z])/g, '-$1')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('-');
}

/** Calculates phase progress 0–100 based on weeks remaining vs total phase length. */
export function phaseProgress(phase: string, weeksRemaining: number): number {
  const totals: Record<string, number> = {
    development: 4,
    preProduction: 8,
    production: 14,
    postProduction: 6,
    distribution: 3,
  };
  const total = totals[phase] ?? 1;
  return Math.max(0, Math.min(100, ((total - weeksRemaining) / total) * 100));
}

// ─── Negotiation / Chance ────────────────────────────────────────────────────

/** Returns a human label for a 0–1 negotiation close chance. */
export function chanceLabel(value: number): string {
  if (value >= 0.75) return 'Likely';
  if (value >= 0.5) return 'Even Odds';
  return 'Long Shot';
}

/** Returns the accent color for a 0–1 negotiation close chance. */
export function chanceColor(value: number): string {
  if (value >= 0.75) return colors.accentGreen;
  if (value >= 0.5) return colors.goldMid;
  return colors.accentRed;
}

// ─── Trust / Relationship ────────────────────────────────────────────────────

/** Returns the human label for a talent trust level. */
export function trustLevelLabel(value: string): string {
  if (value === 'hostile') return 'Hostile';
  if (value === 'wary') return 'Wary';
  if (value === 'aligned') return 'Aligned';
  if (value === 'loyal') return 'Loyal';
  return 'Neutral';
}

/** Returns the accent color for a talent trust level. */
export function trustLevelColor(value: string): string {
  if (value === 'hostile') return colors.accentRed;
  if (value === 'wary') return colors.goldMid;
  if (value === 'aligned') return colors.accentGreen;
  if (value === 'loyal') return colors.accentGreen;
  return colors.textMuted;
}

/** Returns the accent color for a negotiation refusal risk level. */
export function refusalRiskColor(value: string): string {
  if (value === 'critical') return colors.accentRed;
  if (value === 'elevated') return colors.goldMid;
  return colors.accentGreen;
}

// ─── Talent Labels ───────────────────────────────────────────────────────────

/** Maps a talent role key to a display label. */
export function roleLabel(value: string): string {
  if (value === 'leadActor') return 'Actor';
  if (value === 'leadActress') return 'Actress';
  if (value === 'supportingActor') return 'Supporting Actor';
  return value;
}

/** Maps an agent tier key to an acronym label. */
export function agencyLabel(agentTier: string): string {
  if (agentTier === 'aea') return 'AEA';
  if (agentTier === 'wma') return 'WMA';
  if (agentTier === 'tca') return 'TCA';
  return 'IND';
}

/** Maps a talent interaction history entry kind to a human label. */
export function interactionLabel(kind: string): string {
  const map: Record<string, string> = {
    negotiationOpened: 'Opened negotiation',
    negotiationSweetened: 'Sweetened terms',
    negotiationHardline: 'Held hard line',
    negotiationDeclined: 'Declined terms',
    quickCloseFailed: 'Quick-close failed',
    quickCloseSuccess: 'Quick-close success',
    dealSigned: 'Deal signed',
    dealStalled: 'Deal stalled',
    projectReleased: 'Project released',
    projectAbandoned: 'Project abandoned',
    poachedByRival: 'Poached by rival',
    counterPoachWon: 'Counter-poach won',
    counterPoachLost: 'Counter-poach lost',
  };
  return map[kind] ?? 'Interaction';
}

// ─── Craft Grade ─────────────────────────────────────────────────────────────

/** Converts a craft score (0–10) to a letter grade. */
export function craftGrade(score: number): string {
  if (score >= 9) return 'A+';
  if (score >= 8) return 'A';
  if (score >= 7) return 'B+';
  if (score >= 6) return 'B';
  if (score >= 5) return 'C+';
  return 'C';
}

/** Returns the accent color for a craft score. */
export function craftGradeColor(score: number): string {
  if (score >= 8) return colors.accentGreen;
  if (score >= 6) return colors.goldMid;
  return colors.accentRed;
}

// ─── Financial ───────────────────────────────────────────────────────────────

/** Returns the accent color for a budget burn percentage. */
export function burnBarColor(percent: number): string {
  if (percent < 80) return colors.accentTeal;
  if (percent < 95) return colors.goldMid;
  return colors.accentRed;
}

/** Returns the accent color for an ROI value. */
export function roiColor(roi: number): string {
  if (roi >= 1.5) return colors.accentTeal;
  if (roi >= 1.0) return colors.goldMid;
  return colors.accentRed;
}

// ─── Script Recommendation ───────────────────────────────────────────────────

/** Maps a script recommendation key to a display label. */
export function recommendationLabel(value: 'strongBuy' | 'conditional' | 'pass'): string {
  if (value === 'strongBuy') return 'Strong Buy';
  if (value === 'conditional') return 'Conditional';
  return 'Pass';
}

/** Returns the accent color for a script recommendation. */
export function recommendationColor(value: 'strongBuy' | 'conditional' | 'pass'): string {
  if (value === 'strongBuy') return colors.accentGreen;
  if (value === 'conditional') return colors.goldMid;
  return colors.accentRed;
}

// ─── Rival Stance ────────────────────────────────────────────────────────────

/** Maps a rival stance key to a display label. */
export function stanceLabel(value: string): string {
  if (value === 'friendly') return 'Friendly';
  if (value === 'warm') return 'Warm';
  if (value === 'competitor') return 'Competitor';
  if (value === 'rival') return 'Rival';
  return 'Neutral';
}

/** Returns the accent color for a rival stance. */
export function stanceColor(value: string): string {
  if (value === 'friendly') return colors.accentGreen;
  if (value === 'warm') return colors.accentTeal;
  if (value === 'competitor') return colors.accentRed;
  if (value === 'rival') return colors.accentRedDeep;
  return colors.textMuted;
}

// ─── Franchise ───────────────────────────────────────────────────────────────

/** Maps a franchise strategy key to a display label. */
export function franchiseStrategyLabel(strategy: string): string {
  if (strategy === 'safe') return 'Safe Continuation';
  if (strategy === 'reinvention') return 'Reinvention';
  if (strategy === 'balanced') return 'Balanced';
  return 'Standalone';
}
