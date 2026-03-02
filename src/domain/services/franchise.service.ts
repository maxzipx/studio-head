import type { StudioManager } from '../studio-manager';
import type {
  FranchiseProjectionModifiers,
  FranchiseStatusSnapshot,
  FranchiseStrategy,
  MovieProject,
  SequelCandidate,
  SequelEligibility,
} from '../types';
import {
  getFranchiseProjectionModifiersForManager,
  getFranchiseStatusForManager,
  getSequelCandidatesForManager,
  getSequelEligibilityForManager,
  markFranchiseReleaseForManager,
  runFranchiseBrandResetForManager,
  runFranchiseHiatusPlanningForManager,
  runFranchiseLegacyCastingCampaignForManager,
  setFranchiseStrategyForManager,
  startSequelForManager,
} from '../studio-manager.franchise';

export class FranchiseService {
  constructor(private readonly manager: StudioManager) {}

  getSequelEligibility(projectId: string): SequelEligibility | null {
    return getSequelEligibilityForManager(this.manager, projectId);
  }

  getSequelCandidates(): SequelCandidate[] {
    return getSequelCandidatesForManager(this.manager);
  }

  startSequel(projectId: string): { success: boolean; message: string; projectId?: string } {
    return startSequelForManager(this.manager, projectId);
  }

  setFranchiseStrategy(
    projectId: string,
    strategy: Exclude<FranchiseStrategy, 'none'>
  ): { success: boolean; message: string } {
    return setFranchiseStrategyForManager(this.manager, projectId, strategy);
  }

  getFranchiseProjectionModifiers(
    project: MovieProject,
    releaseWeek: number
  ): FranchiseProjectionModifiers {
    return getFranchiseProjectionModifiersForManager(this.manager, project, releaseWeek);
  }

  getFranchiseStatus(projectId: string): FranchiseStatusSnapshot | null {
    return getFranchiseStatusForManager(this.manager, projectId);
  }

  runFranchiseBrandReset(projectId: string): { success: boolean; message: string } {
    return runFranchiseBrandResetForManager(this.manager, projectId);
  }

  runFranchiseLegacyCastingCampaign(projectId: string): { success: boolean; message: string } {
    return runFranchiseLegacyCastingCampaignForManager(this.manager, projectId);
  }

  runFranchiseHiatusPlanning(projectId: string): { success: boolean; message: string } {
    return runFranchiseHiatusPlanningForManager(this.manager, projectId);
  }

  markFranchiseRelease(projectId: string): void {
    markFranchiseReleaseForManager(this.manager, projectId);
  }
}
