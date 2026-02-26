export type MovieGenre =
  | 'action'
  | 'drama'
  | 'comedy'
  | 'horror'
  | 'thriller'
  | 'sciFi'
  | 'animation'
  | 'documentary';

export type ProjectPhase =
  | 'development'
  | 'preProduction'
  | 'production'
  | 'postProduction'
  | 'distribution'
  | 'released';

export type FestivalStatus = 'none' | 'submitted' | 'selected' | 'buzzed' | 'snubbed';

export type ReleaseWindow =
  | 'wideTheatrical'
  | 'limitedTheatrical';

export type TalentRole =
  | 'director'
  | 'leadActor'
  | 'supportingActor'
  | 'cinematographer'
  | 'composer';

export type AgentTier = 'caa' | 'wme' | 'uta' | 'independent';

export type AvailabilityStatus = 'available' | 'inNegotiation' | 'attached' | 'unavailable';

export type ProductionHealth = 'onTrack' | 'atRisk' | 'inCrisis';

export interface BudgetObject {
  ceiling: number;
  aboveTheLine: number;
  belowTheLine: number;
  postProduction: number;
  contingency: number;
  overrunRisk: number;
  actualSpend: number;
}

export interface SalaryObject {
  base: number;
  backendPoints: number;
  perksCost: number;
}

export type TalentTrustLevel = 'hostile' | 'wary' | 'neutral' | 'aligned' | 'loyal';

export type TalentInteractionKind =
  | 'negotiationOpened'
  | 'negotiationSweetened'
  | 'negotiationHardline'
  | 'negotiationDeclined'
  | 'quickCloseFailed'
  | 'quickCloseSuccess'
  | 'dealSigned'
  | 'dealStalled'
  | 'projectReleased'
  | 'projectAbandoned'
  | 'poachedByRival'
  | 'counterPoachWon'
  | 'counterPoachLost';

export interface TalentInteractionEntry {
  week: number;
  kind: TalentInteractionKind;
  trustDelta: number;
  loyaltyDelta: number;
  note: string;
  projectId?: string | null;
}

export interface TalentRelationshipMemory {
  trust: number;
  loyalty: number;
  interactionHistory: TalentInteractionEntry[];
}

export interface Talent {
  id: string;
  name: string;
  role: TalentRole;
  starPower: number;
  craftScore: number;
  genreFit: Partial<Record<MovieGenre, number>>;
  egoLevel: number;
  salary: SalaryObject;
  availability: AvailabilityStatus;
  unavailableUntilWeek: number | null;
  attachedProjectId: string | null;
  reputation: number;
  agentTier: AgentTier;
  studioRelationship: number;
  relationshipMemory: TalentRelationshipMemory;
}

export interface ScriptPitch {
  id: string;
  title: string;
  genre: MovieGenre;
  askingPrice: number;
  scriptQuality: number;
  conceptStrength: number;
  logline: string;
  expiresInWeeks: number;
}

export interface FranchiseTrack {
  id: string;
  name: string;
  genre: MovieGenre;
  rootProjectId: string;
  projectIds: string[];
  releasedProjectIds: string[];
  activeProjectId: string | null;
  momentum: number;
  fatigue: number;
  lastReleaseWeek: number | null;
  cadenceBufferWeeks: number;
  brandResetCount: number;
  legacyCastingCampaignCount: number;
  hiatusPlanCount: number;
}

export interface SequelEligibility {
  projectId: string;
  franchiseId: string | null;
  nextEpisode: number;
  projectedMomentum: number;
  projectedFatigue: number;
  upfrontCost: number;
  carryoverHype: number;
  eligible: boolean;
  reason?: string;
}

export interface SequelCandidate extends SequelEligibility {
  title: string;
  genre: MovieGenre;
}

export type FranchiseStrategy = 'none' | 'safe' | 'balanced' | 'reinvention';

