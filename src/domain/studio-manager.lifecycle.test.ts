import { describe, expect, it } from 'vitest';

import { StudioManager } from './studio-manager';
import {
  advanceProjectPhaseForManager,
  setProjectReleaseWeekForManager,
  confirmProjectReleaseWeekForManager,
  generateDistributionOffersForManager,
  acceptDistributionOfferForManager,
  walkAwayDistributionForManager,
} from './studio-manager.lifecycle';

function createManager(): StudioManager {
  const manager = new StudioManager({ talentSeed: 42, startWithSeedProjects: false, includeOpeningDecisions: false });
  manager.operationsService.completeFoundingSetup({ specialization: 'balanced', foundingProfile: 'none' });
  return manager;
}

function acquireFirstScript(manager: StudioManager) {
  if (manager.scriptMarket.length === 0) {
    manager.eventService.refillScriptMarket([]);
  }
  const script = manager.scriptMarket[0];
  manager.acquireScript(script.id);
  return manager.activeProjects[0];
}

function forceToDistribution(manager: StudioManager, projectId: string) {
  const project = manager.activeProjects.find((p) => p.id === projectId)!;
  project.phase = 'distribution';
  project.releaseWeek = manager.currentWeek + 4;
  project.releaseWeekLocked = false;
  project.releaseWindow = null;
  project.scheduledWeeksRemaining = 0;
  project.marketingBudget = 5_000_000;
  return project;
}

describe('studio-manager.lifecycle', () => {
  // ── Phase Advancement ───────────────────────────────────────────

  it('advanceProjectPhaseForManager fails without a director attached', () => {
    const manager = createManager();
    const project = acquireFirstScript(manager);

    const result = advanceProjectPhaseForManager(manager, project.id);

    expect(result.success).toBe(false);
    expect(result.message).toContain('director');
  });

  it('advanceProjectPhaseForManager fails without cast requirements met', () => {
    const manager = createManager();
    const project = acquireFirstScript(manager);
    // Attach a director directly
    const director = manager.talentPool.find((t) => t.role === 'director');
    if (director) {
      project.directorId = director.id;
      director.attachedProjectId = project.id;
      director.availability = 'attached';
    }
    // Ensure cast requirements are not met
    project.castRequirements = { actorCount: 2, actressCount: 2 };
    project.castIds = [];
    project.greenlightApproved = true;

    const result = advanceProjectPhaseForManager(manager, project.id);

    expect(result.success).toBe(false);
    expect(result.message.toLowerCase()).toContain('cast');
  });

  it('advanceProjectPhaseForManager moves project from development to preProduction when ready', () => {
    const manager = createManager();
    const project = acquireFirstScript(manager);
    // Attach director
    const director = manager.talentPool.find((t) => t.role === 'director');
    if (director) manager.negotiateAndAttachTalent(project.id, director.id);
    // Satisfy cast requirements
    project.castRequirements = { actorCount: 0, actressCount: 0 };
    project.scriptQuality = 7;
    project.greenlightApproved = true;

    const result = advanceProjectPhaseForManager(manager, project.id);

    expect(result.success).toBe(true);
    expect(project.phase).toBe('preProduction');
  });

  it('advanceProjectPhaseForManager fails for non-existent project', () => {
    const manager = createManager();

    const result = advanceProjectPhaseForManager(manager, 'bogus-id');

    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('advanceProjectPhaseForManager moves preProduction to production when weeks are done', () => {
    const manager = createManager();
    const project = acquireFirstScript(manager);
    project.phase = 'preProduction';
    project.scheduledWeeksRemaining = 0;

    const result = advanceProjectPhaseForManager(manager, project.id);

    expect(result.success).toBe(true);
    expect(project.phase).toBe('production');
    expect(project.scheduledWeeksRemaining).toBe(14);
  });

  it('advanceProjectPhaseForManager blocks preProduction advance when weeks remain', () => {
    const manager = createManager();
    const project = acquireFirstScript(manager);
    project.phase = 'preProduction';
    project.scheduledWeeksRemaining = 3;

    const result = advanceProjectPhaseForManager(manager, project.id);

    expect(result.success).toBe(false);
    expect(result.message).toContain('pre-production');
  });

  // ── Release Week ────────────────────────────────────────────────

  it('setProjectReleaseWeekForManager sets release week on a distribution project', () => {
    const manager = createManager();
    const project = acquireFirstScript(manager);
    forceToDistribution(manager, project.id);

    const result = setProjectReleaseWeekForManager(manager, project.id, manager.currentWeek + 10);

    expect(result.success).toBe(true);
    expect(project.releaseWeek).toBe(manager.currentWeek + 10);
    expect(project.releaseWeekLocked).toBe(true);
  });

  it('setProjectReleaseWeekForManager fails for non-distribution project', () => {
    const manager = createManager();
    const project = acquireFirstScript(manager);
    // project is in development phase

    const result = setProjectReleaseWeekForManager(manager, project.id, manager.currentWeek + 10);

    expect(result.success).toBe(false);
    expect(result.message).toContain('not in distribution');
  });

  it('confirmProjectReleaseWeekForManager locks the release week', () => {
    const manager = createManager();
    const project = acquireFirstScript(manager);
    forceToDistribution(manager, project.id);
    project.releaseWeek = manager.currentWeek + 8;
    project.releaseWeekLocked = false;

    const result = confirmProjectReleaseWeekForManager(manager, project.id);

    expect(result.success).toBe(true);
    expect(project.releaseWeekLocked).toBe(true);
  });

  // ── Distribution Offers ─────────────────────────────────────────

  it('generateDistributionOffersForManager creates offers for a project', () => {
    const manager = createManager();
    const project = acquireFirstScript(manager);
    forceToDistribution(manager, project.id);

    generateDistributionOffersForManager(manager, project.id);

    const offers = manager.getOffersForProject(project.id);
    expect(offers.length).toBeGreaterThan(0);
    for (const offer of offers) {
      expect(offer.projectId).toBe(project.id);
      expect(offer.partner).toBeTruthy();
      expect(offer.minimumGuarantee).toBeGreaterThan(0);
    }
  });

  it('acceptDistributionOfferForManager applies offer terms to project', () => {
    const manager = createManager();
    const project = acquireFirstScript(manager);
    forceToDistribution(manager, project.id);
    generateDistributionOffersForManager(manager, project.id);
    const offers = manager.getOffersForProject(project.id);
    const theatricalOffer = offers.find(
      (o) => o.releaseWindow === 'wideTheatrical' || o.releaseWindow === 'limitedTheatrical'
    )!;
    expect(theatricalOffer).toBeTruthy();
    const cashBefore = manager.cash;

    const result = acceptDistributionOfferForManager(manager, project.id, theatricalOffer.id);

    expect(result.success).toBe(true);
    expect(project.releaseWindow).toBe(theatricalOffer.releaseWindow);
    expect(project.distributionPartner).toBe(theatricalOffer.partner);
    expect(manager.cash).toBeGreaterThan(cashBefore);
    // Offers for this project should be cleared
    expect(manager.getOffersForProject(project.id).length).toBe(0);
  });

  it('walkAwayDistributionForManager clears offers and penalizes distributor rep', () => {
    const manager = createManager();
    const project = acquireFirstScript(manager);
    forceToDistribution(manager, project.id);
    generateDistributionOffersForManager(manager, project.id);
    const repBefore = manager.reputation.distributor;

    const result = walkAwayDistributionForManager(manager, project.id);

    expect(result.success).toBe(true);
    expect(manager.getOffersForProject(project.id).length).toBe(0);
    expect(manager.reputation.distributor).toBeLessThan(repBefore);
  });
});
