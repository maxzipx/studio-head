export const SCRIPT_MARKET_REFILL_RULES = {
  targetOffers: 4,
  topDemandBiasChance: 0.45,
  topDemandWeightWindow: 0.01,
  refillSafetyCap: 12,
  hotDemandTiltThreshold: 1.08,
  coldDemandTiltThreshold: 0.94,
  bargain: {
    qualityPenaltyBase: 0.5,
    qualityPenaltySpread: 0.2,
    conceptPenaltyBase: 0.5,
    conceptPenaltySpread: 0.2,
    priceMultiplierBase: 0.1,
    priceMultiplierSpread: 0.1,
  },
  biddingWar: {
    qualityBoostBase: 1.5,
    qualityBoostSpread: 1,
    conceptBoostBase: 1.5,
    conceptBoostSpread: 1,
    priceMultiplierBase: 2.5,
    priceMultiplierSpread: 1.5,
  },
  standard: {
    qualityJitterSpread: 2,
    conceptJitterSpread: 2,
    priceMultiplierBase: 0.7,
    priceMultiplierSpread: 0.7,
  },
} as const;

export const CRISIS_GENERATION_RULES = {
  recentSuppressionWeeks: 1,
  recentSuppressionMultiplier: 0.4,
  baseThresholdByPhase: {
    preProduction: 0.08,
    production: 0.16,
    postProduction: 0.1,
  },
} as const;

export const EVENT_GENERATION_RULES = {
  maxQueuedDecisions: 4,
  maxPickAttempts: 3,
} as const;

export const EVENT_WEIGHT_RULES = {
  projectScopeWeightStep: 0.32,
  projectScopeWeightCap: 1.3,
  financeLowCashThreshold: 25_000_000,
  financeWeightBonus: 0.45,
  marketingLowHeatWeightBonus: 0.35,
  operationsActiveCrisisMultiplier: 0.75,
  repeatCategoryPenalty: 0.7,
  repeatCategoryStackPenalty: 0.55,
  awardsSeasonMultiplier: 1.4,
  summerCampaignMultiplier: 1.2,
  holidayOperationsMultiplier: 1.3,
} as const;
