import type { DistributionOffer, MovieProject } from './types';
import { createId } from './id';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function setProjectReleaseWeekForManager(
  manager: any,
  projectId: string,
  releaseWeek: number
): { success: boolean; message: string } {
  const project = manager.activeProjects.find((item: any) => item.id === projectId);
  if (!project || project.phase !== 'distribution') {
    return { success: false, message: 'Project is not in distribution.' };
  }
  project.releaseWeek = clamp(Math.round(releaseWeek), manager.currentWeek + 1, manager.currentWeek + 52);
  return { success: true, message: `${project.title} release moved to week ${project.releaseWeek}.` };
}

export function advanceProjectPhaseForManager(manager: any, projectId: string): { success: boolean; message: string } {
  const project = manager.activeProjects.find((item: any) => item.id === projectId);
  if (!project) return { success: false, message: 'Project not found.' };

  if (project.phase === 'development') {
    if (!project.directorId) return { success: false, message: 'Attach a director before moving to pre-production.' };
    if (project.castIds.length < 1) return { success: false, message: 'Attach at least one cast lead before moving forward.' };
    if (project.scriptQuality < 6) return { success: false, message: 'Script quality is too low to greenlight.' };
    project.phase = 'preProduction';
    project.scheduledWeeksRemaining = 8;
    return { success: true, message: `${project.title} moved to Pre-Production.` };
  }

  if (project.phase === 'preProduction') {
    if (project.scheduledWeeksRemaining > 0) {
      return { success: false, message: 'Finish pre-production weeks before principal photography.' };
    }
    project.phase = 'production';
    project.scheduledWeeksRemaining = 14;
    project.productionStatus = 'onTrack';
    return { success: true, message: `${project.title} moved to Production.` };
  }

  if (project.phase === 'production') {
    if (project.scheduledWeeksRemaining > 0) {
      return { success: false, message: 'Production schedule still has remaining weeks.' };
    }
    if (manager.pendingCrises.some((item: any) => item.projectId === project.id)) {
      return { success: false, message: 'Resolve project crises before moving to post.' };
    }
    project.phase = 'postProduction';
    project.scheduledWeeksRemaining = 6;
    project.productionStatus = 'onTrack';
    return { success: true, message: `${project.title} moved to Post-Production.` };
  }

  if (project.phase === 'postProduction') {
    if (project.scheduledWeeksRemaining > 0) {
      return { success: false, message: 'Editorial timeline still in progress.' };
    }
    if (project.marketingBudget <= 0) {
      return { success: false, message: 'Allocate marketing spend before entering distribution.' };
    }
    project.phase = 'distribution';
    project.releaseWindow = null;
    project.releaseWeek = manager.currentWeek + 4;
    project.scheduledWeeksRemaining = 3;
    generateDistributionOffersForManager(manager, project.id);
    return { success: true, message: `${project.title} moved to Distribution.` };
  }

  if (project.phase === 'distribution') {
    if (project.scheduledWeeksRemaining > 0) {
      return { success: false, message: 'Distribution setup is still underway.' };
    }
    if (!project.releaseWindow) {
      return { success: false, message: 'Select a distribution deal first.' };
    }
    if (project.releaseWeek && manager.currentWeek < project.releaseWeek) {
      return { success: false, message: `${project.title} is scheduled for week ${project.releaseWeek}. End Turn to reach release.` };
    }
    const projection = manager.getProjectedForProject(project.id);
    if (!projection) return { success: false, message: 'Projection unavailable.' };
    const franchiseModifiers = manager.getFranchiseProjectionModifiers?.(project.id);
    const audienceDelta = franchiseModifiers?.audienceDelta ?? 0;
    project.phase = 'released';
    project.criticalScore = projection.critical;
    project.audienceScore = clamp(projection.critical + 4 + audienceDelta, 0, 100);
    project.openingWeekendGross = projection.openingHigh;
    project.weeklyGrossHistory = [projection.openingHigh];
    project.finalBoxOffice = projection.openingHigh;
    project.releaseWeeksRemaining = estimateReleaseRunWeeksForManager(manager, project);
    project.releaseResolved = false;
    project.projectedROI = projection.roi;
    manager.pendingReleaseReveals.push(project.id);
    manager.releaseTalent(project.id, 'released');
    return { success: true, message: `${project.title} released. Opening weekend posted.` };
  }

  return { success: false, message: 'Project is already released.' };
}

export function acceptDistributionOfferForManager(
  manager: any,
  projectId: string,
  offerId: string
): { success: boolean; message: string } {
  const project = manager.activeProjects.find((item: any) => item.id === projectId);
  if (!project || project.phase !== 'distribution') {
    return { success: false, message: 'Project is not in distribution phase.' };
  }
  const offer = manager.distributionOffers.find((item: any) => item.id === offerId && item.projectId === projectId);
  if (!offer) return { success: false, message: 'Offer not found.' };
  if (offer.releaseWindow !== 'wideTheatrical' && offer.releaseWindow !== 'limitedTheatrical') {
    return { success: false, message: 'Player studio can only accept theatrical distribution windows.' };
  }

  project.releaseWindow = offer.releaseWindow;
  project.distributionPartner = offer.partner;
  project.studioRevenueShare = Math.min(offer.revenueShareToStudio, project.studioRevenueShare);
  if (!project.releaseWeek) {
    project.releaseWeek = manager.currentWeek + 4;
  }
  project.marketingBudget += offer.pAndACommitment;
  project.hypeScore = clamp(project.hypeScore + 6, 0, 100);
  manager.adjustCash(offer.minimumGuarantee);
  manager.distributionOffers = manager.distributionOffers.filter((item: any) => item.projectId !== projectId);
  return { success: true, message: `Accepted ${offer.partner} offer.` };
}

