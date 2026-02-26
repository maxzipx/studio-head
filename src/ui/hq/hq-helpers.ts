import type { OutcomeType } from '@/src/ui/components';
import { colors } from '@/src/ui/tokens';
import type { ReleaseReport } from '@/src/domain/types';

export function money(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) return `$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
  return `$${Math.round(abs).toLocaleString()}`;
}

export function signedMoney(amount: number): string {
  return `${amount >= 0 ? '+' : '-'}${money(Math.abs(amount))}`;
}

export type ReleaseSplashTone = 'blockbuster' | 'flop' | 'record' | 'hit';

export function getReleaseSplashTone(report: ReleaseReport | null): ReleaseSplashTone {
  if (!report) return 'hit';
  if (report.wasRecordOpening) return 'record';
  if (report.outcome === 'blockbuster') return 'blockbuster';
  if (report.outcome === 'flop') return 'flop';
  return 'hit';
}

export function splashToneToOutcome(tone: ReleaseSplashTone): OutcomeType {
  if (tone === 'blockbuster') return 'blockbuster';
  if (tone === 'record') return 'blockbuster';
  if (tone === 'flop') return 'flop';
  return 'hit';
}

export function splashGradientColor(tone: ReleaseSplashTone): string {
  if (tone === 'blockbuster' || tone === 'record') return colors.accentGreen + '30';
  if (tone === 'flop') return colors.accentRed + '30';
  return '#6FAEEA30';
}

export const TIER_LABELS: Record<string, string> = {
  indieStudio: 'Indie Studio',
  establishedIndie: 'Established Indie',
  midTier: 'Mid-Tier Studio',
  majorStudio: 'Major Studio',
  globalPowerhouse: 'Global Powerhouse',
};

export const TIER_NEXT_GOAL: Record<string, string> = {
  indieStudio: 'Release 1 film and reach Heat 25 to advance',
  establishedIndie: 'Release 3 films and reach Heat 45 to advance',
  midTier: 'Release 6 films and reach Heat 65 to advance',
  majorStudio: 'Release 10 films and reach Heat 80 to advance',
  globalPowerhouse: 'You have reached the summit.',
};

export const ARC_LABELS: Record<string, string> = {
  'awards-circuit': 'Awards Run',
  'exhibitor-power-play': 'Exhibitor Power Play',
  'exhibitor-war': 'Theater Access Battle',
  'financier-control': 'Investor Pressure',
  'franchise-pivot': 'Universe Gamble',
  'leak-piracy': 'Leak Fallout',
  'talent-meltdown': 'Volatile Star Cycle',
  'passion-project': "The Director's Vision",
};

export const CHRONICLE_ICONS: Record<string, string> = {
  filmRelease: '🎬',
  arcResolution: '⭐',
  tierAdvance: '📈',
  awardsOutcome: '🏆',
  festivalOutcome: '🎪',
  crisisResolved: '🔧',
};

export const SPECIALIZATION_OPTIONS: { key: 'balanced' | 'blockbuster' | 'prestige' | 'indie'; label: string }[] = [
  { key: 'balanced', label: 'Balanced' },
  { key: 'blockbuster', label: 'Blockbuster' },
  { key: 'prestige', label: 'Prestige' },
  { key: 'indie', label: 'Indie' },
];

export const PARTNER_OPTIONS = ['Aster Peak Pictures', 'Silverline Distribution', 'Constellation Media'];

export function stanceLabel(value: string): string {
  if (value === 'hostile') return 'Hostile';
  if (value === 'competitive') return 'Competitive';
  if (value === 'respectful') return 'Respectful';
  return 'Neutral';
}

export function stanceColor(value: string): string {
  if (value === 'hostile') return colors.accentRed;
  if (value === 'competitive') return colors.goldMid;
  if (value === 'respectful') return colors.accentTeal;
  return colors.textMuted;
}
