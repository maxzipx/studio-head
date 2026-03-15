import {
  ACTION_BALANCE,
  BANKRUPTCY_RULES,
  SESSION_RULES,
  STUDIO_STARTING,
  STUDIO_TIER_REQUIREMENTS,
  TURN_RULES,
} from './balance-constants';
import { createId } from './id';
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
import { createProjectFromScript } from './project-factory';
import { getEventDeck } from './event-deck';
import {
  createOpeningDecisions,
  createSeedProjects,
  createSeedRivals,
  createSeedTalentPool,
} from './seeds';
import { adjustCashForManager, evaluateBankruptcyForManager } from './finance.service';
import { FranchiseService } from './services/franchise.service';
import { IpService } from './services/ip.service';
import { TutorialService } from './services/tutorial.service';
import { OperationsService } from './services/operations.service';
import { ProjectLifecycleService } from './services/project-lifecycle.service';
import { RivalAiService } from './services/rival-ai.service';
import { ReleaseService } from './services/release.service';
import { TalentService } from './services/talent.service';
import { EventService } from './services/event.service';
import {
  ARC_LABELS,
  createInitialGenreCycles,
  initialBudgetForGenre,
  TIER_RANK,
  type ArcOutcomeModifiers,
  type FoundingProfileModifiers,
  type SpecializationProfile,
} from './studio-manager.constants';
import { clamp } from './utils';
import { getLegacyFoundingProfileEffects, getLegacySpecializationProfile } from './modifier-service';
import {
  estimateWeeklyBurnForStudio,
  getActiveMilestonesForStudio,
  getArcOutcomeModifiersForStudio,
  getArcPressureFromRivalsForStudio,
  getGenreCycleSnapshotForStudio,
  getGenreDemandMultiplierForStudio,
  getIndustryHeatLeaderboardForStudio,
  getLatestReleaseReportForStudio,
  getProjectCastStatusForStudio,
  getRivalBehaviorProfileForStudio,
  getScaleOverheadCostForStudio,
} from './studio-selectors';
import { STUDIO_TIER_LABELS } from './types';
import type {
  AwardsSeasonRecord,
  ChronicleEntry,
  CrisisEvent,
  DecisionCategory,
  DecisionItem,
  DistributionOffer,
  DepartmentTrack,
  EventTemplate,
  FoundingProfile,
  FranchiseTrack,
  FranchiseProjectionModifiers,
  FranchiseStrategy,
  FranchiseStatusSnapshot,
  GenreCycleState,
  InboxNotification,
  IndustryNewsItem,
  MilestoneRecord,
  MovieGenre,
  MovieProject,
  NegotiationAction,
  OwnedIp,
  PlayerNegotiation,
  ReleaseReport,
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
  TutorialState,
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
  turnLengthWeeks: 2 = TURN_RULES.WEEKS_PER_TURN;
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
  foundingProfile: FoundingProfile = 'none';
  needsFoundingSetup = true;
  foundingSetupCompletedWeek: number | null = null;
  animationDivisionUnlocked = false;
  lastGeneratedCrisisWeek: number | null = null;
  generatedCrisisThisTurn = false;
  lastScaleOverheadWeek = 1;
  tutorialState: TutorialState = 'hqIntro';
  tutorialCompleted = false;
  tutorialDismissed = false;
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
  private processingTurn = false;
  readonly lifecycleService = new ProjectLifecycleService(this);
  readonly franchiseService = new FranchiseService(this);
  readonly rivalAiService = new RivalAiService(this);
  readonly eventService = new EventService(this);
  readonly releaseService = new ReleaseService(this);
  readonly talentService = new TalentService(this);
  readonly ipService = new IpService(this);
  readonly tutorialService = new TutorialService(this);
  readonly operationsService = new OperationsService(this);

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
    return getLegacySpecializationProfile(this);
  }

  get foundingProfileEffects(): FoundingProfileModifiers {
    return getLegacyFoundingProfileEffects(this);
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

  getScaleOverheadCost(): number {
    return getScaleOverheadCostForStudio(this);
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
    this.ipService.refreshIpMarketplace();
    this.eventService.refillScriptMarket([]);
    this.talentService.refreshTalentMarket();
  }

  get canEndWeek(): boolean {
    return this.pendingCrises.length === 0;
  }

  advanceUntilDecision(maxWeeks: number = TURN_RULES.NEXT_DECISION_MAX_SKIP_WEEKS): {
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
      message: `Auto-advanced ${this.currentWeek - weekStart} week(s) with no new inbox change.`,
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

  getActiveMilestones(): MilestoneRecord[] {
    return getActiveMilestonesForStudio(this);
  }

  getLatestReleaseReport(projectId: string): ReleaseReport | null {
    return getLatestReleaseReportForStudio(this, projectId);
  }

  getGenreDemandMultiplier(genre: MovieGenre): number {
    return getGenreDemandMultiplierForStudio(this, genre);
  }

  getProjectCastStatus(projectId: string): { actorCount: number; actressCount: number; total: number; requiredTotal: number } | null {
    return getProjectCastStatusForStudio(this, projectId);
  }

  meetsCastRequirements(project: MovieProject): boolean {
    return this.talentService.meetsCastRequirements(project);
  }

  getGenreCycleSnapshot(): {
    genre: MovieGenre;
    demand: number;
    momentum: number;
    shockLabel: string | null;
    shockDirection: 'surge' | 'slump' | null;
    shockWeeksRemaining: number;
  }[] {
    return getGenreCycleSnapshotForStudio(this);
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
    return getIndustryHeatLeaderboardForStudio(this);
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

  confirmProjectReleaseWeek(projectId: string): { success: boolean; message: string } {
    return this.lifecycleService.confirmProjectReleaseWeek(projectId);
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

  hasLockedReleaseWeek(project: MovieProject): boolean {
    return project.phase === 'distribution' && project.releaseWeek !== null && project.releaseWeekLocked;
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

    const castRequirements = this.ipService.rollCastRequirements();
    const ceiling = initialBudgetForGenre(pitch.genre);
    const project = createProjectFromScript(
      pitch,
      this.talentService.buildProjectBudgetPlan(pitch.genre, ceiling, castRequirements),
      castRequirements,
    );
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
    if (this.currentWeek % 7 === 0) this.ipService.refreshIpMarketplace();
    if (this.tutorialState === 'firstProject') {
      this.tutorialService.advanceTutorial();
    }
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

    const project = decision.projectId ? this.eventService.getDecisionTargetProject(decision) : null;
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
    this.eventService.applyStoryFlagMutations(option.setFlag, option.clearFlag);
    if (decision.arcId) {
      this.eventService.applyArcMutation(decision.arcId, option);
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
    this.rivalAiService.applyRivalDecisionMemory(decision, option);
    this.decisionQueue = this.decisionQueue.filter((item) => item.id !== decisionId);
  }

  dismissDecision(decisionId: string): void {
    this.decisionQueue = this.decisionQueue.filter((item) => item.id !== decisionId);
  }

  endWeek(): WeekSummary {
    if (!this.canEndWeek) {
      throw new Error('Resolve all crises before ending the week.');
    }
    if (!this.processingTurn) {
      this.generatedCrisisThisTurn = false;
    }
    this.newlyAcquiredProjectId = null;

    const cashBefore = this.cash;
    const tierBefore = this.studioTier;
    const events: string[] = [];

    const burn = this.releaseService.applyWeeklyBurn();
    if (burn > 0) {
      events.push(`Production burn applied: -$${Math.round(burn / 1000)}K`);
    }
    if (this.currentWeek - this.lastScaleOverheadWeek >= 13) {
      const scaleOverhead = this.getScaleOverheadCost();
      this.adjustCash(-scaleOverhead);
      this.lastScaleOverheadWeek = this.currentWeek;
      events.push(`Scale overhead applied: -$${Math.round(scaleOverhead / 1000)}K`);
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
      this.ipService.refreshIpMarketplace(this.currentWeek % 26 === 0);
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
    this.rivalAiService.applyRivalMemoryReversion();
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

    this.generatedCrisisThisTurn = false;
    this.processingTurn = true;

    const targetWeeks = TURN_RULES.WEEKS_PER_TURN;
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

    try {
      for (let step = 0; step < targetWeeks; step += 1) {
        if (!this.canEndWeek) {
          combinedEvents.push('Turn paused: resolve crisis before advancing further.');
          break;
        }
        const weekly = this.endWeek();
        combinedEvents.push(...weekly.events);
      }
    } finally {
      this.processingTurn = false;
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
    return estimateWeeklyBurnForStudio(this);
  }

  addChronicleEntry(entry: Omit<ChronicleEntry, 'id'>): void {
    this.studioChronicle.unshift({ id: createId('chron'), ...entry });
    this.studioChronicle = this.studioChronicle.slice(0, 100);
  }

  getArcPressureFromRivals(arcId: string): number {
    return getArcPressureFromRivalsForStudio(this, arcId);
  }

  getRivalBehaviorProfile(rival: RivalStudio): {
    arcPressure: Record<string, number>;
    talentPoachChance: number;
    calendarMoveChance: number;
    conflictPush: number;
    signatureMoveChance: number;
    budgetScale: number;
    hypeScale: number;
  } {
    return getRivalBehaviorProfileForStudio(this, rival);
  }

  getArcOutcomeModifiers(): ArcOutcomeModifiers {
    return getArcOutcomeModifiersForStudio(this);
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
