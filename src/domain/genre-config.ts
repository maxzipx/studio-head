/**
 * Single source of truth for all genre-specific configuration.
 *
 * Previously this data was scattered across formulas.ts (baseline opening,
 * international factor), studio-manager.constants.ts (GENRE_SHOCK_LIBRARY,
 * createInitialGenreCycles), and UI screen files (label/color mappings).
 *
 * All domain files and UI helpers must import genre data from here.
 */

import type { GenreCycleState, MovieGenre } from './types';

// ─── Core Genre List ──────────────────────────────────────────────────────────

export const MOVIE_GENRES: MovieGenre[] = [
  'action',
  'drama',
  'comedy',
  'horror',
  'thriller',
  'sciFi',
  'animation',
  'documentary',
];

// ─── Box Office ───────────────────────────────────────────────────────────────

/**
 * Baseline domestic opening weekend for each genre (unmodified by talent/hype).
 * Used in projectedOpeningWeekendRange().
 */
export const GENRE_BASELINE_OPENING: Record<MovieGenre, number> = {
  action: 28_000_000,
  drama: 9_000_000,
  comedy: 14_000_000,
  horror: 12_000_000,
  thriller: 13_500_000,
  sciFi: 21_000_000,
  animation: 24_000_000,
  documentary: 2_500_000,
};

/**
 * International multiplier applied to domestic total to derive worldwide gross.
 * Action and animation travel best; documentary travels worst.
 */
export const GENRE_INTERNATIONAL_FACTOR: Record<MovieGenre, number> = {
  action: 2.4,
  drama: 1.2,
  comedy: 1.4,
  horror: 1.6,
  thriller: 1.5,
  sciFi: 2.2,
  animation: 2.8,
  documentary: 0.8,
};

// ─── Demand Cycle ────────────────────────────────────────────────────────────

/**
 * Shock events injected when a genre's demand cycle surges or slumps.
 * Previously in studio-manager.constants.ts as GENRE_SHOCK_LIBRARY.
 */
export const GENRE_SHOCK_LIBRARY: Record<MovieGenre, { surge: string[]; slump: string[] }> = {
  action: {
    surge: ['Global action revival', 'Practical stunt renaissance'],
    slump: ['Superhero fatigue wave', 'Action sequel burnout'],
  },
  drama: {
    surge: ['Awards-season drama appetite', 'Character-story comeback'],
    slump: ['Prestige-drama cooling cycle', 'Audience patience dip for slow burns'],
  },
  comedy: {
    surge: ['Comedy rebound on social platforms', 'Crowd-pleaser comeback'],
    slump: ['Comedy oversupply', 'Audience comedy fatigue'],
  },
  horror: {
    surge: ['Horror revival trend', 'Midnight-screening boom'],
    slump: ['Horror formula fatigue', 'Jump-scare burnout'],
  },
  thriller: {
    surge: ['Streaming thriller spillover', 'Conspiracy-thriller surge'],
    slump: ['Twist-thriller fatigue', 'Thriller saturation'],
  },
  sciFi: {
    surge: ['Speculative fiction boom', 'Sci-fi spectacle upswing'],
    slump: ['Sci-fi VFX fatigue', 'High-concept confusion backlash'],
  },
  animation: {
    surge: ['Family animation rebound', 'Animated feature boom'],
    slump: ['Animated franchise fatigue', 'Crowded family slate'],
  },
  documentary: {
    surge: ['Doc prestige wave', 'True-story urgency spike'],
    slump: ['Documentary attention dip', 'Issue-doc fatigue'],
  },
};

/** Starting demand and momentum values for each genre's cycle. */
export function createInitialGenreCycles(): Record<MovieGenre, GenreCycleState> {
  return {
    action: { demand: 1.02, momentum: 0.004 },
    drama: { demand: 0.98, momentum: 0.002 },
    comedy: { demand: 1, momentum: 0.001 },
    horror: { demand: 1.04, momentum: 0.003 },
    thriller: { demand: 1.01, momentum: 0.002 },
    sciFi: { demand: 1.03, momentum: 0.003 },
    animation: { demand: 0.99, momentum: 0.001 },
    documentary: { demand: 0.95, momentum: 0.001 },
  };
}

// ─── Display ──────────────────────────────────────────────────────────────────

/** Human-readable display label for each genre. */
export const GENRE_LABEL: Record<MovieGenre, string> = {
  action: 'Action',
  drama: 'Drama',
  comedy: 'Comedy',
  horror: 'Horror',
  thriller: 'Thriller',
  sciFi: 'Sci-Fi',
  animation: 'Animation',
  documentary: 'Documentary',
};
