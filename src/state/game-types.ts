import type { DepartmentTrack, FranchiseStrategy, NegotiationAction, StudioSpecialization } from '@/src/domain/types';
import { StudioManager } from '@/src/domain/studio-manager';

type SelectableFranchiseStrategy = Exclude<FranchiseStrategy, 'none'>;

export interface GameContextValue {
  manager: StudioManager;
  tick: number;
  lastMessage: string | null;
  endWeek: () => void;
  advanceToNextDecision: () => void;
  setTurnLength: (weeks: 1 | 2) => void;
  resolveCrisis: (crisisId: string, optionId: string) => void;
  resolveDecision: (decisionId: string, optionId: string) => void;
  runOptionalAction: () => void;
  acquireScript: (scriptId: string) => void;
  passScript: (scriptId: string) => void;
  renameStudio: (name: string) => void;
  attachTalent: (projectId: string, talentId: string) => void;
  startNegotiation: (projectId: string, talentId: string) => void;
  adjustNegotiation: (projectId: string, talentId: string, action: NegotiationAction) => void;
  advancePhase: (projectId: string) => void;
  setReleaseWeek: (projectId: string, releaseWeek: number) => void;
  acceptOffer: (projectId: string, offerId: string) => void;
  counterOffer: (projectId: string, offerId: string) => void;
  walkAwayOffer: (projectId: string) => void;
  dismissReleaseReveal: (projectId: string) => void;
  runMarketingPush: (projectId: string) => void;
  runFestivalSubmission: (projectId: string) => void;
  runScriptSprint: (projectId: string) => void;
  runPostPolishPass: (projectId: string) => void;
  abandonProject: (projectId: string) => void;
  startSequel: (projectId: string) => void;
  setFranchiseStrategy: (projectId: string, strategy: SelectableFranchiseStrategy) => void;
  runFranchiseBrandReset: (projectId: string) => void;
  runFranchiseLegacyCastingCampaign: (projectId: string) => void;
  runFranchiseHiatusPlanning: (projectId: string) => void;
  runGreenlightReview: (projectId: string, approve: boolean) => void;
  runTestScreening: (projectId: string) => void;
  runReshoots: (projectId: string) => void;
  runTrackingLeverage: (projectId: string) => void;
  upgradeMarketingTeam: () => void;
  upgradeStudioCapacity: () => void;
  acquireIpRights: (ipId: string) => void;
  developFromIp: (ipId: string) => void;
  setStudioSpecialization: (focus: StudioSpecialization) => void;
  investDepartment: (track: DepartmentTrack) => void;
  signExclusivePartner: (partner: string) => void;
  poachExecutiveTeam: () => void;
}

export type GameActionKeys = Exclude<keyof GameContextValue, 'manager' | 'tick' | 'lastMessage'>;
export type GameActions = Pick<GameContextValue, GameActionKeys>;
