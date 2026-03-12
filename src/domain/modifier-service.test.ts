import { describe, expect, it } from 'vitest';

import {
  computeArcOutcomeModifiers,
  computeStudioModifiers,
  getLegacyFoundingProfileEffects,
  getLegacySpecializationProfile,
  getReleaseSpecializationModifiers,
} from './modifier-service';
import { StudioManager } from './studio-manager';

describe('modifier-service', () => {
  it('flattens specialization and founding modifiers into explicit studio fields', () => {
    const modifiers = computeStudioModifiers({
      studioSpecialization: 'blockbuster',
      foundingProfile: 'starDriven',
    });

    expect(modifiers).toEqual({
      openingWeekendMultiplier: 1.09,
      criticalDelta: -3,
      burnMultiplier: 1.03,
      awardsBoost: -4,
      distributionLeverage: 0.025,
      negotiationChanceBonus: 0.035,
      trackingConfidenceBonus: 0,
      franchiseMomentumBonus: 0,
      awardsCampaignBonus: 0,
      festivalBuzzBonus: 0,
      arcHypeDecayAdjustment: -0.2,
      arcReleaseHeatMomentumBonus: 0,
    });
  });

  it('preserves legacy specialization and founding profile compatibility views', () => {
    const context = {
      studioSpecialization: 'prestige' as const,
      foundingProfile: 'culturalBrand' as const,
    };

    expect(getLegacySpecializationProfile(context)).toEqual({
      openingMultiplier: 0.93,
      criticalDelta: 4,
      burnMultiplier: 1.01,
      awardsBoost: 6,
      distributionLeverage: 0.005,
    });
    expect(getLegacyFoundingProfileEffects(context)).toEqual({
      negotiationChanceBonus: 0,
      trackingConfidenceBonus: 0,
      franchiseMomentumBonus: 0,
      awardsCampaignBonus: 4,
      festivalBuzzBonus: 3,
    });
  });

  it('feeds release-facing helpers and arc calculations from the flattened modifier shape', () => {
    const releaseModifiers = getReleaseSpecializationModifiers({
      studioSpecialization: 'prestige',
      foundingProfile: 'none',
    });
    const arcModifiers = computeArcOutcomeModifiers({
      studioSpecialization: 'prestige',
      foundingProfile: 'none',
      departmentLevels: { development: 0, production: 0, distribution: 0 },
      executiveNetworkLevel: 0,
      storyArcs: {},
    });

    expect(releaseModifiers).toEqual({
      openingWeekendMultiplier: 0.93,
      criticalDelta: 4,
      awardsBoost: 6,
      distributionLeverage: 0.005,
      burnMultiplier: 1.01,
    });
    expect(arcModifiers.releaseHeatMomentum).toBe(0.6);
    expect(arcModifiers.hypeDecayStep).toBe(2);
  });

  it('keeps StudioManager legacy getters numerically aligned', () => {
    const manager = new StudioManager({
      startWithSeedProjects: false,
      includeOpeningDecisions: false,
    });

    manager.studioSpecialization = 'indie';
    manager.foundingProfile = 'dataDriven';

    expect(manager.specializationProfile).toEqual({
      openingMultiplier: 0.95,
      criticalDelta: 1,
      burnMultiplier: 0.92,
      awardsBoost: 2,
      distributionLeverage: -0.005,
    });
    expect(manager.foundingProfileEffects).toEqual({
      negotiationChanceBonus: 0,
      trackingConfidenceBonus: 0.045,
      franchiseMomentumBonus: 0,
      awardsCampaignBonus: 0,
      festivalBuzzBonus: 0,
    });
  });
});
