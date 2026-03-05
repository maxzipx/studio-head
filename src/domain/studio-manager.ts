import {
  ACTION_BALANCE,
  BANKRUPTCY_RULES,
  MEMORY_RULES,
  SESSION_RULES,
  STUDIO_STARTING,
  STUDIO_TIER_REQUIREMENTS,
  TURN_RULES,
} from './balance-constants';
import { createId } from './id';
import {
  projectedROI,
} from './formulas';
import {
  type NegotiationRoundPreview,
  type NegotiationSnapshot,
} from './studio-manager.negotiation';
import {
  applyMajorIpReleaseProgressForManager,
  evaluateMajorIpContractBreachesForManager,
  getBlockingMajorIpCommitmentForManager,
  getMajorIpCommitmentsForManager,
  initializeMajorIpCommitmentForManager,
} from './studio-manager.major-ip';
import {
  runGreenlightReviewForManager,
  runTestScreeningForManager,
  runReshootsForManager,
  runTrackingLeverageForManager,
  runScriptDevelopmentSprintForManager,
  runPostProductionPolishPassForManager,
  runFestivalSubmissionForManager,
  abandonProjectForManager,
  runOptionalActionForManager,
  runMarketingPushOnProjectForManager,
} from './project.service';
import { getEventDeck } from './event-deck';
import {
  createOpeningDecisions,
  createSeedProjects,
  createSeedRivals,
  createSeedTalentPool,
} from './seeds';
import { adjustCashForManager, evaluateBankruptcyForManager } from './finance.service';
import { FranchiseService } from './services/franchise.service';
import { ProjectLifecycleService } from './services/project-lifecycle.service';
import { RivalAiService } from './services/rival-ai.service';
import { ReleaseService } from './services/release.service';
import { TalentService } from './services/talent.service';
import { EventService } from './services/event.service';
import {
  ARC_LABELS,
  buildIpTemplate,
  clamp,
  createInitialGenreCycles,
  initialBudgetForGenre,
  specializationProfile,
  TIER_RANK,
  type ArcOutcomeModifiers,
  type SpecializationProfile,
} from './studio-manager.constants';
import { STUDIO_TIER_LABELS } from './types';
import type {
  AwardsSeasonRecord,
  CastRequirements,
  ChronicleEntry,
  CrisisEvent,
  DecisionCategory,
  DecisionItem,
  DistributionOffer,
  DepartmentTrack,
  EventTemplate,
  FranchiseTrack,
  FranchiseProjectionModifiers,
  FranchiseStrategy,
  FranchiseStatusSnapshot,
  GenreCycleState,
  InboxNotification,
  IndustryNewsItem,
  IpKind,
  MilestoneRecord,
  MovieGenre,
  MovieProject,
  NegotiationAction,
  OwnedIp,
  PlayerNegotiation,
  ProjectBudgetPlan,
  ReleaseReport,
  RivalInteractionKind,
  RivalStudio,
  ScriptPitch,
  SequelCandidate,
  SequelEligibility,
  StoryArcState,
  StudioReputation,
  StudioSpecialization,
  StudioTier,
  Talent,
  TalentInteractionKind,
  TalentRole,
  TalentTrustLevel,
  WeekSummary,
} from './types';

export class StudioManager {
  readonly crisisRng: () => number;
  readonly eventRng: () => number;
  readonly negotiationRng: () => number;
  readonly rivalRng: () => number;
  readonly eventDeck: EventTemplate[] = getEventDeck();
  readonly lastEventWeek = new Map<string, number>();

  studioName = 'Project Greenlight';
  cash: number = STUDIO_STARTING.CASH;
  reputation: StudioReputation = {
    critics: STUDIO_STARTING.REPUTATION_PILLAR,
    talent: STUDIO_STARTING.REPUTATION_PILLAR,
    distributor: STUDIO_STARTING.REPUTATION_PILLAR,
    audience: STUDIO_STARTING.REPUTATION_PILLAR,
  };
  isBankrupt = false;
  bankruptcyReason: string | null = null;
  consecutiveLowCashWeeks = 0;
  firstSessionComplete = false;
  currentWeek = 1;
  turnLengthWeeks: 1 | 2 = TURN_RULES.MIN_WEEKS;
  pendingCrises: CrisisEvent[] = [];
  distributionOffers: DistributionOffer[] = [];
  pendingReleaseReveals: string[] = [];
  decisionQueue: DecisionItem[] = createOpeningDecisions();
  inboxNotifications: InboxNotification[] = [];
  newlyAcquiredProjectId: string | null = null;
  activeProjects: MovieProject[] = createSeedProjects();
  franchises: FranchiseTrack[] = [];
  talentSeed = 0;
  talentPool: Talent[] = createSeedTalentPool(this.talentSeed);
  scriptMarket: ScriptPitch[] = [];
  rivals: RivalStudio[] = createSeedRivals();
  industryNewsLog: IndustryNewsItem[] = [];
  playerNegotiations: PlayerNegotiation[] = [];
  storyFlags: Record<string, number> = {};
  storyArcs: Record<string, StoryArcState> = {};
  recentDecisionCategories: DecisionCategory[] = [];
  lastWeekSummary: WeekSummary | null = null;
  awardsHistory: AwardsSeasonRecord[] = [];
  awardsSeasonsProcessed: number[] = [];
  genreCycles: Record<MovieGenre, GenreCycleState> = createInitialGenreCycles();
  studioChronicle: ChronicleEntry[] = [];
  releaseReports: ReleaseReport[] = [];
  pendingFinalReleaseReveals: string[] = [];
  milestones: MilestoneRecord[] = [];
  lifetimeRevenue = 0;
  lifetimeProfit = 0;
  lifetimeExpenses = 0;
  marketingTeamLevel = 1;
  ownedIps: OwnedIp[] = [];
  studioCapacityUpgrades = 0;
  studioSpecialization: StudioSpecialization = 'balanced';
  pendingSpecialization: StudioSpecialization = 'balanced';
  specializationCommittedWeek: number | null = null;
  departmentLevels: Record<DepartmentTrack, number> = {
    development: 0,
    production: 0,
    distribution: 0,
  };
  exclusiveDistributionPartner: string | null = null;
  exclusivePartnerUntilWeek: number | null = null;
  executiveNetworkLevel = 0;
  marketInitialized = false;
  lastMarketBurstWeek = 0;
  marketDirectorIdx = 0;
  marketActorIdx = 0;
  marketLeadActorIdx = 0;
  marketLeadActressIdx = 0;
  private readonly lifecycleService = new ProjectLifecycleService(this);
  private readonly franchiseService = new FranchiseService(this);
  private readonly rivalAiService = new RivalAiService(this);
  private readonly eventService = new EventService(this);
  private readonly releaseService = new ReleaseService(this);
  private readonly talentService = new TalentService(this);

  get studioHeat(): number {
    return Math.round(
      (this.reputation.critics + this.reputation.talent + this.reputation.distributor + this.reputation.audience) / 4
    );
  }

  get studioTier(): StudioTier {
    const heat = this.studioHeat;
    const releasedCount = this.activeProjects.filter((p) => p.phase === 'released').length;
    if (
      heat >= STUDIO_TIER_REQUIREMENTS.globalPowerhouse.heat &&
      releasedCount >= STUDIO_TIER_REQUIREMENTS.globalPowerhouse.releasedFilms
    ) {
      return 'globalPowerhouse';
    }
    if (heat >= STUDIO_TIER_REQUIREMENTS.majorStudio.heat && releasedCount >= STUDIO_TIER_REQUIREMENTS.majorStudio.releasedFilms) {
      return 'majorStudio';
    }
    if (heat >= STUDIO_TIER_REQUIREMENTS.midTier.heat && releasedCount >= STUDIO_TIER_REQUIREMENTS.midTier.releasedFilms) {
      return 'midTier';
    }
    if (
      heat >= STUDIO_TIER_REQUIREMENTS.establishedIndie.heat &&
      releasedCount >= STUDIO_TIER_REQUIREMENTS.establishedIndie.releasedFilms
    ) {
      return 'establishedIndie';
    }
    return 'indieStudio';
  }

  get legacyScore(): number {
    const releasedCount = this.activeProjects.filter((p) => p.phase === 'released').length;
    const cashScore = clamp(this.cash / 50_000_000 * 20, 0, 20);
    const filmScore = Math.min(releasedCount * 4, 30);
    return clamp(Math.round(this.studioHeat * 0.5 + cashScore + filmScore), 0, 100);
  }

