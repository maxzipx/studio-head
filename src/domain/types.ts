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

export type ReleaseWindow =
  | 'wideTheatrical'
  | 'limitedTheatrical'
  | 'streamingExclusive'
  | 'hybridWindow';

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

export interface CrisisOption {
  id: string;
  label: string;
  preview: string;
  cashDelta: number;
  scheduleDelta: number;
  hypeDelta: number;
  releaseWeekShift?: number;
  kind?: 'standard' | 'talentCounter' | 'talentWalk' | 'releaseHold' | 'releaseShift';
  talentId?: string;
  rivalStudioId?: string;
  premiumMultiplier?: number;
}

export interface CrisisEvent {
  id: string;
  projectId: string;
  kind: 'production' | 'talentPoached' | 'releaseConflict';
  title: string;
  severity: 'yellow' | 'orange' | 'red';
  body: string;
  options: CrisisOption[];
}

export interface DecisionOption {
  id: string;
  label: string;
  preview: string;
  cashDelta: number;
  scriptQualityDelta: number;
  hypeDelta: number;
  studioHeatDelta?: number;
  scheduleDelta?: number;
  releaseWeekShift?: number;
  marketingDelta?: number;
  overrunRiskDelta?: number;
  setFlag?: string;
  clearFlag?: string;
  setArcStage?: number;
  advanceArcBy?: number;
  resolveArc?: boolean;
  failArc?: boolean;
}

export type DecisionCategory = 'creative' | 'marketing' | 'operations' | 'finance' | 'talent';

export interface DecisionItem {
  id: string;
  projectId: string | null;
  title: string;
  body: string;
  weeksUntilExpiry: number;
  onExpireClearFlag?: string;
  category?: DecisionCategory;
  sourceEventId?: string;
  arcId?: string;
  arcStage?: number;
  options: DecisionOption[];
}

export interface ArcRequirement {
  id: string;
  minStage?: number;
  maxStage?: number;
  status?: 'active' | 'resolved' | 'failed';
}

export interface EventTemplate {
  id: string;
  category: DecisionCategory;
  scope: 'project' | 'studio';
  targetPhases?: ProjectPhase[];
  requiresFlag?: string;
  blocksFlag?: string;
  requiresArc?: ArcRequirement;
  blocksArc?: ArcRequirement;
  title: string;
  decisionTitle: string;
  body: string;
  cooldownWeeks: number;
  baseWeight: number;
  minWeek: number;
  buildDecision: (input: {
    idFactory: (prefix: string) => string;
    projectId: string | null;
    projectTitle: string | null;
    currentWeek: number;
  }) => DecisionItem;
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

export type RivalPersonality =
  | 'prestigeHunter'
  | 'blockbusterFactory'
  | 'genreSpecialist'
  | 'streamingFirst'
  | 'scrappyUpstart';

export interface RivalFilm {
  id: string;
  title: string;
  genre: MovieGenre;
  releaseWeek: number;
  releaseWindow: ReleaseWindow;
  estimatedBudget: number;
  hypeScore: number;
  finalGross: number | null;
  criticalScore: number | null;
}

export interface RivalStudio {
  id: string;
  name: string;
  personality: RivalPersonality;
  studioHeat: number;
  activeReleases: RivalFilm[];
  upcomingReleases: RivalFilm[];
  lockedTalentIds: string[];
}

export interface IndustryNewsItem {
  id: string;
  week: number;
  studioName: string;
  headline: string;
  heatDelta: number;
}

export interface StoryArcState {
  stage: number;
  status: 'active' | 'resolved' | 'failed';
  lastUpdatedWeek: number;
}
