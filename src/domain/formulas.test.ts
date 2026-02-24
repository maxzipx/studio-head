import { describe, expect, it } from 'vitest';

import {
  heatDeltaFromRelease,
  projectedCriticalScore,
  projectedOpeningWeekendRange,
  projectedROI,
} from './formulas';

describe('formulas', () => {
  it('computes critical score in range 0-100', () => {
    const score = projectedCriticalScore({
      scriptQuality: 8,
      directorCraft: 7.5,
      leadActorCraft: 7,
      productionSpend: 18_000_000,
      conceptStrength: 6.5,
      editorialCutChoice: 6,
      crisisPenalty: 4,
      chemistryPenalty: 2,
    });

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThan(55);
  });

  it('computes opening weekend range with ordering', () => {
    const range = projectedOpeningWeekendRange({
      genre: 'thriller',
      hypeScore: 50,
      starPower: 7,
      marketingBudget: 2_000_000,
      totalBudget: 20_000_000,
    });

    expect(range.low).toBeLessThan(range.midpoint);
    expect(range.midpoint).toBeLessThan(range.high);
    expect(range.midpoint).toBeGreaterThan(1_000_000);
  });

  it('computes ROI as positive multiple for viable performance', () => {
    const roi = projectedROI({
      openingWeekend: 22_000_000,
      criticalScore: 78,
      audienceScore: 82,
      genre: 'action',
      totalCost: 45_000_000,
    });

    expect(roi).toBeGreaterThan(1);
  });

  it('computes heat delta from quality and roi', () => {
    const delta = heatDeltaFromRelease({
      currentHeat: 40,
      criticalScore: 88,
      roi: 2.5,
      awardsNominations: 1,
      awardsWins: 0,
      controversyPenalty: 0,
    });

    // criticalScore 88 -> critics +8, awardsNominations 1 -> critics +3, roi 2.5 -> audience +6
    // average of critics(11) and audience(6) -> 8.5
    expect(delta).toBe(8.5);
  });
});