  get projectCapacityLimit(): number {
    const baseByTier: Record<StudioTier, number> = {
      indieStudio: 3,
      establishedIndie: 4,
      midTier: 6,
      majorStudio: 8,
      globalPowerhouse: 10,
    };
    return baseByTier[this.studioTier] + this.studioCapacityUpgrades;
  }

  getMarketingTeamTierCap(): number {
    const capByTier: Record<StudioTier, number> = {
      indieStudio: 2,
      establishedIndie: 3,
      midTier: 4,
      majorStudio: ACTION_BALANCE.MARKETING_TEAM_MAX_LEVEL,
      globalPowerhouse: ACTION_BALANCE.MARKETING_TEAM_MAX_LEVEL,
    };
    return capByTier[this.studioTier];
  }

  getMarketingTeamUpgradeCost(): number | null {
    const tierCap = this.getMarketingTeamTierCap();
    if (this.marketingTeamLevel >= tierCap) return null;
    if (this.marketingTeamLevel >= ACTION_BALANCE.MARKETING_TEAM_MAX_LEVEL) return null;
    const nextLevel = this.marketingTeamLevel + 1;
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
    return capByTier[this.studioTier];
  }

  getStudioCapacityUpgradeCost(): number | null {
    const tierCap = this.getStudioCapacityUpgradeTierCap();
    if (this.studioCapacityUpgrades >= tierCap) return null;
    const next = this.studioCapacityUpgrades + 1;
    return 1_200_000 + next * 900_000;
  }

  get projectCapacityUsed(): number {
    return this.activeProjects.filter((project) => project.phase !== 'released').length;
  }

  getMajorIpCommitments(): {
    ipId: string;
    name: string;
    remainingReleases: number;
    requiredReleases: number;
    deadlineWeek: number;
    breached: boolean;
    hasActiveInstallment: boolean;
    isBlocking: boolean;
  }[] {
    return getMajorIpCommitmentsForManager(this);
  }

  get specializationProfile(): SpecializationProfile {
    return specializationProfile(this.studioSpecialization);
  }

  private initializeMajorIpCommitment(ip: OwnedIp): { required: number; deadlineWeek: number } | null {
    return initializeMajorIpCommitmentForManager(this, ip);
  }

  private getBlockingMajorIpCommitment(targetIpId?: string): { ip: OwnedIp; remaining: number; deadlineWeek: number } | null {
    return getBlockingMajorIpCommitmentForManager(this, targetIpId);
  }

  applyMajorIpReleaseProgress(project: MovieProject, events: string[]): void {
    applyMajorIpReleaseProgressForManager(this, project, events);
  }

  private evaluateMajorIpContractBreaches(events: string[]): void {
    evaluateMajorIpContractBreachesForManager(this, events);
  }

  adjustReputation(delta: number, pillar: keyof StudioReputation | 'all' = 'all'): void {
    if (pillar === 'all') {
      this.reputation.critics = clamp(this.reputation.critics + delta, 0, 100);
      this.reputation.talent = clamp(this.reputation.talent + delta, 0, 100);
      this.reputation.distributor = clamp(this.reputation.distributor + delta, 0, 100);
      this.reputation.audience = clamp(this.reputation.audience + delta, 0, 100);
    } else {
      this.reputation[pillar] = clamp(this.reputation[pillar] + delta, 0, 100);
    }
  }

  adjustCash(delta: number): void {
    adjustCashForManager(this, delta);
  }

  getTalentTrustLevel(talent: Talent): TalentTrustLevel {
    return this.talentService.getTalentTrustLevel(talent);
  }

  getTalentNegotiationOutlook(talent: Talent) {
    return this.talentService.getTalentNegotiationOutlook(talent);
  }

  canOpenTalentNegotiation(talent: Talent): { ok: boolean; lockoutWeeks: number; reason: string | null } {
    return this.talentService.canOpenTalentNegotiation(talent);
  }

  recordTalentInteraction(
    talent: Talent,
    input: {
      kind: TalentInteractionKind;
      trustDelta: number;
      loyaltyDelta: number;
      note: string;
      projectId?: string | null;
    }
  ): void {
    this.talentService.recordTalentInteraction(talent, input);
  }

  private getRivalMemory(rival: RivalStudio): RivalStudio['memory'] {
    if (!rival.memory) {
      const baseHostility =
        rival.personality === 'blockbusterFactory' ? 58 : rival.personality === 'scrappyUpstart' ? 55 : 50;
      const baseRespect =
        rival.personality === 'prestigeHunter' ? 60 : rival.personality === 'genreSpecialist' ? 56 : 52;
      rival.memory = {
        hostility: baseHostility,
        respect: baseRespect,
        retaliationBias: 50,
        cooperationBias: 45,
        interactionHistory: [],
      };
    }
    if (!Array.isArray(rival.memory.interactionHistory)) {
      rival.memory.interactionHistory = [];
    }
    return rival.memory;
  }

  getRivalStance(rival: RivalStudio): 'friendly' | 'warm' | 'neutral' | 'competitor' | 'rival' {
    const memory = this.getRivalMemory(rival);
    const score = memory.hostility - memory.respect;
    if (score >= 26) return 'rival';
    if (score >= 10) return 'competitor';
    if (score <= -22) return 'friendly';
    if (score <= -8) return 'warm';
    return 'neutral';
  }

  recordRivalInteraction(
    rival: RivalStudio,
    input: {
      kind: RivalInteractionKind;
      hostilityDelta: number;
      respectDelta: number;
      note: string;
      projectId?: string | null;
    }
  ): void {
    const memory = this.getRivalMemory(rival);
    memory.hostility = clamp(Math.round(memory.hostility + input.hostilityDelta), 0, 100);
    memory.respect = clamp(Math.round(memory.respect + input.respectDelta), 0, 100);
    memory.retaliationBias = clamp(Math.round(memory.retaliationBias + input.hostilityDelta * 0.6), 0, 100);
    memory.cooperationBias = clamp(Math.round(memory.cooperationBias + input.respectDelta * 0.6), 0, 100);
    memory.interactionHistory.push({
      week: this.currentWeek,
      kind: input.kind,
      hostilityDelta: Math.round(input.hostilityDelta),
      respectDelta: Math.round(input.respectDelta),
      note: input.note,
      projectId: input.projectId ?? null,
    });
    if (memory.interactionHistory.length > MEMORY_RULES.RIVAL_INTERACTION_HISTORY_MAX) {
      memory.interactionHistory = memory.interactionHistory.slice(-MEMORY_RULES.RIVAL_INTERACTION_HISTORY_MAX);
    }
  }

  constructor(input?: {
    crisisRng?: () => number;
    eventRng?: () => number;
    negotiationRng?: () => number;
    rivalRng?: () => number;
    talentSeed?: number;
    startWithSeedProjects?: boolean;
    includeOpeningDecisions?: boolean;
  }) {
    this.crisisRng = input?.crisisRng ?? Math.random;
    this.eventRng = input?.eventRng ?? Math.random;
    this.negotiationRng = input?.negotiationRng ?? Math.random;
    this.rivalRng = input?.rivalRng ?? Math.random;
    const inputTalentSeed = input?.talentSeed;
    if (Number.isFinite(inputTalentSeed)) {
      this.talentSeed = Math.max(0, Math.floor(Math.abs(inputTalentSeed as number)));
      this.talentPool = createSeedTalentPool(this.talentSeed);
    }
    if (input?.startWithSeedProjects === false) {
      this.activeProjects = [];
    }
    if (input?.includeOpeningDecisions === false) {
      this.decisionQueue = [];
    }
    this.bindOpeningDecisionToLeadProject();
    this.refreshIpMarketplace();
    this.eventService.refillScriptMarket([]);
    this.refreshTalentMarket();
  }

  get canEndWeek(): boolean {
    return this.pendingCrises.length === 0;
  }

  setTurnLengthWeeks(weeks: number): { success: boolean; message: string } {
    const normalized = Math.round(weeks);
    if (normalized !== TURN_RULES.MIN_WEEKS && normalized !== TURN_RULES.MAX_WEEKS) {
      return { success: false, message: `Turn length must be ${TURN_RULES.MIN_WEEKS} or ${TURN_RULES.MAX_WEEKS} weeks.` };
    }
    this.turnLengthWeeks = normalized;
    return { success: true, message: `Turn length set to ${normalized} week${normalized === 1 ? '' : 's'}.` };
  }

