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
}

export interface CrisisEvent {
  id: string;
  projectId: string;
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
}

export interface DecisionItem {
  id: string;
  projectId: string | null;
  title: string;
  body: string;
  weeksUntilExpiry: number;
  options: DecisionOption[];
}

export interface EventTemplate {
  id: string;
  title: string;
  body: string;
  cooldownWeeks: number;
  baseWeight: number;
  minWeek: number;
  buildDecision: (input: {
    idFactory: (prefix: string) => string;
    projectId: string | null;
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
  directorId: string | null;
  castIds: string[];
  productionStatus: ProductionHealth;
  scheduledWeeksRemaining: number;
  hypeScore: number;
  marketingBudget: number;
  releaseWindow: ReleaseWindow | null;
  projectedROI: number;
  finalBoxOffice: number | null;
  criticalScore: number | null;
  audienceScore: number | null;
}

export interface WeekSummary {
  week: number;
  cashDelta: number;
  events: string[];
  hasPendingCrises: boolean;
  decisionQueueCount: number;
}
