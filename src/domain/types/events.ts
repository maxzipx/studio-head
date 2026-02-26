import type { ProjectPhase } from './project';

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

export interface StoryArcState {
  stage: number;
  status: 'active' | 'resolved' | 'failed';
  lastUpdatedWeek: number;
}
