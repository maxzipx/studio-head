import {
  clamp,
  foundingProfileModifiers,
  specializationProfile,
  type ArcOutcomeModifiers,
  type FoundingProfileModifiers,
  type SpecializationProfile,
} from './studio-manager.constants';
import type { DepartmentTrack, FoundingProfile, StoryArcState, StudioSpecialization } from './types';

export interface StudioModifierContext {
  studioSpecialization: StudioSpecialization;
  foundingProfile: FoundingProfile;
}

export interface DepartmentModifierContext {
  departmentLevels: Record<DepartmentTrack, number>;
}

export interface ExecutiveModifierContext {
  executiveNetworkLevel: number;
}

export interface ArcModifierContext extends StudioModifierContext, DepartmentModifierContext, ExecutiveModifierContext {
  storyArcs: Record<string, StoryArcState>;
}

export function computeStudioModifiers(context: StudioModifierContext): {
  specializationProfile: SpecializationProfile;
  foundingProfileEffects: FoundingProfileModifiers;
} {
  return {
    specializationProfile: specializationProfile(context.studioSpecialization),
    foundingProfileEffects: foundingProfileModifiers(context.foundingProfile),
  };
}

export function getDepartmentModifiers(context: DepartmentModifierContext): {
  developmentGreenlightFeeReduction: number;
  developmentScriptSprintQualityBoost: number;
  productionEfficiencyMultiplier: number;
  arcDistributionLeverage: number;
  counterOfferLeverage: number;
} {
  return {
    developmentGreenlightFeeReduction: context.departmentLevels.development * 15_000,
    developmentScriptSprintQualityBoost: context.departmentLevels.development * 0.08,
    productionEfficiencyMultiplier: clamp(1 - context.departmentLevels.production * 0.03, 0.82, 1.05),
    arcDistributionLeverage: context.departmentLevels.distribution * 0.015,
    counterOfferLeverage: context.departmentLevels.distribution * 0.025,
  };
}

export function getExecutiveNetworkModifiers(context: ExecutiveModifierContext): {
  arcDistributionLeverage: number;
  arcTalentLeverage: number;
  negotiationChanceBonus: number;
  counterOfferLeverage: number;
} {
  return {
    arcDistributionLeverage: context.executiveNetworkLevel * 0.01,
    arcTalentLeverage: context.executiveNetworkLevel * 0.012,
    negotiationChanceBonus: context.executiveNetworkLevel * 0.015,
    counterOfferLeverage: context.executiveNetworkLevel * 0.02,
  };
}

export function getTrackingConfidenceModifier(context: StudioModifierContext): number {
  return computeStudioModifiers(context).foundingProfileEffects.trackingConfidenceBonus;
}

export function getTalentNegotiationChanceModifier(
  context: StudioModifierContext & ExecutiveModifierContext
): number {
  return (
    computeStudioModifiers(context).foundingProfileEffects.negotiationChanceBonus +
    getExecutiveNetworkModifiers(context).negotiationChanceBonus
  );
}

export function getAwardsCampaignModifier(context: StudioModifierContext): number {
  return computeStudioModifiers(context).foundingProfileEffects.awardsCampaignBonus;
}

export function getFestivalBuzzModifier(context: StudioModifierContext): number {
  return computeStudioModifiers(context).foundingProfileEffects.festivalBuzzBonus;
}

export function getFranchiseMomentumModifier(context: StudioModifierContext): number {
  return computeStudioModifiers(context).foundingProfileEffects.franchiseMomentumBonus;
}

export function getReleaseSpecializationModifiers(context: StudioModifierContext): SpecializationProfile {
  return computeStudioModifiers(context).specializationProfile;
}

export function getDistributionCounterLeverageModifier(
  context: DepartmentModifierContext & ExecutiveModifierContext
): number {
  return getDepartmentModifiers(context).counterOfferLeverage + getExecutiveNetworkModifiers(context).counterOfferLeverage;
}