export function counterDistributionOfferForManager(
  manager: any,
  projectId: string,
  offerId: string
): { success: boolean; message: string } {
  const offer = manager.distributionOffers.find((item: any) => item.id === offerId && item.projectId === projectId);
  if (!offer) return { success: false, message: 'Offer not found.' };
  const attempts = offer.counterAttempts ?? 0;
  if (attempts >= 1) {
    return { success: false, message: `${offer.partner} will not entertain another counter.` };
  }
  offer.counterAttempts = attempts + 1;
  const successChance = clamp(0.53 + manager.reputation.distributor / 220, 0.25, 0.9);
  if (manager.negotiationRng() > successChance) {
    return { success: false, message: `${offer.partner} declined the counter.` };
  }

  offer.minimumGuarantee *= 1.1;
  offer.revenueShareToStudio = clamp(offer.revenueShareToStudio + 0.025, 0.45, 0.7);
  return { success: true, message: `${offer.partner} improved terms after counter.` };
}

export function walkAwayDistributionForManager(manager: any, projectId: string): { success: boolean; message: string } {
  const project = manager.activeProjects.find((item: any) => item.id === projectId);
  if (!project || project.phase !== 'distribution') {
    return { success: false, message: 'Project is not in distribution phase.' };
  }
  const removed = manager.distributionOffers.filter((item: any) => item.projectId === projectId).length;
  manager.distributionOffers = manager.distributionOffers.filter((item: any) => item.projectId !== projectId);
  manager.adjustReputation(-2, 'distributor');
  return {
    success: true,
    message: `Walked away from ${removed} offer(s). Distributor rep -2. Fresh offers can regenerate next End Turn if no window is selected.`,
  };
}

export function estimateReleaseRunWeeksForManager(_manager: any, project: MovieProject): number {
  const quality = ((project.criticalScore ?? 50) + (project.audienceScore ?? 50)) / 2;
  if (quality >= 85) return 8;
  if (quality >= 70) return 6;
  if (quality >= 55) return 5;
  return 4;
}

export function tickDistributionWindowsForManager(manager: any, events: string[]): void {
  for (const project of manager.activeProjects) {
    if (project.phase !== 'distribution') continue;
    if (project.releaseWindow) continue;
    if (manager.getOffersForProject(project.id).length === 0) {
      generateDistributionOffersForManager(manager, project.id);
      events.push(`New distribution offers received for ${project.title}.`);
    }
  }
}

export function generateDistributionOffersForManager(manager: any, projectId: string): void {
  const project = manager.activeProjects.find((item: any) => item.id === projectId);
  if (!project) return;
  manager.distributionOffers = manager.distributionOffers.filter((item: any) => item.projectId !== projectId);

  const modifiers = manager.getArcOutcomeModifiers();
  const base = project.budget.ceiling * 0.2;
  const hypeFactor = 1 + project.hypeScore / 200;
  const mgMultiplier = 1 + modifiers.distributionLeverage;
  const shareLift = modifiers.distributionLeverage * 0.22;
  const offers: DistributionOffer[] = [
    {
      id: createId('deal'),
      projectId,
      partner: 'Aster Peak Pictures',
      releaseWindow: 'wideTheatrical',
      minimumGuarantee: base * 1.2 * hypeFactor * mgMultiplier,
      pAndACommitment: project.budget.ceiling * 0.12,
      revenueShareToStudio: clamp(0.54 + shareLift, 0.45, 0.7),
      projectedOpeningOverride: 1.15,
      counterAttempts: 0,
    },
    {
      id: createId('deal'),
      projectId,
      partner: 'Silverline Distribution',
      releaseWindow: 'limitedTheatrical',
      minimumGuarantee: base * 1.08 * mgMultiplier,
      pAndACommitment: project.budget.ceiling * 0.08,
      revenueShareToStudio: clamp(0.61 + shareLift, 0.45, 0.7),
      projectedOpeningOverride: 0.94,
      counterAttempts: 0,
    },
    {
      id: createId('deal'),
      projectId,
      partner: 'Constellation Media',
      releaseWindow: 'wideTheatrical',
      minimumGuarantee: base * 1.32 * mgMultiplier,
      pAndACommitment: project.budget.ceiling * 0.1,
      revenueShareToStudio: clamp(0.58 + shareLift, 0.45, 0.7),
      projectedOpeningOverride: 1.03,
      counterAttempts: 0,
    },
  ];
  manager.distributionOffers.push(...offers);
}
