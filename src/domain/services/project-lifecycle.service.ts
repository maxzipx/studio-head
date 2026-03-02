import type { StudioManager } from '../studio-manager';
import type { MovieProject } from '../types';
import {
  acceptDistributionOfferForManager,
  advanceProjectPhaseForManager,
  counterDistributionOfferForManager,
  estimateReleaseRunWeeksForManager,
  generateDistributionOffersForManager,
  setProjectReleaseWeekForManager,
  tickDistributionWindowsForManager,
  walkAwayDistributionForManager,
} from '../studio-manager.lifecycle';

export class ProjectLifecycleService {
  constructor(private readonly manager: StudioManager) {}

  setProjectReleaseWeek(projectId: string, releaseWeek: number): { success: boolean; message: string } {
    return setProjectReleaseWeekForManager(this.manager, projectId, releaseWeek);
  }

  advanceProjectPhase(projectId: string): { success: boolean; message: string } {
    return advanceProjectPhaseForManager(this.manager, projectId);
  }

  acceptDistributionOffer(projectId: string, offerId: string): { success: boolean; message: string } {
    return acceptDistributionOfferForManager(this.manager, projectId, offerId);
  }

  counterDistributionOffer(projectId: string, offerId: string): { success: boolean; message: string } {
    return counterDistributionOfferForManager(this.manager, projectId, offerId);
  }

  walkAwayDistribution(projectId: string): { success: boolean; message: string } {
    return walkAwayDistributionForManager(this.manager, projectId);
  }

  estimateReleaseRunWeeks(project: MovieProject): number {
    return estimateReleaseRunWeeksForManager(this.manager, project);
  }

  tickDistributionWindows(events: string[]): void {
    tickDistributionWindowsForManager(this.manager, events);
  }

  generateDistributionOffers(projectId: string): void {
    generateDistributionOffersForManager(this.manager, projectId);
  }
}
