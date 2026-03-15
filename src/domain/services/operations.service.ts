import type { StudioManager } from '../studio-manager';
import type { DepartmentTrack, StudioSpecialization, StudioTier, FoundingProfile } from '../types';
import { ACTION_BALANCE } from '../balance-constants';

const ANIMATION_DIVISION_FOUNDING_COST = 8_000_000;

export class OperationsService {
  constructor(private readonly manager: StudioManager) {}

  // ── Studio identity / setup ────────────────────────────────────────

  setStudioName(name: string): { success: boolean; message: string } {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      return { success: false, message: 'Studio name must be at least 2 characters.' };
    }
    const sanitized = trimmed.slice(0, 32);
    this.manager.studioName = sanitized;
    return { success: true, message: `Studio renamed to ${sanitized}.` };
  }

  setStudioSpecialization(next: StudioSpecialization): { success: boolean; message: string } {
    if (this.manager.pendingSpecialization === next) {
      return { success: false, message: `${next} specialization is already selected for this turn.` };
    }
    this.manager.pendingSpecialization = next;
    if (this.manager.pendingSpecialization === this.manager.studioSpecialization) {
      return {
        success: true,
        message: `Specialization change reverted. ${this.manager.studioSpecialization} remains active with no charge this turn.`,
      };
    }
    const switchCost = this.manager.specializationCommittedWeek === null ? 0 : 1_000_000;
    return {
      success: true,
      message:
        switchCost > 0
          ? `${next} specialization staged. ${Math.round(switchCost / 1_000_000)}M will be charged on End Turn if committed.`
          : `${next} specialization staged. First specialization commitment is free on End Turn.`,
    };
  }

  completeFoundingSetup(input: {
    specialization: StudioSpecialization;
    foundingProfile: FoundingProfile;
  }): { success: boolean; message: string } {
    if (!this.manager.needsFoundingSetup) {
      return { success: false, message: 'Studio charter is already set.' };
    }

    this.manager.studioSpecialization = input.specialization;
    this.manager.pendingSpecialization = input.specialization;
    this.manager.specializationCommittedWeek = this.manager.currentWeek;
    this.manager.foundingProfile = input.foundingProfile;
    this.manager.needsFoundingSetup = false;
    this.manager.foundingSetupCompletedWeek = this.manager.currentWeek;
    this.manager.addChronicleEntry({
      week: this.manager.currentWeek,
      type: 'studioFounding',
      headline: `Studio charter set: ${input.specialization} specialization, ${input.foundingProfile} founding profile.`,
      impact: 'positive',
    });
    this.manager.tutorialService.beginTutorialIfEligible();
    return { success: true, message: 'Studio charter set.' };
  }

  // ── Upgrades & investments ─────────────────────────────────────────

  getMarketingTeamTierCap(): number {
    const capByTier: Record<StudioTier, number> = {
      indieStudio: 2,
      establishedIndie: 3,
      midTier: 4,
      majorStudio: ACTION_BALANCE.MARKETING_TEAM_MAX_LEVEL,
      globalPowerhouse: ACTION_BALANCE.MARKETING_TEAM_MAX_LEVEL,
    };
    return capByTier[this.manager.studioTier];
  }

  getMarketingTeamUpgradeCost(): number | null {
    const tierCap = this.getMarketingTeamTierCap();
    if (this.manager.marketingTeamLevel >= tierCap) return null;
    if (this.manager.marketingTeamLevel >= ACTION_BALANCE.MARKETING_TEAM_MAX_LEVEL) return null;
    const nextLevel = this.manager.marketingTeamLevel + 1;
    return ACTION_BALANCE.MARKETING_TEAM_UPGRADE_BASE_COST * nextLevel;
  }

  getStudioCapacityUpgradeTierCap(): number {
    const capByTier: Record<StudioTier, number> = {
      indieStudio: 1,
      establishedIndie: 2,
      midTier: 3,
      majorStudio: 4,
      globalPowerhouse: 5,
    };
    return capByTier[this.manager.studioTier];
  }

  getStudioCapacityUpgradeCost(): number | null {
    const tierCap = this.getStudioCapacityUpgradeTierCap();
    if (this.manager.studioCapacityUpgrades >= tierCap) return null;
    const next = this.manager.studioCapacityUpgrades + 1;
    return 1_200_000 + next * 900_000;
  }

  upgradeMarketingTeam(): { success: boolean; message: string } {
    const tierCap = this.getMarketingTeamTierCap();
    if (this.manager.marketingTeamLevel >= ACTION_BALANCE.MARKETING_TEAM_MAX_LEVEL) {
      return { success: false, message: 'Marketing team is already maxed.' };
    }
    if (this.manager.marketingTeamLevel >= tierCap) {
      return {
        success: false,
        message: `Marketing upgrades are capped at level ${tierCap} for your current studio tier.`,
      };
    }
    const nextLevel = this.manager.marketingTeamLevel + 1;
    const cost = this.getMarketingTeamUpgradeCost() ?? 0;
    if (this.manager.cash < cost) return { success: false, message: `Insufficient cash to upgrade marketing team (${Math.round(cost / 1000)}K).` };
    this.manager.adjustCash(-cost);
    this.manager.marketingTeamLevel = nextLevel;
    this.manager.evaluateBankruptcy();
    return { success: true, message: `Marketing team upgraded to level ${nextLevel}.` };
  }

  upgradeStudioCapacity(): { success: boolean; message: string } {
    const tierCap = this.getStudioCapacityUpgradeTierCap();
    if (this.manager.studioCapacityUpgrades >= tierCap) {
      return {
        success: false,
        message: `Facility expansions are capped at +${tierCap} slots for your current studio tier.`,
      };
    }
    const next = this.manager.studioCapacityUpgrades + 1;
    const cost = this.getStudioCapacityUpgradeCost() ?? 0;
    if (this.manager.cash < cost) {
      return { success: false, message: `Insufficient cash for facility expansion (${Math.round(cost / 1000)}K needed).` };
    }
    this.manager.adjustCash(-cost);
    this.manager.studioCapacityUpgrades = next;
    this.manager.evaluateBankruptcy();
    return { success: true, message: `Studio capacity expanded. Active slot cap is now ${this.manager.projectCapacityLimit}.` };
  }

  foundAnimationDivision(): { success: boolean; message: string } {
    if (this.manager.animationDivisionUnlocked) {
      return { success: false, message: 'Animation Division is already founded.' };
    }
    if (this.manager.cash < ANIMATION_DIVISION_FOUNDING_COST) {
      return {
        success: false,
        message: 'Insufficient cash to found Animation Division (8M needed).',
      };
    }

    this.manager.adjustCash(-ANIMATION_DIVISION_FOUNDING_COST);
    this.manager.animationDivisionUnlocked = true;
    this.manager.evaluateBankruptcy();
    return { success: true, message: 'Animation Division founded.' };
  }

  investDepartment(track: DepartmentTrack): { success: boolean; message: string } {
    const level = this.manager.departmentLevels[track];
    if (level >= 4) return { success: false, message: `${track} department is already maxed.` };
    const cost = 420_000 * (level + 1);
    if (this.manager.cash < cost) {
      return { success: false, message: `Insufficient cash to invest in ${track} department (${Math.round(cost / 1000)}K).` };
    }
    this.manager.adjustCash(-cost);
    this.manager.departmentLevels[track] = level + 1;
    this.manager.evaluateBankruptcy();
    return {
      success: true,
      message: `${track} department upgraded to level ${this.manager.departmentLevels[track]}.`,
    };
  }

  // ── Partnerships ───────────────────────────────────────────────────

  getActiveExclusivePartner(): string | null {
    if (!this.manager.exclusiveDistributionPartner || !this.manager.exclusivePartnerUntilWeek) return null;
    if (this.manager.currentWeek > this.manager.exclusivePartnerUntilWeek) {
      this.manager.exclusiveDistributionPartner = null;
      this.manager.exclusivePartnerUntilWeek = null;
      return null;
    }
    return this.manager.exclusiveDistributionPartner;
  }

  signExclusiveDistributionPartner(partner: string): { success: boolean; message: string } {
    const allowedPartners = ['Aster Peak Pictures', 'Silverline Distribution', 'Constellation Media'];
    if (!allowedPartners.includes(partner)) return { success: false, message: 'Unknown distribution partner.' };
    const current = this.getActiveExclusivePartner();
    if (current === partner) return { success: false, message: `${partner} partnership is already active.` };
    const cost = 480_000;
    if (this.manager.cash < cost) return { success: false, message: 'Insufficient cash for exclusive partnership.' };
    this.manager.adjustCash(-cost);
    if (current && current !== partner) {
      this.manager.adjustReputation(-1, 'distributor');
    }
    this.manager.exclusiveDistributionPartner = partner;
    this.manager.exclusivePartnerUntilWeek = this.manager.currentWeek + 26;
    this.manager.evaluateBankruptcy();
    return {
      success: true,
      message: `Signed exclusive distribution alignment with ${partner} through week ${this.manager.exclusivePartnerUntilWeek}.`,
    };
  }

  poachExecutiveTeam(): { success: boolean; message: string } {
    if (this.manager.executiveNetworkLevel >= 3) return { success: false, message: 'Executive network is already maxed.' };
    const next = this.manager.executiveNetworkLevel + 1;
    const cost = 900_000 * next;
    if (this.manager.cash < cost) return { success: false, message: `Insufficient cash for executive poach (${Math.round(cost / 1000)}K).` };
    this.manager.adjustCash(-cost);
    this.manager.executiveNetworkLevel = next;
    this.manager.adjustReputation(1, 'talent');
    this.manager.evaluateBankruptcy();
    return { success: true, message: `Executive network upgraded to level ${next}.` };
  }
}
