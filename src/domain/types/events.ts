import type { ProjectPhase, FranchiseTrack, MovieProject, Talent } from './project';
import type { StudioTier, StudioReputation, RivalStudio } from './industry';

export interface BuildDecisionContext {
  readonly talentPool: readonly Talent[];
  readonly activeProjects: readonly MovieProject[];
  readonly rivals: readonly RivalStudio[];
  readonly reputation: Readonly<StudioReputation>;
  readonly storyFlags: Readonly<Record<string, number>>;
  readonly cash: number;
  readonly currentWeek: number;
  readonly studioTier: StudioTier;
  readonly franchises: readonly FranchiseTrack[];
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
  criticsDelta?: number;
  talentRepDelta?: number;
  distributorRepDelta?: number;
  audienceDelta?: number;
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

export type InboxNotificationKind = 'negotiationSuccess' | 'scriptAcquired';

export interface InboxNotification {
  id: string;
  week: number;
  kind: InboxNotificationKind;
  title: string;
  body: string;
  projectId: string | null;
}

export interface ArcRequirement {
  id: string;
  minStage?: number;
  maxStage?: number;
  status?: 'active' | 'resolved' | 'failed';
}

export interface EventEligibilityConfig {
  targetPhases?: ProjectPhase[];
  minStudioTier?: StudioTier;
  maxStudioTier?: StudioTier;
  cooldownWeeks?: number;
  baseWeight?: number;
  minWeek?: number;
}

export interface EventTemplateDraft extends EventEligibilityConfig {
  id: string;
  category: DecisionCategory;
  scope: 'project' | 'studio';
  requiresFlag?: string;
  blocksFlag?: string;
  requiresArc?: ArcRequirement;
  blocksArc?: ArcRequirement;
  title: string;
  decisionTitle: string;
  body: string;
  buildDecision: (input: {
    idFactory: (prefix: string) => string;
    projectId: string | null;
    projectTitle: string | null;
    currentWeek: number;
    context: BuildDecisionContext;
  }) => DecisionItem | null;
}

export interface EventTemplate extends EventTemplateDraft {
  cooldownWeeks: number;
  baseWeight: number;
  minWeek: number;
}

export interface StoryArcState {
  stage: number;
  status: 'active' | 'resolved' | 'failed';
  lastUpdatedWeek: number;
}
