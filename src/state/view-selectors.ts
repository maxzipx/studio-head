import type { CrisisEvent, DecisionItem, InboxNotification, MovieProject, ReleaseReport } from '../domain/types';
import type { GameState } from './game-store';
import {
  buildBoxOfficeReleasedSignature,
  buildInboxCrisesSignature,
  buildInboxDecisionsSignature,
  buildInboxNotificationsSignature,
  buildInboxProjectsSignature,
  buildReleaseReportsSignature,
} from './view-signatures';

export interface InboxViewState {
  crises: CrisisEvent[];
  decisions: DecisionItem[];
  updates: InboxNotification[];
  projects: MovieProject[];
  resolveCrisis: GameState['resolveCrisis'];
  resolveDecision: GameState['resolveDecision'];
  dismissDecision: GameState['dismissDecision'];
  dismissInboxNotification: GameState['dismissInboxNotification'];
  crisesSignature: string;
  decisionsSignature: string;
  inboxSignature: string;
  projectsSignature: string;
}

export function selectInboxView(state: GameState): InboxViewState {
  const manager = state.manager;
  return {
    crises: manager.pendingCrises,
    decisions: manager.decisionQueue,
    updates: manager.inboxNotifications,
    projects: manager.activeProjects,
    resolveCrisis: state.resolveCrisis,
    resolveDecision: state.resolveDecision,
    dismissDecision: state.dismissDecision,
    dismissInboxNotification: state.dismissInboxNotification,
    crisesSignature: buildInboxCrisesSignature(manager.pendingCrises),
    decisionsSignature: buildInboxDecisionsSignature(manager.decisionQueue),
    inboxSignature: buildInboxNotificationsSignature(manager.inboxNotifications),
    projectsSignature: buildInboxProjectsSignature(manager.activeProjects),
  };
}

export interface BoxOfficeViewState {
  projects: MovieProject[];
  releaseReports: ReleaseReport[];
  lastMessage: string | null;
  releasedSignature: string;
  reportsSignature: string;
}

export function selectBoxOfficeView(state: GameState): BoxOfficeViewState {
  const manager = state.manager;
  return {
    projects: manager.activeProjects,
    releaseReports: manager.releaseReports,
    lastMessage: state.lastMessage,
    releasedSignature: buildBoxOfficeReleasedSignature(manager.activeProjects),
    reportsSignature: buildReleaseReportsSignature(manager.releaseReports),
  };
}
