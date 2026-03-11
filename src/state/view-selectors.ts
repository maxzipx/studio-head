import type { CrisisEvent, DecisionItem, InboxNotification, MovieProject, ReleaseReport } from '../domain/types';
import type { GameState } from './game-store';
import {
  buildBoxOfficeReleasedSignature,
  buildInboxCrisesSignature,
  buildInboxDecisionsSignature,
  buildInboxNotificationsSignature,
  buildInboxProjectsSignature,
  buildReleaseReportsSignature,
  buildSlateOffersSignature,
  buildSlateProjectsSignature,
  buildSlateRivalsSignature,
  buildSlateScriptsSignature,
  buildTalentNegotiationSignature,
  buildTalentPoolSignature,
  buildTalentProjectsSignature,
  buildTalentRivalsSignature,
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

// ─── Slate Screen ─────────────────────────────────────────────────────────────

export interface SlateViewState {
  manager: GameState['manager'];
  lastMessage: string | null;
  acquireScript: GameState['acquireScript'];
  advancePhase: GameState['advancePhase'];
  passScript: GameState['passScript'];
  setReleaseWeek: GameState['setReleaseWeek'];
  confirmReleaseWeek: GameState['confirmReleaseWeek'];
  acceptOffer: GameState['acceptOffer'];
  counterOffer: GameState['counterOffer'];
  walkAwayOffer: GameState['walkAwayOffer'];
  projectsSignature: string;
  scriptsSignature: string;
  offersSignature: string;
  rivalsSignature: string;
}

export function selectSlateView(state: GameState): SlateViewState {
  const manager = state.manager;
  return {
    manager,
    lastMessage: state.lastMessage,
    acquireScript: state.acquireScript,
    advancePhase: state.advancePhase,
    passScript: state.passScript,
    setReleaseWeek: state.setReleaseWeek,
    confirmReleaseWeek: state.confirmReleaseWeek,
    acceptOffer: state.acceptOffer,
    counterOffer: state.counterOffer,
    walkAwayOffer: state.walkAwayOffer,
    projectsSignature: buildSlateProjectsSignature(manager.activeProjects),
    scriptsSignature: buildSlateScriptsSignature(manager.scriptMarket),
    offersSignature: buildSlateOffersSignature(manager.distributionOffers),
    rivalsSignature: buildSlateRivalsSignature(manager.rivals),
  };
}

// ─── Talent Screen ────────────────────────────────────────────────────────────

export interface TalentViewState {
  manager: GameState['manager'];
  lastMessage: string | null;
  startNegotiation: GameState['startNegotiation'];
  adjustNegotiation: GameState['adjustNegotiation'];
  dismissNegotiation: GameState['dismissNegotiation'];
  attachTalent: GameState['attachTalent'];
  projectsSignature: string;
  talentSignature: string;
  negotiationSignature: string;
  rivalsSignature: string;
  talentChanceContext: string;
}

export function selectTalentView(state: GameState): TalentViewState {
  const manager = state.manager;
  return {
    manager,
    lastMessage: state.lastMessage,
    startNegotiation: state.startNegotiation,
    adjustNegotiation: state.adjustNegotiation,
    dismissNegotiation: state.dismissNegotiation,
    attachTalent: state.attachTalent,
    projectsSignature: buildTalentProjectsSignature(manager.activeProjects),
    talentSignature: buildTalentPoolSignature(manager.talentPool),
    negotiationSignature: buildTalentNegotiationSignature(manager.playerNegotiations),
    rivalsSignature: buildTalentRivalsSignature(manager.rivals),
    talentChanceContext: `${manager.reputation.talent}:${manager.executiveNetworkLevel}:${manager.studioSpecialization}`,
  };
}

// ─── Financials Screen ────────────────────────────────────────────────────────

export interface FinancialsViewState {
  manager: GameState['manager'];
  lastMessage: string | null;
}

export function selectFinancialsView(state: GameState): FinancialsViewState {
  return {
    manager: state.manager,
    lastMessage: state.lastMessage,
  };
}

// ─── HQ Screen ───────────────────────────────────────────────────────────────

export interface HQViewState {
  manager: GameState['manager'];
  lastMessage: string | null;
  endWeek: GameState['endWeek'];
  runOptionalAction: GameState['runOptionalAction'];
  upgradeMarketingTeam: GameState['upgradeMarketingTeam'];
  upgradeStudioCapacity: GameState['upgradeStudioCapacity'];
  setStudioSpecialization: GameState['setStudioSpecialization'];
  investDepartment: GameState['investDepartment'];
  signExclusivePartner: GameState['signExclusivePartner'];
  poachExecutiveTeam: GameState['poachExecutiveTeam'];
  renameStudio: GameState['renameStudio'];
  tick: number;
}

export function selectHQView(state: GameState): HQViewState {
  return {
    manager: state.manager,
    lastMessage: state.lastMessage,
    endWeek: state.endWeek,
    runOptionalAction: state.runOptionalAction,
    upgradeMarketingTeam: state.upgradeMarketingTeam,
    upgradeStudioCapacity: state.upgradeStudioCapacity,
    setStudioSpecialization: state.setStudioSpecialization,
    investDepartment: state.investDepartment,
    signExclusivePartner: state.signExclusivePartner,
    poachExecutiveTeam: state.poachExecutiveTeam,
    renameStudio: state.renameStudio,
    tick: state.tick,
  };
}

// ─── Project Detail Screen ────────────────────────────────────────────────────

export interface ProjectDetailViewState {
  manager: GameState['manager'];
  lastMessage: string | null;
  advancePhase: GameState['advancePhase'];
  setReleaseWeek: GameState['setReleaseWeek'];
  confirmReleaseWeek: GameState['confirmReleaseWeek'];
  acceptOffer: GameState['acceptOffer'];
  counterOffer: GameState['counterOffer'];
  walkAwayOffer: GameState['walkAwayOffer'];
  runMarketingPush: GameState['runMarketingPush'];
  runFestivalSubmission: GameState['runFestivalSubmission'];
  runScriptSprint: GameState['runScriptSprint'];
  runPostPolishPass: GameState['runPostPolishPass'];
  runGreenlightReview: GameState['runGreenlightReview'];
  runTestScreening: GameState['runTestScreening'];
  runReshoots: GameState['runReshoots'];
  runTrackingLeverage: GameState['runTrackingLeverage'];
  abandonProject: GameState['abandonProject'];
  startSequel: GameState['startSequel'];
  setFranchiseStrategy: GameState['setFranchiseStrategy'];
  runFranchiseBrandReset: GameState['runFranchiseBrandReset'];
  runFranchiseLegacyCastingCampaign: GameState['runFranchiseLegacyCastingCampaign'];
  runFranchiseHiatusPlanning: GameState['runFranchiseHiatusPlanning'];
  dismissReleaseReveal: GameState['dismissReleaseReveal'];
}

export function selectProjectDetailView(state: GameState): ProjectDetailViewState {
  return {
    manager: state.manager,
    lastMessage: state.lastMessage,
    advancePhase: state.advancePhase,
    setReleaseWeek: state.setReleaseWeek,
    confirmReleaseWeek: state.confirmReleaseWeek,
    acceptOffer: state.acceptOffer,
    counterOffer: state.counterOffer,
    walkAwayOffer: state.walkAwayOffer,
    runMarketingPush: state.runMarketingPush,
    runFestivalSubmission: state.runFestivalSubmission,
    runScriptSprint: state.runScriptSprint,
    runPostPolishPass: state.runPostPolishPass,
    runGreenlightReview: state.runGreenlightReview,
    runTestScreening: state.runTestScreening,
    runReshoots: state.runReshoots,
    runTrackingLeverage: state.runTrackingLeverage,
    abandonProject: state.abandonProject,
    startSequel: state.startSequel,
    setFranchiseStrategy: state.setFranchiseStrategy,
    runFranchiseBrandReset: state.runFranchiseBrandReset,
    runFranchiseLegacyCastingCampaign: state.runFranchiseLegacyCastingCampaign,
    runFranchiseHiatusPlanning: state.runFranchiseHiatusPlanning,
    dismissReleaseReveal: state.dismissReleaseReveal,
  };
}
