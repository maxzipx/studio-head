import type { OutcomeType } from '@/src/ui/components';
import type { ReleaseReport } from '@/src/domain/types';

// Re-export shared utilities so existing imports from hq-helpers keep working.
export { capitalize, money, signedMoney, stanceLabel, stanceColor } from '@/src/ui/helpers/formatting';

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
  if (tone === 'blockbuster' || tone === 'record') return 'rgba(107,168,130,0.18)';
  if (tone === 'flop') return 'rgba(224,112,112,0.15)';
  return 'rgba(196,129,59,0.15)';
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

