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
  const netRevenue = worldwideGross * 0.54;
  return netRevenue / Math.max(1, input.totalCost);
}

export function reputationDeltasFromRelease(input: {
  criticalScore: number;
  roi: number;
  awardsNominations: number;
  awardsWins: number;
  controversyPenalty: number;
}): { critics: number; audience: number } {
  let criticsDelta = 0;
  let audienceDelta = 0;
  const critical = input.criticalScore;

  if (critical > 90) criticsDelta += 12;
  else if (critical > 80) criticsDelta += 6;
  else if (critical < 40) criticsDelta -= 9;

  criticsDelta += input.awardsNominations * 2 + input.awardsWins * 5;

  if (input.roi > 3) audienceDelta += 10;
  else if (input.roi > 2) audienceDelta += 5;
  else if (input.roi < 1) audienceDelta -= 7;

  criticsDelta -= input.controversyPenalty * 0.6;
  audienceDelta -= input.controversyPenalty * 0.4;

  return {
    critics: clamp(criticsDelta, -12, 16),
    audience: clamp(audienceDelta, -10, 12),
  };
}

export function heatDeltaFromRelease(input: {
  currentHeat: number;
  criticalScore: number;
  roi: number;
  awardsNominations: number;
  awardsWins: number;
  controversyPenalty: number;
}): number {
  const deltas = reputationDeltasFromRelease(input);
  const averageDelta = (deltas.critics + deltas.audience) / 2;
  const nextHeat = clamp(input.currentHeat + averageDelta, 0, 100);
  return nextHeat - input.currentHeat;
}

export function awardsSeasonScore(input: {
  criticalScore: number;
  scriptQuality: number;
  conceptStrength: number;
  prestige: number;
  controversy: number;
  campaignBoost: number;
  festivalBoost: number;
  studioCriticsReputation: number;
}): number {
  const criticalWeight = clamp(input.criticalScore, 0, 100) * 0.5;
  const scriptWeight = clamp(input.scriptQuality, 0, 10) * 2.4;
  const conceptWeight = clamp(input.conceptStrength, 0, 10) * 1.4;
  const prestigeWeight = clamp(input.prestige, 0, 100) * 0.2;
  const reputationWeight = clamp(input.studioCriticsReputation, 0, 100) * 0.12;
  const bonus = clamp(input.campaignBoost + input.festivalBoost, -20, 25);
  const controversyPenalty = clamp(input.controversy, 0, 100) * 0.16;
  return clamp(
    criticalWeight + scriptWeight + conceptWeight + prestigeWeight + reputationWeight + bonus - controversyPenalty,
    0,
    100
  );
}

export function awardsNominationProbability(score: number): number {
  if (score >= 90) return 0.65;
  if (score >= 82) return 0.48;
  if (score >= 74) return 0.3;
  if (score >= 66) return 0.16;
  if (score >= 58) return 0.08;
  return 0.05;
}

export function awardsWinProbability(input: {
  score: number;
  nominations: number;
  controversy: number;
}): number {
  const base = 0.03 + awardsNominationProbability(input.score) * 0.3;
  const nominationBoost = Math.min(0.12, input.nominations * 0.028);
  const controversyPenalty = clamp(input.controversy, 0, 100) * 0.0015;
  return clamp(base + nominationBoost - controversyPenalty, 0.02, 0.6);
}
