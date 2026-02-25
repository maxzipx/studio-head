import type { MovieGenre, ProjectPhase, StudioTier } from './types';

export const STUDIO_STARTING = {
  CASH: 50_000_000,
  REPUTATION_PILLAR: 12,
} as const;

export const TURN_RULES = {
  MIN_WEEKS: 1,
  MAX_WEEKS: 2,
} as const;

export const BANKRUPTCY_RULES = {
  LOW_CASH_WARNING_THRESHOLD: 1_000_000,
  WARNING_WEEKS: 2,
  URGENT_WEEKS: 4,
  GAME_OVER_CASH_THRESHOLD: 0,
} as const;

export const SESSION_RULES = {
  FIRST_SESSION_COMPLETE_WEEK: 5,
} as const;

export const STUDIO_TIER_REQUIREMENTS: Record<StudioTier, { heat: number; releasedFilms: number }> = {
  indieStudio: { heat: 0, releasedFilms: 0 },
  establishedIndie: { heat: 25, releasedFilms: 1 },
  midTier: { heat: 45, releasedFilms: 3 },
  majorStudio: { heat: 65, releasedFilms: 6 },
  globalPowerhouse: { heat: 80, releasedFilms: 10 },
};

export const ACTION_BALANCE = {
  OPTIONAL_ACTION_COST: 180_000,
  OPTIONAL_ACTION_HYPE_BOOST: 5,
  OPTIONAL_ACTION_MARKETING_BOOST: 180_000,
  SCRIPT_SPRINT_COST: 100_000,
  SCRIPT_SPRINT_QUALITY_BOOST: 0.5,
  SCRIPT_SPRINT_MAX_QUALITY: 8.5,
  POLISH_PASS_COST: 120_000,
  POLISH_PASS_EDITORIAL_BOOST: 2,
  POLISH_PASS_MAX_EDITORIAL: 9,
  POLISH_PASS_MAX_USES: 2,
} as const;

export const PROJECT_BALANCE = {
  INITIAL_BUDGET_BY_GENRE: {
    action: 28_000_000,
    sciFi: 32_000_000,
    animation: 36_000_000,
    horror: 14_000_000,
    documentary: 6_000_000,
    drama: 18_000_000,
    comedy: 18_000_000,
    thriller: 18_000_000,
  } satisfies Record<MovieGenre, number>,
  PHASE_BURN_MULTIPLIER: {
    development: 0.005,
    preProduction: 0.008,
    production: 0.015,
    postProduction: 0.009,
    distribution: 0.0035,
    released: 0,
  } satisfies Record<ProjectPhase, number>,
} as const;

export const EVENT_BALANCE = {
  LOW_HEAT_MARKETING_WEIGHT_THRESHOLD: 25,
} as const;

export const MEMORY_RULES = {
  TALENT_INTERACTION_HISTORY_MAX: 10,
  RIVAL_INTERACTION_HISTORY_MAX: 12,
} as const;

export const AWARDS_RULES = {
  SEASON_LENGTH_WEEKS: 52,
  AWARDS_WEEK_IN_SEASON: 52,
  ELIGIBILITY_WINDOW_WEEKS: 52,
} as const;