export interface FranchiseProjectionModifiers {
  momentum: number;
  fatigue: number;
  strategy: FranchiseStrategy;
  episode: number;
  effectiveGapWeeks: number;
  cadencePressure: number;
  structuralPressure: number;
  returningDirector: boolean;
  returningCastCount: number;
  openingMultiplier: number;
  roiMultiplier: number;
  openingPenaltyPct: number;
  roiPenaltyPct: number;
  criticalDelta: number;
  audienceDelta: number;
}

export interface FranchiseStatusSnapshot {
  franchiseId: string;
  franchiseName: string;
  episode: number;
  releasedEntries: number;
  momentum: number;
  fatigue: number;
  lastReleaseWeek: number | null;
  projectedReleaseWeek: number;
  cadenceBufferWeeks: number;
  brandResetCount: number;
  legacyCastingCampaignCount: number;
  hiatusPlanCount: number;
  activeFlags: string[];
  modifiers: FranchiseProjectionModifiers;
  nextBrandResetCost: number;
  nextLegacyCastingCampaignCost: number;
  nextHiatusPlanCost: number;
}

export interface MovieProject {
  id: string;
  title: string;
  genre: MovieGenre;
  phase: ProjectPhase;
  budget: BudgetObject;
  scriptQuality: number;
  conceptStrength: number;
  editorialScore: number;
  postPolishPasses: number;
  directorId: string | null;
  castIds: string[];
  productionStatus: ProductionHealth;
  scheduledWeeksRemaining: number;
  hypeScore: number;
  marketingBudget: number;
  releaseWindow: ReleaseWindow | null;
  releaseWeek: number | null;
  distributionPartner: string | null;
  studioRevenueShare: number;
  projectedROI: number;
  openingWeekendGross: number | null;
  weeklyGrossHistory: number[];
  releaseWeeksRemaining: number;
  releaseResolved: boolean;
  finalBoxOffice: number | null;
  criticalScore: number | null;
  audienceScore: number | null;
  awardsNominations: number;
  awardsWins: number;
  festivalStatus: FestivalStatus;
  festivalTarget: string | null;
  festivalSubmissionWeek: number | null;
  festivalResolutionWeek: number | null;
  festivalBuzz: number;
  prestige: number;
  commercialAppeal: number;
  originality: number;
  controversy: number;
  franchiseId: string | null;
  franchiseEpisode: number | null;
  sequelToProjectId: string | null;
  franchiseCarryoverHype: number;
  franchiseStrategy: FranchiseStrategy;
  greenlightApproved?: boolean;
  greenlightWeek?: number | null;
  greenlightFeePaid?: number;
  greenlightLockedCeiling?: number | null;
  sentBackForRewriteCount?: number;
  testScreeningCompleted?: boolean;
  testScreeningWeek?: number | null;
  testScreeningCriticalLow?: number | null;
  testScreeningCriticalHigh?: number | null;
  testScreeningAudienceSentiment?: 'weak' | 'mixed' | 'strong' | null;
  reshootCount?: number;
  trackingProjectionOpening?: number | null;
  trackingConfidence?: number | null;
  trackingLeverageAmount?: number;
  trackingSettled?: boolean;
  merchandiseWeeksRemaining?: number;
  merchandiseWeeklyRevenue?: number;
  adaptedFromIpId?: string | null;
}

export interface PlayerNegotiation {
  talentId: string;
  projectId: string;
  openedWeek: number;
  rounds?: number;
  holdLineCount?: number;
  offerSalaryMultiplier?: number;
  offerBackendPoints?: number;
  offerPerksBudget?: number;
  lastComputedChance?: number;
  lastResponse?: string;
}

export type NegotiationAction = 'sweetenSalary' | 'sweetenBackend' | 'sweetenPerks' | 'holdFirm';

export interface DistributionOffer {
  id: string;
  projectId: string;
  partner: string;
  releaseWindow: ReleaseWindow;
  minimumGuarantee: number;
  pAndACommitment: number;
  revenueShareToStudio: number;
  projectedOpeningOverride: number;
  counterAttempts: number;
}

export interface WeekSummary {
  week: number;
  cashDelta: number;
  events: string[];
  hasPendingCrises: boolean;
  decisionQueueCount: number;
}
