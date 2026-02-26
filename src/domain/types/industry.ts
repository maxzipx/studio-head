import type { MovieGenre, ReleaseWindow } from './project';

export interface StudioReputation {
  critics: number;
  talent: number;
  distributor: number;
  audience: number;
}

export type StudioTier =
  | 'indieStudio'
  | 'establishedIndie'
  | 'midTier'
  | 'majorStudio'
  | 'globalPowerhouse';

export type StudioSpecialization = 'balanced' | 'blockbuster' | 'prestige' | 'indie';

export type DepartmentTrack = 'development' | 'production' | 'distribution';

export const STUDIO_TIER_LABELS: Record<StudioTier, string> = {
  indieStudio: 'Indie Studio',
  establishedIndie: 'Established Indie',
  midTier: 'Mid-Tier Studio',
  majorStudio: 'Major Studio',
  globalPowerhouse: 'Global Powerhouse',
};

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

export type RivalInteractionKind =
  | 'talentPoach'
  | 'releaseCollision'
  | 'counterplayEscalation'
  | 'prestigePressure'
  | 'streamingPressure'
  | 'guerrillaPressure'
  | 'calendarUndercut';

export interface RivalInteractionEntry {
  week: number;
  kind: RivalInteractionKind;
  hostilityDelta: number;
  respectDelta: number;
  note: string;
  projectId?: string | null;
}

export interface RivalRelationshipMemory {
  hostility: number;
  respect: number;
  retaliationBias: number;
  cooperationBias: number;
  interactionHistory: RivalInteractionEntry[];
}

export interface RivalStudio {
  id: string;
  name: string;
  personality: RivalPersonality;
  studioHeat: number;
  activeReleases: RivalFilm[];
  upcomingReleases: RivalFilm[];
  lockedTalentIds: string[];
  memory: RivalRelationshipMemory;
}

export interface IndustryNewsItem {
  id: string;
  week: number;
  studioName: string;
  headline: string;
  heatDelta: number;
}

export interface GenreCycleState {
  demand: number;
  momentum: number;
  shockLabel?: string | null;
  shockDirection?: 'surge' | 'slump' | null;
  shockStrength?: number | null;
  shockUntilWeek?: number | null;
}

export interface AwardsProjectResult {
  projectId: string;
  title: string;
  nominations: number;
  wins: number;
  score: number;
}

export interface AwardsSeasonRecord {
  seasonYear: number;
  week: number;
  showName: string;
  results: AwardsProjectResult[];
  headline: string;
}

export type ChronicleEntryType =
  | 'filmRelease'
  | 'arcResolution'
  | 'tierAdvance'
  | 'awardsOutcome'
  | 'festivalOutcome'
  | 'crisisResolved';

export type ChronicleEntryImpact = 'positive' | 'negative' | 'neutral';

export interface ChronicleEntry {
  id: string;
  week: number;
  type: ChronicleEntryType;
  headline: string;
  detail?: string;
  projectTitle?: string;
  impact: ChronicleEntryImpact;
}

export type MilestoneId =
  | 'firstHit'
  | 'firstBlockbuster'
  | 'boxOffice100m'
  | 'lifetimeRevenue1b'
  | 'highestGrossingFilm'
  | 'lowestGrossingFilm';

export interface MilestoneRecord {
  id: MilestoneId;
  title: string;
  description: string;
  unlockedWeek: number;
  value?: number;
}

export type ReleaseOutcomeLabel = 'flop' | 'hit' | 'blockbuster';

export interface ReleasePerformanceBreakdown {
  script: number;
  direction: number;
  starPower: number;
  marketing: number;
  timing: number;
  genreCycle: number;
}

export interface ReleaseReport {
  projectId: string;
  title: string;
  weekResolved: number;
  totalBudget: number;
  totalGross: number;
  studioNet: number;
  profit: number;
  roi: number;
  openingWeekend: number;
  critics: number;
  audience: number;
  outcome: ReleaseOutcomeLabel;
  wasRecordOpening: boolean;
  breakdown: ReleasePerformanceBreakdown;
}

export type IpKind = 'book' | 'game' | 'comic' | 'superhero';

export interface OwnedIp {
  id: string;
  name: string;
  kind: IpKind;
  genre: MovieGenre;
  acquisitionCost: number;
  qualityBonus: number;
  hypeBonus: number;
  prestigeBonus: number;
  commercialBonus: number;
  expiresWeek: number;
  usedProjectId: string | null;
  major: boolean;
}
