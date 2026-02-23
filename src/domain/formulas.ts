import type { MovieGenre } from './types';

const GENRE_BASELINE_OPENING: Record<MovieGenre, number> = {
  action: 28_000_000,
  drama: 9_000_000,
  comedy: 14_000_000,
  horror: 12_000_000,
  thriller: 13_500_000,
  sciFi: 21_000_000,
  animation: 24_000_000,
  documentary: 2_500_000,
};

const INTERNATIONAL_FACTOR: Record<MovieGenre, number> = {
  action: 2.4,
  drama: 1.2,
  comedy: 1.4,
  horror: 1.6,
  thriller: 1.5,
  sciFi: 2.2,
  animation: 2.8,
  documentary: 0.8,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function projectedCriticalScore(input: {
  scriptQuality: number;
  directorCraft: number;
  leadActorCraft: number;
  productionSpend: number;
  conceptStrength: number;
  editorialCutChoice: number;
  crisisPenalty: number;
  chemistryPenalty: number;
}): number {
  const productionValue = 1 - Math.exp(-input.productionSpend / 30_000_000);
  const base =
    (input.scriptQuality / 10) * 0.35 +
    (input.directorCraft / 10) * 0.25 +
    (input.leadActorCraft / 10) * 0.15 +
    productionValue * 0.1 +
    (input.conceptStrength / 10) * 0.1 +
    (input.editorialCutChoice / 10) * 0.05;

  const score = base * 100 - input.crisisPenalty - input.chemistryPenalty;
  return clamp(score, 0, 100);
}

export function projectedOpeningWeekendRange(input: {
  genre: MovieGenre;
  hypeScore: number;
  starPower: number;
  marketingBudget: number;
  totalBudget: number;
  seasonalMultiplier?: number;
  screensMultiplier?: number;
}): { low: number; high: number; midpoint: number } {
  const hypeMultiplier = 0.6 + (clamp(input.hypeScore, 0, 100) / 100) * 0.8;
  const starMultiplier = 0.7 + (clamp(input.starPower, 0, 10) / 10) * 0.6;
  const marketingEfficiency =
    1 + ((input.marketingBudget / Math.max(1, input.totalBudget)) * 0.4);
  const seasonal = input.seasonalMultiplier ?? 1;
  const screens = input.screensMultiplier ?? 1;

  const midpoint =
    GENRE_BASELINE_OPENING[input.genre] *
    hypeMultiplier *
    starMultiplier *
    marketingEfficiency *
    seasonal *
    screens;

  return {
    low: midpoint * 0.8,
    midpoint,
    high: midpoint * 1.2,
  };
}

export function projectedROI(input: {
  openingWeekend: number;
  criticalScore: number;
  audienceScore: number;
  genre: MovieGenre;
  totalCost: number;
}): number {
  const legMultiplier =
    2.1 +
    (clamp(input.criticalScore, 0, 100) / 100) * 0.9 +
    (clamp(input.audienceScore, 0, 100) / 100) * 0.8;
  const domesticTotal = input.openingWeekend * legMultiplier;
  const internationalTotal = domesticTotal * INTERNATIONAL_FACTOR[input.genre];
  const worldwideGross = domesticTotal + internationalTotal;
  const netRevenue = worldwideGross * 0.52;
  return netRevenue / Math.max(1, input.totalCost);
}

export function heatDeltaFromRelease(input: {
  currentHeat: number;
  criticalScore: number;
  roi: number;
  awardsNominations: number;
  awardsWins: number;
  controversyPenalty: number;
}): number {
  let delta = 0;
  const critical = input.criticalScore;
  if (critical > 90) delta += 15;
  else if (critical > 80) delta += 8;
  else if (critical < 40) delta -= 10;

  if (input.roi > 3) delta += 12;
  else if (input.roi > 2) delta += 6;
  else if (input.roi < 1) delta -= 8;

  delta += input.awardsNominations * 3 + input.awardsWins * 8;
  delta -= input.controversyPenalty;

  const nextHeat = clamp(input.currentHeat + delta, 0, 100);
  return nextHeat - input.currentHeat;
}
