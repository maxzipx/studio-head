import { describe, expect, it } from 'vitest';

import {
  getSequelEligibilityForManager,
  getFranchiseProjectionModifiersForManager,
  startSequelForManager,
  setFranchiseStrategyForManager,
  runFranchiseBrandResetForManager,
  runFranchiseLegacyCastingCampaignForManager,
  runFranchiseHiatusPlanningForManager,
  markFranchiseReleaseForManager,
} from './studio-manager.franchise';
import { StudioManager } from './studio-manager';
import type { MovieProject } from './types';

function createTestManager(): StudioManager {
  const manager = new StudioManager({
    talentSeed: 42,
    startWithSeedProjects: false,
    includeOpeningDecisions: false,
  });
  manager.operationsService.completeFoundingSetup({
    specialization: 'balanced',
    foundingProfile: 'none',
  });
  return manager;
}

/** Acquire the first script and prepare the resulting project as a released hit. */
function setupReleasedProject(manager: StudioManager): MovieProject {
  const script = manager.scriptMarket[0];
  manager.acquireScript(script.id);
  const project = manager.activeProjects[0];
  project.phase = 'released';
  project.releaseResolved = true;
  project.releaseWeek = manager.currentWeek - 2;
  project.finalBoxOffice = 50_000_000;
  project.criticalScore = 70;
  project.audienceScore = 72;
  project.projectedROI = 1.8;
  return project;
}