  setStudioName(name: string): { success: boolean; message: string } {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      return { success: false, message: 'Studio name must be at least 2 characters.' };
    }
    const sanitized = trimmed.slice(0, 32);
    this.studioName = sanitized;
    return { success: true, message: `Studio renamed to ${sanitized}.` };
  }

  setStudioSpecialization(next: StudioSpecialization): { success: boolean; message: string } {
    if (this.pendingSpecialization === next) {
      return { success: false, message: `${next} specialization is already selected for this turn.` };
    }
    this.pendingSpecialization = next;
    if (this.pendingSpecialization === this.studioSpecialization) {
      return {
        success: true,
        message: `Specialization change reverted. ${this.studioSpecialization} remains active with no charge this turn.`,
      };
    }
    const switchCost = this.specializationCommittedWeek === null ? 0 : 1_000_000;
    return {
      success: true,
      message:
        switchCost > 0
          ? `${next} specialization staged. ${Math.round(switchCost / 1_000_000)}M will be charged on End Turn if committed.`
          : `${next} specialization staged. First specialization commitment is free on End Turn.`,
    };
  }

  investDepartment(track: DepartmentTrack): { success: boolean; message: string } {
    const level = this.departmentLevels[track];
    if (level >= 4) return { success: false, message: `${track} department is already maxed.` };
    const cost = 420_000 * (level + 1);
    if (this.cash < cost) {
      return { success: false, message: `Insufficient cash to invest in ${track} department (${Math.round(cost / 1000)}K).` };
    }
    this.adjustCash(-cost);
    this.departmentLevels[track] = level + 1;
    this.evaluateBankruptcy();
    return {
      success: true,
      message: `${track} department upgraded to level ${this.departmentLevels[track]}.`,
    };
  }

  getActiveExclusivePartner(): string | null {
    if (!this.exclusiveDistributionPartner || !this.exclusivePartnerUntilWeek) return null;
    if (this.currentWeek > this.exclusivePartnerUntilWeek) {
      this.exclusiveDistributionPartner = null;
      this.exclusivePartnerUntilWeek = null;
      return null;
    }
    return this.exclusiveDistributionPartner;
  }

  signExclusiveDistributionPartner(partner: string): { success: boolean; message: string } {
    const allowedPartners = ['Aster Peak Pictures', 'Silverline Distribution', 'Constellation Media'];
    if (!allowedPartners.includes(partner)) return { success: false, message: 'Unknown distribution partner.' };
    const current = this.getActiveExclusivePartner();
    if (current === partner) return { success: false, message: `${partner} partnership is already active.` };
    const cost = 480_000;
    if (this.cash < cost) return { success: false, message: 'Insufficient cash for exclusive partnership.' };
    this.adjustCash(-cost);
    if (current && current !== partner) {
      this.adjustReputation(-1, 'distributor');
    }
    this.exclusiveDistributionPartner = partner;
    this.exclusivePartnerUntilWeek = this.currentWeek + 26;
    this.evaluateBankruptcy();
    return {
      success: true,
      message: `Signed exclusive distribution alignment with ${partner} through week ${this.exclusivePartnerUntilWeek}.`,
    };
  }

  poachExecutiveTeam(): { success: boolean; message: string } {
    if (this.executiveNetworkLevel >= 3) return { success: false, message: 'Executive network is already maxed.' };
    const next = this.executiveNetworkLevel + 1;
    const cost = 900_000 * next;
    if (this.cash < cost) return { success: false, message: `Insufficient cash for executive poach (${Math.round(cost / 1000)}K).` };
    this.adjustCash(-cost);
    this.executiveNetworkLevel = next;
    this.adjustReputation(1, 'talent');
    this.evaluateBankruptcy();
    return { success: true, message: `Executive network upgraded to level ${next}.` };
  }

  advanceUntilDecision(maxWeeks = 26): {
    success: boolean;
    advancedWeeks: number;
    reason: 'decision' | 'crisis' | 'release' | 'limit' | 'blocked' | 'bankrupt';
    message: string;
  } {
    if (!this.canEndWeek) {
      return {
        success: false,
        advancedWeeks: 0,
        reason: 'blocked',
        message: 'Resolve active crises before auto-advancing.',
      };
    }
    if (this.isBankrupt) {
      return {
        success: false,
        advancedWeeks: 0,
        reason: 'bankrupt',
        message: this.bankruptcyReason ?? 'Studio is bankrupt.',
      };
    }

    const decisionStartIds = new Set(this.decisionQueue.map((item) => item.id));
    const inboxStartIds = new Set(this.inboxNotifications.map((item) => item.id));
    const releaseStart = this.pendingReleaseReveals.length + this.pendingFinalReleaseReveals.length;
    const weekStart = this.currentWeek;
    const hardLimit = Math.max(1, Math.min(52, Math.round(maxWeeks)));

    for (let i = 0; i < hardLimit; i += 1) {
      if (!this.canEndWeek || this.isBankrupt) break;
      this.endWeek();
      const decisionAdded = this.decisionQueue.some((item) => !decisionStartIds.has(item.id));
      const inboxUpdateAdded = this.inboxNotifications.some((item) => !inboxStartIds.has(item.id));
      const releaseAdded = this.pendingReleaseReveals.length + this.pendingFinalReleaseReveals.length > releaseStart;
      if (decisionAdded || inboxUpdateAdded) {
        return {
          success: true,
          advancedWeeks: this.currentWeek - weekStart,
          reason: 'decision',
          message: `Auto-advanced ${this.currentWeek - weekStart} week(s) until a new inbox item arrived.`,
        };
      }
      if (!this.canEndWeek) {
        return {
          success: true,
          advancedWeeks: this.currentWeek - weekStart,
          reason: 'crisis',
          message: `Auto-advanced ${this.currentWeek - weekStart} week(s) and paused for a crisis.`,
        };
      }
      if (releaseAdded) {
        return {
          success: true,
          advancedWeeks: this.currentWeek - weekStart,
          reason: 'release',
          message: `Auto-advanced ${this.currentWeek - weekStart} week(s) until a release update.`,
        };
      }
      if (this.isBankrupt) {
        return {
          success: true,
          advancedWeeks: this.currentWeek - weekStart,
          reason: 'bankrupt',
          message: this.bankruptcyReason ?? 'Studio is bankrupt.',
        };
      }
    }

    return {
      success: true,
      advancedWeeks: this.currentWeek - weekStart,
      reason: 'limit',
      message: `Auto-advanced ${this.currentWeek - weekStart} week(s) with no new blocker.`,
    };
  }

  runGreenlightReview(projectId: string, approve: boolean): { success: boolean; message: string } {
    return runGreenlightReviewForManager(this, projectId, approve);
  }

  runTestScreening(projectId: string): { success: boolean; message: string } {
    return runTestScreeningForManager(this, projectId);
  }

  runReshoots(projectId: string): { success: boolean; message: string } {
    return runReshootsForManager(this, projectId);
  }

  runTrackingLeverage(projectId: string): { success: boolean; message: string } {
    return runTrackingLeverageForManager(this, projectId);
  }

  upgradeMarketingTeam(): { success: boolean; message: string } {
    const tierCap = this.getMarketingTeamTierCap();
    if (this.marketingTeamLevel >= ACTION_BALANCE.MARKETING_TEAM_MAX_LEVEL) {
      return { success: false, message: 'Marketing team is already maxed.' };
    }
    if (this.marketingTeamLevel >= tierCap) {
      return {
        success: false,
        message: `Marketing upgrades are capped at level ${tierCap} for your current studio tier.`,
      };
    }
    const nextLevel = this.marketingTeamLevel + 1;
    const cost = this.getMarketingTeamUpgradeCost() ?? 0;
    if (this.cash < cost) return { success: false, message: `Insufficient cash to upgrade marketing team (${Math.round(cost / 1000)}K).` };
    this.adjustCash(-cost);
    this.marketingTeamLevel = nextLevel;
    this.evaluateBankruptcy();
    return { success: true, message: `Marketing team upgraded to level ${nextLevel}.` };
  }

  upgradeStudioCapacity(): { success: boolean; message: string } {
    const tierCap = this.getStudioCapacityUpgradeTierCap();
    if (this.studioCapacityUpgrades >= tierCap) {
      return {
        success: false,
        message: `Facility expansions are capped at +${tierCap} slots for your current studio tier.`,
      };
    }
    const next = this.studioCapacityUpgrades + 1;
    const cost = this.getStudioCapacityUpgradeCost() ?? 0;
    if (this.cash < cost) {
      return { success: false, message: `Insufficient cash for facility expansion (${Math.round(cost / 1000)}K needed).` };
    }
    this.adjustCash(-cost);
    this.studioCapacityUpgrades = next;
    this.evaluateBankruptcy();
    return { success: true, message: `Studio capacity expanded. Active slot cap is now ${this.projectCapacityLimit}.` };
  }

  refreshIpMarketplace(forceMajor = false): void {
    const pool: IpKind[] = forceMajor ? ['superhero'] : ['book', 'game', 'comic', 'book', 'game', 'comic', 'superhero'];
    const kind = pool[Math.floor(this.eventRng() * pool.length)] ?? 'book';
    const profile = buildIpTemplate(kind);
    const [low, high] = profile.costRange;
    const acquisitionCost = Math.round(low + this.eventRng() * (high - low));
    const name = profile.namePool[Math.floor(this.eventRng() * profile.namePool.length)] ?? `Untitled ${kind} property`;
    const expiresWeek = this.currentWeek + (profile.major ? 8 : 10);
    const id = createId('ip');
    this.ownedIps = this.ownedIps.filter((ip) => ip.expiresWeek >= this.currentWeek || ip.usedProjectId !== null);
    if (this.ownedIps.some((ip) => ip.name === name && ip.usedProjectId === null)) return;
    this.ownedIps.unshift({
      id,
      name,
      kind,
      genre: profile.genre,
      acquisitionCost,
      qualityBonus: profile.qualityBonus,
      hypeBonus: profile.hypeBonus,
      prestigeBonus: profile.prestigeBonus,
      commercialBonus: profile.commercialBonus,
      expiresWeek,
      usedProjectId: null,
      major: profile.major,
    });
    this.ownedIps = this.ownedIps.slice(0, 12);
  }

  acquireIpRights(ipId: string): { success: boolean; message: string } {
    const ip = this.ownedIps.find((entry) => entry.id === ipId);
    if (!ip) return { success: false, message: 'IP opportunity not found.' };
    if (ip.usedProjectId) return { success: false, message: 'IP already adapted.' };
    if (ip.expiresWeek < this.currentWeek) return { success: false, message: 'IP option has expired.' };
    if (this.storyFlags[`owned_ip_${ip.id}`]) return { success: false, message: 'Rights are already under your control.' };
    if (ip.major && this.reputation.distributor < 55) {
      return { success: false, message: 'Major IP requires stronger distributor reputation (55+).' };
    }
    if (this.cash < ip.acquisitionCost) return { success: false, message: 'Insufficient cash to acquire IP rights.' };
    this.adjustCash(-ip.acquisitionCost);
    this.storyFlags[`owned_ip_${ip.id}`] = 1;
    const majorContract = this.initializeMajorIpCommitment(ip);
    this.evaluateBankruptcy();
    if (majorContract) {
      return {
        success: true,
        message: `${ip.name} rights secured. Contract requires ${majorContract.required} releases by week ${majorContract.deadlineWeek}.`,
      };
    }
    return { success: true, message: `${ip.name} rights secured.` };
  }

  /** Generates a film title from an acquired IP — smarter than the old ": Adaptation" suffix. */
  private generateIpTitle(ip: OwnedIp): string {
    // For books and games the IP name is already a strong film title
    if (ip.kind === 'book' || ip.kind === 'game') return ip.name;

    // Comics and superhero IPs get a subtitle — deterministic hash on ip.id so it's stable
    const SUPERHERO_SUBTITLES = [
      'The Origin', 'First Strike', 'Dark Horizon', 'Rise of the Guard', 'The Legacy',
      'Dawn of Heroes', 'The Reckoning', 'Revelation', 'Beyond the Veil', 'The First Chapter',
    ];
    const COMIC_SUBTITLES = [
      'Origins', 'The Hidden Truth', 'Dark Rising', 'Awakening', 'The First Arc',
      'New Blood', 'The Comeback', 'Into the Breach', 'Unmasked', 'The Long Shot',
    ];
    const pool = ip.kind === 'superhero' ? SUPERHERO_SUBTITLES : COMIC_SUBTITLES;
    let h = 0;
    for (let i = 0; i < ip.id.length; i++) h = (h * 31 + ip.id.charCodeAt(i)) | 0;
    const subtitle = pool[Math.abs(h) % pool.length];
    return `${ip.name}: ${subtitle}`;
  }

  developProjectFromIp(ipId: string): { success: boolean; message: string; projectId?: string } {
    const ip = this.ownedIps.find((entry) => entry.id === ipId);
    if (!ip) return { success: false, message: 'IP not found.' };
    if (ip.expiresWeek < this.currentWeek) return { success: false, message: 'IP rights window has expired.' };
    if (ip.usedProjectId) return { success: false, message: 'This IP is already in development.' };
    if (!this.storyFlags[`owned_ip_${ip.id}`]) return { success: false, message: 'Acquire rights first.' };
    this.initializeMajorIpCommitment(ip);
    const majorLock = this.getBlockingMajorIpCommitment(ip.id);
    if (majorLock) {
      return {
        success: false,
        message: `Contract lock: launch the next ${majorLock.ip.name} installment before opening unrelated adaptations.`,
      };
    }
    if (this.projectCapacityUsed >= this.projectCapacityLimit) {
      return { success: false, message: `Studio capacity reached (${this.projectCapacityUsed}/${this.projectCapacityLimit}). Expand facilities first.` };
    }
    const budget = initialBudgetForGenre(ip.genre) * (ip.major ? 1.3 : 1.05);
    const castRequirements = this.rollCastRequirements();
    const project: MovieProject = {
      id: createId('project'),
      title: this.generateIpTitle(ip),
      genre: ip.genre,
      phase: 'development',
      budget: {
        ceiling: budget,
        aboveTheLine: budget * 0.3,
        belowTheLine: budget * 0.5,
        postProduction: budget * 0.15,
        contingency: budget * 0.1,
        overrunRisk: 0.27,
        actualSpend: Math.round(ip.acquisitionCost * 0.4),
      },
      budgetPlan: this.buildProjectBudgetPlan(ip.genre, budget, castRequirements),
      castRequirements,
      scriptQuality: clamp(6.1 + ip.qualityBonus, 0, 9.2),
      conceptStrength: clamp(6.4 + ip.commercialBonus * 0.12, 0, 9.5),
      editorialScore: 5,
      postPolishPasses: 0,
      directorId: null,
      castIds: [],
      productionStatus: 'onTrack',
      scheduledWeeksRemaining: 6,
      hypeScore: clamp(8 + ip.hypeBonus, 0, 100),
      marketingBudget: 0,
      releaseWindow: null,
      releaseWeek: null,
      distributionPartner: null,
      studioRevenueShare: 0.52,
      projectedROI: 1,
      openingWeekendGross: null,
      weeklyGrossHistory: [],
      releaseWeeksRemaining: 0,
      releaseResolved: false,
      finalBoxOffice: null,
      criticalScore: null,
      audienceScore: null,
      awardsNominations: 0,
      awardsWins: 0,
      festivalStatus: 'none',
      festivalTarget: null,
      festivalSubmissionWeek: null,
      festivalResolutionWeek: null,
      festivalBuzz: 0,
      prestige: clamp(40 + ip.prestigeBonus, 0, 100),
      commercialAppeal: clamp(45 + ip.commercialBonus, 0, 100),
      originality: clamp(38 + ip.qualityBonus * 5, 0, 100),
      controversy: 10,
      franchiseId: null,
      franchiseEpisode: null,
      sequelToProjectId: null,
      franchiseCarryoverHype: 0,
      franchiseStrategy: 'none',
      greenlightApproved: false,
      adaptedFromIpId: ip.id,
    };
    this.activeProjects.push(project);
    ip.usedProjectId = project.id;
    return { success: true, message: `${project.title} entered development from ${ip.name}.`, projectId: project.id };
  }

  getActiveMilestones(): MilestoneRecord[] {
    return this.releaseService.getActiveMilestones();
  }

  getLatestReleaseReport(projectId: string): ReleaseReport | null {
    return this.releaseService.getLatestReleaseReport(projectId);
  }

  getGenreDemandMultiplier(genre: MovieGenre): number {
    return this.eventService.getGenreDemandMultiplier(genre);
  }

  getProjectCastStatus(projectId: string): { actorCount: number; actressCount: number; total: number; requiredTotal: number } | null {
    return this.talentService.getProjectCastStatus(projectId);
  }

  meetsCastRequirements(project: MovieProject): boolean {
    return this.talentService.meetsCastRequirements(project);
  }

  private rollCastRequirements(): CastRequirements {
    const totalRoll = this.eventRng();
    const total = totalRoll < 0.45 ? 1 : totalRoll < 0.9 ? 2 : 3;
    const actorCount = Math.floor(this.eventRng() * (total + 1));
    const actressCount = total - actorCount;
    return { actorCount, actressCount };
  }

  private buildProjectBudgetPlan(
    genre: MovieGenre,
    ceiling: number,
    castRequirements: CastRequirements
  ): ProjectBudgetPlan {
    return this.talentService.buildProjectBudgetPlan(genre, ceiling, castRequirements);
  }

  getGenreCycleSnapshot(): {
    genre: MovieGenre;
    demand: number;
    momentum: number;
    shockLabel: string | null;
    shockDirection: 'surge' | 'slump' | null;
    shockWeeksRemaining: number;
  }[] {
    return this.eventService.getGenreCycleSnapshot();
  }

  getAvailableTalentForRole(role: TalentRole): Talent[] {
    return this.talentService.getAvailableTalentForRole(role);
  }

  getNegotiationChance(talentId: string, projectId?: string): number | null {
    return this.talentService.getNegotiationChance(talentId, projectId);
  }

  getQuickCloseChance(talentId: string): number | null {
    return this.talentService.getQuickCloseChance(talentId);
  }

  getNegotiationSnapshot(
    projectId: string,
    talentId: string
  ): NegotiationSnapshot | null {
    return this.talentService.getNegotiationSnapshot(projectId, talentId);
  }

  previewTalentNegotiationRound(
    projectId: string,
    talentId: string,
    action: NegotiationAction
  ): { success: boolean; message?: string; preview?: NegotiationRoundPreview } {
    return this.talentService.previewTalentNegotiationRound(projectId, talentId, action);
  }

  adjustTalentNegotiation(
    projectId: string,
    talentId: string,
    action: NegotiationAction
  ): { success: boolean; message: string } {
    return this.talentService.adjustTalentNegotiation(projectId, talentId, action);
  }

  evaluateScriptPitch(scriptId: string): {
    score: number;
    recommendation: 'strongBuy' | 'conditional' | 'pass';
    qualityScore: number;
    valueScore: number;
    affordabilityScore: number;
    riskLabel: 'low' | 'medium' | 'high';
  } | null {
    return this.eventService.evaluateScriptPitch(scriptId);
  }

  getIndustryHeatLeaderboard(): { name: string; heat: number; isPlayer: boolean }[] {
    const rows = [
      { name: this.studioName, heat: this.studioHeat, isPlayer: true },
      ...this.rivals.map((rival) => ({ name: rival.name, heat: rival.studioHeat, isPlayer: false })),
    ];
    return rows.sort((a, b) => b.heat - a.heat);
  }

  runOptionalAction(): { success: boolean; message: string } {
    return runOptionalActionForManager(this);
  }

  runMarketingPushOnProject(projectId: string): { success: boolean; message: string } {
    return runMarketingPushOnProjectForManager(this, projectId);
  }

  runScriptDevelopmentSprint(projectId: string): { success: boolean; message: string } {
    return runScriptDevelopmentSprintForManager(this, projectId);
  }

  runPostProductionPolishPass(projectId: string): { success: boolean; message: string } {
    return runPostProductionPolishPassForManager(this, projectId);
  }

  runFestivalSubmission(projectId: string): { success: boolean; message: string } {
    return runFestivalSubmissionForManager(this, projectId);
  }

  abandonProject(projectId: string): { success: boolean; message: string } {
    return abandonProjectForManager(this, projectId);
  }

  startTalentNegotiation(projectId: string, talentId: string): { success: boolean; message: string } {
    return this.talentService.startTalentNegotiation(projectId, talentId);
  }

  startTalentNegotiationRound(
    projectId: string,
    talentId: string,
    action: NegotiationAction
  ): { success: boolean; message: string } {
    return this.talentService.startTalentNegotiationRound(projectId, talentId, action);
  }

  dismissTalentNegotiation(projectId: string, talentId: string): void {
    this.talentService.dismissTalentNegotiation(projectId, talentId);
  }

  setProjectReleaseWeek(projectId: string, releaseWeek: number): { success: boolean; message: string } {
    return this.lifecycleService.setProjectReleaseWeek(projectId, releaseWeek);
  }

  getOffersForProject(projectId: string): DistributionOffer[] {
    return this.distributionOffers.filter((offer) => offer.projectId === projectId);
  }

  getNextReleaseReveal(): MovieProject | null {
    const nextId = this.pendingFinalReleaseReveals[0] ?? this.pendingReleaseReveals[0];
    if (!nextId) return null;
    return this.activeProjects.find((project) => project.id === nextId) ?? null;
  }

  isFinalReleaseReveal(projectId: string): boolean {
    return this.pendingFinalReleaseReveals.includes(projectId);
  }

  dismissReleaseReveal(projectId: string): void {
    this.pendingReleaseReveals = this.pendingReleaseReveals.filter((idValue) => idValue !== projectId);
    this.pendingFinalReleaseReveals = this.pendingFinalReleaseReveals.filter((idValue) => idValue !== projectId);
  }

  queueInboxNotification(
    input: Omit<InboxNotification, 'id' | 'week'> & { id?: string; week?: number }
  ): void {
    this.inboxNotifications.unshift({
      id: input.id ?? createId('inbox'),
      week: input.week ?? this.currentWeek,
      kind: input.kind,
      title: input.title,
      body: input.body,
      projectId: input.projectId,
    });
    if (this.inboxNotifications.length > 40) {
      this.inboxNotifications = this.inboxNotifications.slice(0, 40);
    }
  }

  dismissInboxNotification(notificationId: string): void {
    this.inboxNotifications = this.inboxNotifications.filter((item) => item.id !== notificationId);
  }

  getSequelEligibility(projectId: string): SequelEligibility | null {
    return this.franchiseService.getSequelEligibility(projectId);
  }

  getSequelCandidates(): SequelCandidate[] {
    return this.franchiseService.getSequelCandidates();
  }

  startSequel(projectId: string): { success: boolean; message: string; projectId?: string } {
    const baseProject = this.activeProjects.find((item) => item.id === projectId);
    const majorLock = this.getBlockingMajorIpCommitment(baseProject?.adaptedFromIpId ?? undefined);
    if (majorLock) {
      return {
        success: false,
        message: `Contract lock: open the next ${majorLock.ip.name} installment before starting other sequel lines.`,
      };
    }
    if (this.projectCapacityUsed >= this.projectCapacityLimit) {
      return {
        success: false,
        message: `Studio capacity reached (${this.projectCapacityUsed}/${this.projectCapacityLimit}). Expand capacity before starting a sequel.`,
      };
    }
    return this.franchiseService.startSequel(projectId);
  }

  setFranchiseStrategy(
    projectId: string,
    strategy: Exclude<FranchiseStrategy, 'none'>
  ): { success: boolean; message: string } {
    return this.franchiseService.setFranchiseStrategy(projectId, strategy);
  }

  getFranchiseProjectionModifiers(projectId: string): FranchiseProjectionModifiers | null {
    const project = this.activeProjects.find((item) => item.id === projectId);
    if (!project) return null;
    return this.franchiseService.getFranchiseProjectionModifiers(project, project.releaseWeek ?? this.currentWeek + 4);
  }

  getFranchiseStatus(projectId: string): FranchiseStatusSnapshot | null {
    return this.franchiseService.getFranchiseStatus(projectId);
  }

  runFranchiseBrandReset(projectId: string): { success: boolean; message: string } {
    return this.franchiseService.runFranchiseBrandReset(projectId);
  }

  runFranchiseLegacyCastingCampaign(projectId: string): { success: boolean; message: string } {
    return this.franchiseService.runFranchiseLegacyCastingCampaign(projectId);
  }

  runFranchiseHiatusPlanning(projectId: string): { success: boolean; message: string } {
    return this.franchiseService.runFranchiseHiatusPlanning(projectId);
  }

  markFranchiseRelease(projectId: string): void {
    this.franchiseService.markFranchiseRelease(projectId);
  }

  getFranchiseProjectionModifiersForRelease(project: MovieProject, releaseWeek: number): FranchiseProjectionModifiers {
    return this.franchiseService.getFranchiseProjectionModifiers(project, releaseWeek);
  }

  acquireScript(scriptId: string): { success: boolean; message: string; projectId?: string } {
    const majorLock = this.getBlockingMajorIpCommitment();
    if (majorLock) {
      return {
        success: false,
        message: `Contract lock: launch the next ${majorLock.ip.name} installment before acquiring unrelated scripts.`,
      };
    }
    const pitch = this.scriptMarket.find((item) => item.id === scriptId);
    if (!pitch) return { success: false, message: 'Script not found.' };
    if (this.projectCapacityUsed >= this.projectCapacityLimit) {
      return {
        success: false,
        message: `Studio capacity reached (${this.projectCapacityUsed}/${this.projectCapacityLimit}). Upgrade capacity before adding projects.`,
      };
    }
    if (this.cash < pitch.askingPrice) return { success: false, message: 'Insufficient funds for script acquisition.' };

    this.adjustCash(-pitch.askingPrice);
    this.scriptMarket = this.scriptMarket.filter((item) => item.id !== scriptId);

    const ceiling = initialBudgetForGenre(pitch.genre);
    const castRequirements = this.rollCastRequirements();
    const project: MovieProject = {
      id: createId('project'),
      title: pitch.title,
      genre: pitch.genre,
      phase: 'development',
      budget: {
        ceiling,
        aboveTheLine: ceiling * 0.3,
        belowTheLine: ceiling * 0.5,
        postProduction: ceiling * 0.15,
        contingency: ceiling * 0.1,
        overrunRisk: 0.28,
        actualSpend: pitch.askingPrice,
      },
      budgetPlan: this.buildProjectBudgetPlan(pitch.genre, ceiling, castRequirements),
      castRequirements,
      scriptQuality: pitch.scriptQuality,
      conceptStrength: pitch.conceptStrength,
      editorialScore: 5,
      postPolishPasses: 0,
      directorId: null,
      castIds: [],
      productionStatus: 'onTrack',
      scheduledWeeksRemaining: 6,
      hypeScore: 8,
      marketingBudget: 0,
      releaseWindow: null,
      releaseWeek: null,
      distributionPartner: null,
      studioRevenueShare: 0.52,
      projectedROI: 1,
      openingWeekendGross: null,
      weeklyGrossHistory: [],
      releaseWeeksRemaining: 0,
      releaseResolved: false,
      finalBoxOffice: null,
      criticalScore: null,
      audienceScore: null,
      awardsNominations: 0,
      awardsWins: 0,
      festivalStatus: 'none',
      festivalTarget: null,
      festivalSubmissionWeek: null,
      festivalResolutionWeek: null,
      festivalBuzz: 0,
      prestige: clamp(
        Math.round(pitch.scriptQuality * 7 + (pitch.genre === 'drama' || pitch.genre === 'documentary' ? 18 : 0)),
        0, 100
      ),
      commercialAppeal: clamp(
        Math.round(
          (pitch.genre === 'action' ? 68 : pitch.genre === 'sciFi' ? 62 : pitch.genre === 'animation' ? 60
            : pitch.genre === 'drama' ? 32 : pitch.genre === 'documentary' ? 18 : 48) +
          pitch.conceptStrength * 3
        ), 0, 100
      ),
      originality: clamp(Math.round(pitch.conceptStrength * 8 + 10), 0, 100),
      controversy: pitch.genre === 'horror' ? 35 : pitch.genre === 'thriller' ? 28 : pitch.genre === 'action' ? 22 : 15,
      franchiseId: null,
      franchiseEpisode: null,
      sequelToProjectId: null,
      franchiseCarryoverHype: 0,
      franchiseStrategy: 'none',
      greenlightApproved: false,
      greenlightWeek: null,
      greenlightFeePaid: 0,
      greenlightLockedCeiling: null,
      sentBackForRewriteCount: 0,
      testScreeningCompleted: false,
      testScreeningWeek: null,
      testScreeningCriticalLow: null,
      testScreeningCriticalHigh: null,
      testScreeningAudienceSentiment: null,
      reshootCount: 0,
      trackingProjectionOpening: null,
      trackingConfidence: null,
      trackingLeverageAmount: 0,
      trackingSettled: false,
      merchandiseWeeksRemaining: 0,
      merchandiseWeeklyRevenue: 0,
      adaptedFromIpId: null,
    };
    this.activeProjects.push(project);
    this.newlyAcquiredProjectId = project.id;
    this.inboxNotifications.unshift({
      id: createId('note'),
      week: this.currentWeek,
      kind: 'scriptAcquired',
      title: `Script acquired: ${pitch.title}`,
      body: 'The script has been removed from market offers and added to your active slate.',
      projectId: project.id,
    });
    if (this.currentWeek % 7 === 0) this.refreshIpMarketplace();
    return { success: true, message: `Script acquired: "${pitch.title}" added to your slate.`, projectId: project.id };
  }

  passScript(scriptId: string): void {
    this.scriptMarket = this.scriptMarket.filter((item) => item.id !== scriptId);
  }

  negotiateAndAttachTalent(projectId: string, talentId: string): { success: boolean; message: string } {
    return this.talentService.negotiateAndAttachTalent(projectId, talentId);
  }

  advanceProjectPhase(projectId: string): { success: boolean; message: string } {
    return this.lifecycleService.advanceProjectPhase(projectId);
  }

  acceptDistributionOffer(projectId: string, offerId: string): { success: boolean; message: string } {
    return this.lifecycleService.acceptDistributionOffer(projectId, offerId);
  }

  counterDistributionOffer(projectId: string, offerId: string): { success: boolean; message: string } {
    return this.lifecycleService.counterDistributionOffer(projectId, offerId);
  }

  walkAwayDistribution(projectId: string): { success: boolean; message: string } {
    return this.lifecycleService.walkAwayDistribution(projectId);
  }

  resolveCrisis(crisisId: string, optionId: string): { success: boolean; message: string } {
    const crisis = this.pendingCrises.find((item) => item.id === crisisId);
    if (!crisis) {
      return { success: false, message: 'Crisis no longer active. Refresh inbox.' };
    }
    const option = crisis.options.find((item) => item.id === optionId);
    if (!option) {
      return { success: false, message: 'Selected crisis option is no longer valid.' };
    }

    const project = this.activeProjects.find((item) => item.id === crisis.projectId);
    if (project) {
      if (crisis.kind === 'talentPoached') {
        this.talentService.resolveTalentPoachCrisis(project, option);
        this.pendingCrises = this.pendingCrises.filter((item) => item.id !== crisisId);
        const remaining = this.pendingCrises.length;
        return {
          success: true,
          message: remaining === 0 ? 'Crisis resolved. End Turn unlocked.' : `Crisis resolved. ${remaining} blocking crisis${remaining === 1 ? '' : 'es'} remaining.`,
        };
      }
      if (crisis.kind === 'releaseConflict') {
        if (typeof option.releaseWeekShift === 'number' && project.releaseWeek) {
          project.releaseWeek = clamp(project.releaseWeek + option.releaseWeekShift, this.currentWeek + 1, this.currentWeek + 52);
        }
        project.hypeScore = clamp(project.hypeScore + option.hypeDelta, 0, 100);
        this.adjustCash(option.cashDelta);
        this.pendingCrises = this.pendingCrises.filter((item) => item.id !== crisisId);
        const remaining = this.pendingCrises.length;
        return {
          success: true,
          message: remaining === 0 ? 'Crisis resolved. End Turn unlocked.' : `Crisis resolved. ${remaining} blocking crisis${remaining === 1 ? '' : 'es'} remaining.`,
        };
      }
      project.scheduledWeeksRemaining = Math.max(0, project.scheduledWeeksRemaining + option.scheduleDelta);
      project.hypeScore = clamp(project.hypeScore + option.hypeDelta, 0, 100);
      project.budget.actualSpend += Math.max(0, -option.cashDelta);
      project.productionStatus = 'onTrack';
    }
    this.adjustCash(option.cashDelta);
    this.evaluateBankruptcy();
    this.pendingCrises = this.pendingCrises.filter((item) => item.id !== crisisId);
    const remaining = this.pendingCrises.length;
    return {
      success: true,
      message: remaining === 0 ? 'Crisis resolved. End Turn unlocked.' : `Crisis resolved. ${remaining} blocking crisis${remaining === 1 ? '' : 'es'} remaining.`,
    };
  }

  resolveDecision(decisionId: string, optionId: string): void {
    const decision = this.decisionQueue.find((item) => item.id === decisionId);
    if (!decision) return;
    const option = decision.options.find((item) => item.id === optionId);
    if (!option) return;

    const project = decision.projectId ? this.getDecisionTargetProject(decision) : null;
    if (project) {
      project.scriptQuality = clamp(project.scriptQuality + option.scriptQualityDelta, 0, 10);
      project.hypeScore = clamp(project.hypeScore + option.hypeDelta, 0, 100);
      if (typeof option.releaseWeekShift === 'number' && project.releaseWeek) {
        project.releaseWeek = clamp(project.releaseWeek + option.releaseWeekShift, this.currentWeek + 1, this.currentWeek + 52);
      }
      if (typeof option.scheduleDelta === 'number') {
        project.scheduledWeeksRemaining = Math.max(0, project.scheduledWeeksRemaining + option.scheduleDelta);
      }
      if (typeof option.marketingDelta === 'number') {
        project.marketingBudget = Math.max(0, project.marketingBudget + option.marketingDelta);
      }
      if (typeof option.overrunRiskDelta === 'number') {
        project.budget.overrunRisk = clamp(project.budget.overrunRisk + option.overrunRiskDelta, 0.05, 0.75);
      }
    }

    this.adjustCash(option.cashDelta);
    if (option.studioHeatDelta) this.adjustReputation(option.studioHeatDelta, 'all');
    if (option.criticsDelta) this.adjustReputation(option.criticsDelta, 'critics');
    if (option.talentRepDelta) this.adjustReputation(option.talentRepDelta, 'talent');
    if (option.distributorRepDelta) this.adjustReputation(option.distributorRepDelta, 'distributor');
    if (option.audienceDelta) this.adjustReputation(option.audienceDelta, 'audience');
    this.evaluateBankruptcy();
    this.applyStoryFlagMutations(option.setFlag, option.clearFlag);
    if (decision.arcId) {
      this.applyArcMutation(decision.arcId, option);
      if (option.resolveArc || option.failArc) {
        this.addChronicleEntry({
          week: this.currentWeek,
          type: 'arcResolution',
          headline: `${ARC_LABELS[decision.arcId] ?? decision.arcId} — ${option.resolveArc ? 'resolved' : 'failed'}`,
          detail: `"${option.label}"`,
          impact: option.resolveArc ? 'positive' : 'negative',
        });
      }
    }
    this.applyRivalDecisionMemory(decision, option);
    this.decisionQueue = this.decisionQueue.filter((item) => item.id !== decisionId);
  }

  dismissDecision(decisionId: string): void {
    this.decisionQueue = this.decisionQueue.filter((item) => item.id !== decisionId);
  }

  endWeek(): WeekSummary {
    if (!this.canEndWeek) {
      throw new Error('Resolve all crises before ending the week.');
    }
    this.newlyAcquiredProjectId = null;

    const cashBefore = this.cash;
    const tierBefore = this.studioTier;
    const events: string[] = [];

    const burn = this.releaseService.applyWeeklyBurn();
    if (burn > 0) {
      events.push(`Production burn applied: -$${Math.round(burn / 1000)}K`);
    }

    this.releaseService.applyHypeDecay();
    this.eventService.tickGenreCycles(events);
    this.releaseService.resolveFestivalCircuit(events);
    this.talentService.updateTalentAvailability();
    this.talentService.refreshTalentMarket();
    this.eventService.tickDecisionExpiry(events);
    this.eventService.tickScriptMarketExpiry(events);
    this.eventService.refillScriptMarket(events);
    if ((this.currentWeek + 1) % 6 === 0) {
      this.refreshIpMarketplace(this.currentWeek % 26 === 0);
      const latestIp = this.ownedIps[0];
      if (latestIp) {
        events.push(`IP market: ${latestIp.name} rights are now in play.`);
      }
    }
    this.lifecycleService.tickDistributionWindows(events);
    this.eventService.rollForCrises(events);
    this.rivalAiService.processRivalTalentAcquisitions(events);
    this.talentService.processPlayerNegotiations(events);
    this.eventService.generateEventDecisions(events);
    this.releaseService.tickReleasedFilms(events);
    this.rivalAiService.tickRivalHeat(events);
    this.rivalAiService.processRivalCalendarMoves(events);
    this.rivalAiService.processRivalSignatureMoves(events);
    this.rivalAiService.processRivalSignatureCrises(events);
    this.applyRivalMemoryReversion();
    this.releaseService.projectOutcomes();

    this.currentWeek += 1;
    if (this.currentWeek % 52 === 0) {
      this.talentService.processTalentAging(events);
    }
    this.releaseService.processAnnualAwards(events);
    this.evaluateMajorIpContractBreaches(events);

    if (this.cash < BANKRUPTCY_RULES.LOW_CASH_WARNING_THRESHOLD) {
      this.consecutiveLowCashWeeks += 1;
    } else {
      this.consecutiveLowCashWeeks = 0;
    }

    if (!this.firstSessionComplete && this.currentWeek > SESSION_RULES.FIRST_SESSION_COMPLETE_WEEK) {
      this.firstSessionComplete = true;
    }
    if (this.studioTier !== tierBefore) {
      const movedUp = TIER_RANK[this.studioTier] > TIER_RANK[tierBefore];
      this.addChronicleEntry({
        week: this.currentWeek,
        type: 'tierAdvance',
        headline: `${movedUp ? 'Promoted to' : 'Dropped to'} ${STUDIO_TIER_LABELS[this.studioTier]}`,
        impact: movedUp ? 'positive' : 'negative',
      });
    }
    this.evaluateBankruptcy(events);

    const summary: WeekSummary = {
      week: this.currentWeek,
      cashDelta: this.cash - cashBefore,
      events: events.length > 0 ? events : ['Stable week. No major surprises.'],
      hasPendingCrises: this.pendingCrises.length > 0,
      decisionQueueCount: this.decisionQueue.length,
    };
    this.lastWeekSummary = summary;
    return summary;
  }

  endTurn(): WeekSummary {
    if (!this.canEndWeek) {
      throw new Error('Resolve all crises before ending the week.');
    }

    const targetWeeks = this.turnLengthWeeks;
    const cashBefore = this.cash;
    const combinedEvents: string[] = [];

    if (this.pendingSpecialization !== this.studioSpecialization) {
      const switchCost = this.specializationCommittedWeek === null ? 0 : 1_000_000;
      if (this.cash < switchCost) {
        combinedEvents.push(
          `Specialization switch to ${this.pendingSpecialization} failed: requires ${Math.round(switchCost / 1_000_000)}M cash. ${this.studioSpecialization} remains active.`
        );
        this.pendingSpecialization = this.studioSpecialization;
      } else {
        if (switchCost > 0) {
          this.adjustCash(-switchCost);
          this.adjustReputation(-1, 'talent');
          this.adjustReputation(-1, 'distributor');
        }
        this.studioSpecialization = this.pendingSpecialization;
        this.specializationCommittedWeek = this.currentWeek;
        this.evaluateBankruptcy();
        combinedEvents.push(
          switchCost > 0
            ? `Specialization committed: ${this.studioSpecialization} (-$${Math.round(switchCost / 1000)}K).`
            : `Specialization committed: ${this.studioSpecialization} (first commitment is free).`
        );
      }
    }

    for (let step = 0; step < targetWeeks; step += 1) {
      if (!this.canEndWeek) {
        combinedEvents.push('Turn paused: resolve crisis before advancing further.');
        break;
      }
      const weekly = this.endWeek();
      combinedEvents.push(...weekly.events);
    }

    const summary: WeekSummary = {
      week: this.currentWeek,
      cashDelta: this.cash - cashBefore,
      events: combinedEvents.length > 0 ? combinedEvents : ['Stable week. No major surprises.'],
      hasPendingCrises: this.pendingCrises.length > 0,
      decisionQueueCount: this.decisionQueue.length,
    };
    this.lastWeekSummary = summary;
    return summary;
  }

  getProjectedForProject(projectId: string): {
    critical: number;
    openingLow: number;
    openingHigh: number;
    roi: number;
  } | null {
    return this.releaseService.getProjectedForProject(projectId);
  }

  getProjectedForProjectAtWeek(
    projectId: string,
    releaseWeek: number
  ): {
    critical: number;
    openingLow: number;
    openingHigh: number;
    roi: number;
  } | null {
    return this.releaseService.getProjectedForProjectAtWeek(projectId, releaseWeek);
  }

  estimateWeeklyBurn(): number {
    return this.releaseService.estimateWeeklyBurn();
  }

  private addChronicleEntry(entry: Omit<ChronicleEntry, 'id'>): void {
    this.studioChronicle.unshift({ id: createId('chron'), ...entry });
    this.studioChronicle = this.studioChronicle.slice(0, 100);
  }

  // Delegation stubs accessed by tests and ForManager functions via cast
  applyWeeklyBurn(): number { return this.releaseService.applyWeeklyBurn(); }
  refillScriptMarket(events: string[]): void { this.eventService.refillScriptMarket(events); }
  tickDecisionExpiry(events: string[]): void { this.eventService.tickDecisionExpiry(events); }
  processRivalTalentAcquisitions(events: string[]): void { this.rivalAiService.processRivalTalentAcquisitions(events); }
  processRivalCalendarMoves(events: string[]): void { this.rivalAiService.processRivalCalendarMoves(events); }
  processRivalSignatureMoves(events: string[]): void {
    this.rivalAiService.processRivalSignatureMoves(events);
    this.rivalAiService.processRivalSignatureCrises(events);
  }

  injectCrisis(crisis: CrisisEvent): void {
    this.eventService.injectCrisis(crisis);
  }


  getArcPressureFromRivals(arcId: string): number {
    return this.eventService.getArcPressureFromRivals(arcId);
  }

  hasStoryFlag(flag: string): boolean {
    return this.eventService.hasStoryFlag(flag);
  }

  matchesArcRequirement(input: {
    id: string;
    minStage?: number;
    maxStage?: number;
    status?: 'active' | 'resolved' | 'failed';
  }): boolean {
    return this.eventService.matchesArcRequirement(input);
  }

  ensureArcState(arcId: string): StoryArcState {
    return this.eventService.ensureArcState(arcId);
  }

  applyArcMutation(arcId: string, option: DecisionItem['options'][number]): void {
    this.eventService.applyArcMutation(arcId, option);
  }

  applyStoryFlagMutations(setFlag?: string, clearFlag?: string): void {
    this.eventService.applyStoryFlagMutations(setFlag, clearFlag);
  }

  getDecisionTargetProject(decision: DecisionItem): MovieProject | null {
    return this.eventService.getDecisionTargetProject(decision);
  }

  buildOperationalCrisis(project: MovieProject): CrisisEvent {
    return this.eventService.buildOperationalCrisis(project);
  }


  private applyRivalDecisionMemory(decision: DecisionItem, option: DecisionItem['options'][number]): void {
    if (!decision.title.startsWith('Counterplay:')) return;
    const rival = this.rivals.find((item) => decision.title.includes(item.name));
    if (!rival) return;

    const kind: RivalInteractionKind = decision.title.includes('Awards')
      ? 'prestigePressure'
      : decision.title.includes('Platform')
        ? 'streamingPressure'
        : decision.title.includes('Guerrilla')
          ? 'guerrillaPressure'
          : decision.title.includes('Tentpole')
            ? 'releaseCollision'
            : 'counterplayEscalation';

    if (option.cashDelta < 0 || option.hypeDelta > 0) {
      this.recordRivalInteraction(rival, {
        kind,
        hostilityDelta: 3,
        respectDelta: 1,
        note: `Escalated counterplay response: ${option.label}.`,
        projectId: decision.projectId,
      });
      return;
    }

    if (option.label.toLowerCase().includes('accept')) {
      this.recordRivalInteraction(rival, {
        kind,
        hostilityDelta: -2,
        respectDelta: -1,
        note: `Accepted rival pressure option: ${option.label}.`,
        projectId: decision.projectId,
      });
      return;
    }

    this.recordRivalInteraction(rival, {
      kind,
      hostilityDelta: -1,
      respectDelta: 0,
      note: `Lower-intensity response selected: ${option.label}.`,
      projectId: decision.projectId,
    });
  }

  private applyRivalMemoryReversion(): void {
    for (const rival of this.rivals) {
      const memory = this.getRivalMemory(rival);
      memory.hostility = clamp(memory.hostility + (50 - memory.hostility) * 0.035, 0, 100);
      memory.respect = clamp(memory.respect + (50 - memory.respect) * 0.028, 0, 100);
      memory.retaliationBias = clamp(memory.retaliationBias + (50 - memory.retaliationBias) * 0.03, 0, 100);
      memory.cooperationBias = clamp(memory.cooperationBias + (45 - memory.cooperationBias) * 0.03, 0, 100);
    }
  }

  checkRivalReleaseResponses(project: MovieProject, events: string[]): void {
    this.rivalAiService.checkRivalReleaseResponses(project, events);
  }

  calendarPressureMultiplier(week: number, genre: MovieGenre): number {
    return this.releaseService.calendarPressureMultiplier(week, genre);
  }

  refreshTalentMarket(): void {
    this.talentService.refreshTalentMarket();
  }

  // Delegation stubs used by ForManager functions that access these via the manager parameter
  findNegotiation(talentId: string, projectId?: string) { return this.talentService.findNegotiation(talentId, projectId); }
  defaultNegotiationTerms(talent: Talent) { return this.talentService.defaultNegotiationTerms(talent); }
  buildQuickCloseTerms(talent: Talent) { return this.talentService.buildQuickCloseTerms(talent); }
  readNegotiationTerms(negotiation: PlayerNegotiation, talent: Talent) { return this.talentService.readNegotiationTerms(negotiation, talent); }
  normalizeNegotiation(negotiation: PlayerNegotiation, talent: Talent) { return this.talentService.normalizeNegotiation(negotiation, talent); }
  demandedNegotiationTerms(talent: Talent) { return this.talentService.demandedNegotiationTerms(talent); }
  computeDealMemoCost(talent: Talent, terms: Parameters<TalentService['computeDealMemoCost']>[1]) { return this.talentService.computeDealMemoCost(talent, terms); }
  computeQuickCloseAttemptFee(talent: Talent, terms: Parameters<TalentService['computeQuickCloseAttemptFee']>[1]) { return this.talentService.computeQuickCloseAttemptFee(talent, terms); }
  setNegotiationCooldown(talent: Talent, weeks: number) { this.talentService.setNegotiationCooldown(talent, weeks); }
  talentDealChance(talent: Talent, base: number) { return this.talentService.talentDealChance(talent, base); }
  evaluateNegotiation(negotiation: PlayerNegotiation, talent: Talent, baseChance = 0.7) { return this.talentService.evaluateNegotiation(negotiation, talent, baseChance); }
  negotiationPressurePoint(evaluation: Parameters<TalentService['negotiationPressurePoint']>[0]) { return this.talentService.negotiationPressurePoint(evaluation); }
  composeNegotiationPreview(talentName: string, evaluation: Parameters<TalentService['composeNegotiationPreview']>[1], holdLineCount: number) { return this.talentService.composeNegotiationPreview(talentName, evaluation, holdLineCount); }
  composeNegotiationSignal(talentName: string, evaluation: Parameters<TalentService['composeNegotiationSignal']>[1], accepted: boolean, holdLineCount: number) { return this.talentService.composeNegotiationSignal(talentName, evaluation, accepted, holdLineCount); }
  finalizeTalentAttachment(project: MovieProject, talent: Talent, terms?: Parameters<TalentService['finalizeTalentAttachment']>[2]) { return this.talentService.finalizeTalentAttachment(project, talent, terms); }

  getRivalBehaviorProfile(rival: RivalStudio): {
    arcPressure: Record<string, number>;
    talentPoachChance: number;
    calendarMoveChance: number;
    conflictPush: number;
    signatureMoveChance: number;
    budgetScale: number;
    hypeScale: number;
  } {
    return this.rivalAiService.getRivalBehaviorProfile(rival);
  }

  getArcOutcomeModifiers(): ArcOutcomeModifiers {
    return this.eventService.getArcOutcomeModifiers();
  }

  generateDistributionOffers(projectId: string): void {
    this.lifecycleService.generateDistributionOffers(projectId);
  }

  releaseTalent(projectId: string, context: 'released' | 'abandoned' = 'released'): void {
    this.talentService.releaseTalent(projectId, context);
  }

  private bindOpeningDecisionToLeadProject(): void {
    const openingDecision = this.decisionQueue.find((item) => item.title.startsWith('First Call: Script Doctor'));
    if (!openingDecision || openingDecision.projectId) return;
    const leadProject =
      this.activeProjects.find((project) => project.title === 'Night Ledger') ??
      this.activeProjects.find((project) => project.phase !== 'released');
    if (!leadProject) return;
    openingDecision.projectId = leadProject.id;
  }

  evaluateBankruptcy(events?: string[]): void {
    evaluateBankruptcyForManager(this, events);
  }
}