export function computeArcOutcomeModifiers(context: ArcModifierContext): ArcOutcomeModifiers {
  const modifiers: ArcOutcomeModifiers = {
    talentLeverage: 0,
    distributionLeverage: 0,
    burnMultiplier: 1,
    hypeDecayStep: 2,
    releaseHeatMomentum: 0,
    categoryBias: {},
  };
  const studioModifiers = computeStudioModifiers(context);
  const departmentModifiers = getDepartmentModifiers(context);
  const executiveModifiers = getExecutiveNetworkModifiers(context);

  for (const [arcId, arc] of Object.entries(context.storyArcs)) {
    if (arc.status === 'resolved') {
      if (arcId === 'awards-circuit') {
        modifiers.talentLeverage += 0.05;
        modifiers.releaseHeatMomentum += 1;
        modifiers.categoryBias.marketing = (modifiers.categoryBias.marketing ?? 0) + 0.2;
      } else if (arcId === 'exhibitor-war') {
        modifiers.distributionLeverage += 0.05;
        modifiers.categoryBias.finance = (modifiers.categoryBias.finance ?? 0) + 0.12;
      } else if (arcId === 'financier-control') {
        modifiers.distributionLeverage += 0.02;
        modifiers.burnMultiplier *= 0.98;
      } else if (arcId === 'leak-piracy') {
        modifiers.hypeDecayStep -= 0.2;
        modifiers.distributionLeverage += 0.02;
      } else if (arcId === 'talent-meltdown') {
        modifiers.talentLeverage += 0.04;
        modifiers.categoryBias.talent = (modifiers.categoryBias.talent ?? 0) + 0.15;
      } else if (arcId === 'franchise-pivot') {
        modifiers.distributionLeverage += 0.03;
        modifiers.burnMultiplier *= 1.02;
        modifiers.categoryBias.finance = (modifiers.categoryBias.finance ?? 0) + 0.1;
      }
    } else if (arc.status === 'failed') {
      if (arcId === 'awards-circuit') {
        modifiers.talentLeverage -= 0.04;
        modifiers.releaseHeatMomentum -= 1;
      } else if (arcId === 'exhibitor-war') {
        modifiers.distributionLeverage -= 0.05;
        modifiers.hypeDecayStep += 0.2;
      } else if (arcId === 'financier-control') {
        modifiers.burnMultiplier *= 1.04;
        modifiers.talentLeverage -= 0.03;
      } else if (arcId === 'leak-piracy') {
        modifiers.hypeDecayStep += 0.35;
        modifiers.distributionLeverage -= 0.03;
      } else if (arcId === 'talent-meltdown') {
        modifiers.talentLeverage -= 0.08;
        modifiers.categoryBias.talent = (modifiers.categoryBias.talent ?? 0) + 0.08;
      } else if (arcId === 'franchise-pivot') {
        modifiers.burnMultiplier *= 0.99;
        modifiers.distributionLeverage -= 0.02;
      }
    }
  }

  modifiers.distributionLeverage += studioModifiers.specializationProfile.distributionLeverage;
  modifiers.distributionLeverage += departmentModifiers.arcDistributionLeverage;
  modifiers.distributionLeverage += executiveModifiers.arcDistributionLeverage;
  modifiers.talentLeverage += executiveModifiers.arcTalentLeverage;
  if (context.studioSpecialization === 'blockbuster') {
    modifiers.hypeDecayStep = Math.max(0.8, modifiers.hypeDecayStep - 0.2);
  } else if (context.studioSpecialization === 'prestige') {
    modifiers.releaseHeatMomentum += 0.6;
  }

  modifiers.burnMultiplier = clamp(modifiers.burnMultiplier, 0.85, 1.2);
  modifiers.distributionLeverage = clamp(modifiers.distributionLeverage, -0.12, 0.12);
  modifiers.talentLeverage = clamp(modifiers.talentLeverage, -0.2, 0.2);
  modifiers.hypeDecayStep = clamp(modifiers.hypeDecayStep, 0.8, 3.2);
  modifiers.releaseHeatMomentum = clamp(modifiers.releaseHeatMomentum, -3, 3);
  return modifiers;
}