describe('Franchise module', () => {
  // ── 1. Sequel eligibility ───────────────────────────────────────────────────
  it('reports a released project as sequel-eligible', () => {
    const manager = createTestManager();
    const project = setupReleasedProject(manager);

    const eligibility = getSequelEligibilityForManager(manager, project.id);

    expect(eligibility).not.toBeNull();
    expect(eligibility!.eligible).toBe(true);
    expect(eligibility!.nextEpisode).toBe(2);
    expect(eligibility!.upfrontCost).toBeGreaterThan(0);
    expect(eligibility!.projectedMomentum).toBeGreaterThan(0);
  });

  it('rejects sequel eligibility for an unreleased project', () => {
    const manager = createTestManager();
    const script = manager.scriptMarket[0];
    manager.acquireScript(script.id);
    const project = manager.activeProjects[0]; // still in development

    const eligibility = getSequelEligibilityForManager(manager, project.id);

    expect(eligibility).not.toBeNull();
    expect(eligibility!.eligible).toBe(false);
    expect(eligibility!.reason).toContain('released');
  });

  // ── 2. Creating a franchise via startSequel ─────────────────────────────────
  it('creates a sequel project and franchise track from a released project', () => {
    const manager = createTestManager();
    const project = setupReleasedProject(manager);
    const cashBefore = manager.cash;

    const result = startSequelForManager(manager, project.id);

    expect(result.success).toBe(true);
    expect(result.projectId).toBeDefined();
    expect(manager.cash).toBeLessThan(cashBefore);

    // Franchise track created
    expect(manager.franchises.length).toBe(1);
    const franchise = manager.franchises[0];
    expect(franchise.name).toBe(project.title);
    expect(franchise.rootProjectId).toBe(project.id);
    expect(franchise.projectIds).toContain(result.projectId);

    // Sequel project properties
    const sequel = manager.activeProjects.find((p) => p.id === result.projectId);
    expect(sequel).toBeDefined();
    expect(sequel!.franchiseId).toBe(franchise.id);
    expect(sequel!.franchiseEpisode).toBe(2);
    expect(sequel!.phase).toBe('development');
    expect(sequel!.genre).toBe(project.genre);
    expect(sequel!.title).toContain('II');
  });

  // ── 3. Momentum and fatigue derivation ──────────────────────────────────────
  it('derives franchise momentum and fatigue from project scores', () => {
    const manager = createTestManager();
    const project = setupReleasedProject(manager);

    startSequelForManager(manager, project.id);
    const franchise = manager.franchises[0];

    // With audienceScore=72, criticalScore=70, ROI=1.8 the momentum should be
    // well above the base 46, and fatigue should be modest.
    expect(franchise.momentum).toBeGreaterThan(40);
    expect(franchise.momentum).toBeLessThanOrEqual(95);
    expect(franchise.fatigue).toBeGreaterThanOrEqual(0);
    expect(franchise.fatigue).toBeLessThanOrEqual(92);
  });

  // ── 4. Projection modifiers ─────────────────────────────────────────────────
  it('returns neutral modifiers for a non-franchise project', () => {
    const manager = createTestManager();
    const script = manager.scriptMarket[0];
    manager.acquireScript(script.id);
    const project = manager.activeProjects[0];

    const mods = getFranchiseProjectionModifiersForManager(manager, project);

    expect(mods.strategy).toBe('none');
    expect(mods.openingMultiplier).toBe(1);
    expect(mods.roiMultiplier).toBe(1);
    expect(mods.criticalDelta).toBe(0);
    expect(mods.audienceDelta).toBe(0);
  });

  it('returns franchise-aware modifiers for a sequel project', () => {
    const manager = createTestManager();
    const project = setupReleasedProject(manager);
    const { projectId } = startSequelForManager(manager, project.id);
    const sequel = manager.activeProjects.find((p) => p.id === projectId)!;

    const mods = getFranchiseProjectionModifiersForManager(manager, sequel, manager.currentWeek + 10);

    expect(mods.strategy).toBe('balanced');
    expect(mods.episode).toBe(2);
    expect(mods.momentum).toBeGreaterThan(0);
    expect(typeof mods.openingMultiplier).toBe('number');
    expect(typeof mods.cadencePressure).toBe('number');
  });

  // ── 5. Franchise strategy ───────────────────────────────────────────────────
  it('sets franchise strategy on a sequel in development', () => {
    const manager = createTestManager();
    const project = setupReleasedProject(manager);
    const { projectId } = startSequelForManager(manager, project.id);
    const sequel = manager.activeProjects.find((p) => p.id === projectId)!;
    const originalityBefore = sequel.originality;

    const result = setFranchiseStrategyForManager(manager, projectId!, 'reinvention');

    expect(result.success).toBe(true);
    expect(sequel.franchiseStrategy).toBe('reinvention');
    // Reinvention boosts originality
    expect(sequel.originality).toBeGreaterThan(originalityBefore);
  });

  it('rejects strategy change if already committed to a non-balanced strategy', () => {
    const manager = createTestManager();
    const project = setupReleasedProject(manager);
    const { projectId } = startSequelForManager(manager, project.id);

    setFranchiseStrategyForManager(manager, projectId!, 'safe');
    const second = setFranchiseStrategyForManager(manager, projectId!, 'reinvention');

    expect(second.success).toBe(false);
    expect(second.message).toContain('locked');
  });

  // ── 6. Brand reset ─────────────────────────────────────────────────────────
  it('executes a brand reset that lowers fatigue at a cost', () => {
    const manager = createTestManager();
    const project = setupReleasedProject(manager);
    const { projectId } = startSequelForManager(manager, project.id);
    const franchise = manager.franchises[0];
    const fatigueBefore = franchise.fatigue;
    const cashBefore = manager.cash;

    const result = runFranchiseBrandResetForManager(manager, projectId!);

    expect(result.success).toBe(true);
    expect(franchise.fatigue).toBeLessThan(fatigueBefore);
    expect(manager.cash).toBeLessThan(cashBefore);
    expect(franchise.brandResetCount).toBe(1);
  });

  // ── 7. Legacy casting campaign ──────────────────────────────────────────────
  it('runs a legacy casting campaign that boosts hype and momentum', () => {
    const manager = createTestManager();
    const project = setupReleasedProject(manager);
    const { projectId } = startSequelForManager(manager, project.id);
    const sequel = manager.activeProjects.find((p) => p.id === projectId)!;
    const franchise = manager.franchises[0];
    const hypeBefore = sequel.hypeScore;
    const momentumBefore = franchise.momentum;

    const result = runFranchiseLegacyCastingCampaignForManager(manager, projectId!);

    expect(result.success).toBe(true);
    expect(sequel.hypeScore).toBeGreaterThan(hypeBefore);
    expect(franchise.momentum).toBeGreaterThanOrEqual(momentumBefore);
    expect(franchise.legacyCastingCampaignCount).toBe(1);
  });

  // ── 8. Hiatus planning ─────────────────────────────────────────────────────
  it('runs hiatus planning that adds cadence buffer', () => {
    const manager = createTestManager();
    const project = setupReleasedProject(manager);
    const { projectId } = startSequelForManager(manager, project.id);
    const franchise = manager.franchises[0];
    const bufferBefore = franchise.cadenceBufferWeeks;

    const result = runFranchiseHiatusPlanningForManager(manager, projectId!);

    expect(result.success).toBe(true);
    expect(franchise.cadenceBufferWeeks).toBeGreaterThan(bufferBefore);
    expect(franchise.hiatusPlanCount).toBe(1);
  });

  // ── 9. markFranchiseRelease ─────────────────────────────────────────────────
  it('updates franchise state when a sequel releases', () => {
    const manager = createTestManager();
    const project = setupReleasedProject(manager);
    const { projectId } = startSequelForManager(manager, project.id);
    const sequel = manager.activeProjects.find((p) => p.id === projectId)!;
    const franchise = manager.franchises[0];

    // Simulate the sequel being released
    sequel.phase = 'released';
    sequel.releaseResolved = true;
    sequel.releaseWeek = manager.currentWeek;
    sequel.audienceScore = 65;
    sequel.criticalScore = 60;
    sequel.controversy = 10;

    markFranchiseReleaseForManager(manager, sequel.id);

    expect(franchise.releasedProjectIds).toContain(sequel.id);
    expect(franchise.activeProjectId).toBeNull();
    expect(franchise.lastReleaseWeek).toBe(manager.currentWeek);
  });

  // ── 10. Second sequel increments episode ────────────────────────────────────
  it('increments episode number for successive sequels', () => {
    const manager = createTestManager();
    const project = setupReleasedProject(manager);
    const first = startSequelForManager(manager, project.id);
    const sequel1 = manager.activeProjects.find((p) => p.id === first.projectId)!;

    // Release the first sequel so a second can be started
    sequel1.phase = 'released';
    sequel1.releaseResolved = true;
    sequel1.releaseWeek = manager.currentWeek - 1;
    sequel1.finalBoxOffice = 40_000_000;
    sequel1.criticalScore = 65;
    sequel1.audienceScore = 68;
    sequel1.projectedROI = 1.5;
    markFranchiseReleaseForManager(manager, sequel1.id);

    const second = startSequelForManager(manager, sequel1.id);

    expect(second.success).toBe(true);
    const sequel2 = manager.activeProjects.find((p) => p.id === second.projectId)!;
    expect(sequel2.franchiseEpisode).toBe(3);
    expect(sequel2.title).toContain('III');
  });

  // ── 11. Insufficient cash prevents sequel ───────────────────────────────────
  it('blocks sequel creation when studio lacks cash', () => {
    const manager = createTestManager();
    const project = setupReleasedProject(manager);
    manager.adjustCash(-manager.cash + 1_000); // leave almost nothing

    const eligibility = getSequelEligibilityForManager(manager, project.id);

    expect(eligibility).not.toBeNull();
    expect(eligibility!.eligible).toBe(false);
    expect(eligibility!.reason).toContain('cash');
  });
});
