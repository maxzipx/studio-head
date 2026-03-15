import { describe, expect, it, beforeEach } from 'vitest';

import { StudioManager } from '../studio-manager';
import type { MovieProject } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createCleanManager(): StudioManager {
  return new StudioManager({
    talentSeed: 42,
    startWithSeedProjects: false,
    includeOpeningDecisions: false,
    crisisRng: () => 0.95,
    eventRng: () => 0.5,
    rivalRng: () => 0.5,
    negotiationRng: () => 0.5,
  });
}

/** Complete founding setup so the manager is in a usable state, then acquire a script. */
function setupManagerWithProject(manager: StudioManager): MovieProject {
  manager.operationsService.completeFoundingSetup({
    specialization: 'balanced',
    foundingProfile: 'none',
  });
  const scriptId = manager.scriptMarket[0]?.id;
  if (!scriptId) throw new Error('No scripts in market');
  const result = manager.acquireScript(scriptId);
  if (!result.success || !result.projectId) throw new Error(`acquireScript failed: ${result.message}`);
  const project = manager.activeProjects.find((p) => p.id === result.projectId);
  if (!project) throw new Error('Project not found after acquisition');
  return project;
}

/** Create a project with release data filled in, suitable for buildReleaseReport. */
function makeReleasedProject(manager: StudioManager): MovieProject {
  const project = setupManagerWithProject(manager);
  project.phase = 'released';
  project.releaseWeek = manager.currentWeek - 4;
  project.openingWeekendGross = 25_000_000;
  project.finalBoxOffice = 80_000_000;
  project.criticalScore = 72;
  project.audienceScore = 68;
  project.studioRevenueShare = 0.5;
  project.weeklyGrossHistory = [25_000_000, 12_000_000, 6_000_000];
  project.releaseWeeksRemaining = 0;
  project.releaseResolved = true;
  return project;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ReleaseService', () => {
  let manager: StudioManager;

  beforeEach(() => {
    manager = createCleanManager();
  });

  // --- buildProjection ---

  describe('buildProjection', () => {
    it('returns numeric projection with critical, openingLow, openingHigh, and roi', () => {
      const project = setupManagerWithProject(manager);
      const projection = manager.releaseService.buildProjection(project, manager.currentWeek + 6);

      expect(projection.critical).toBeTypeOf('number');
      expect(projection.openingLow).toBeTypeOf('number');
      expect(projection.openingHigh).toBeTypeOf('number');
      expect(projection.roi).toBeTypeOf('number');
    });

    it('produces openingHigh >= openingLow', () => {
      const project = setupManagerWithProject(manager);
      const projection = manager.releaseService.buildProjection(project, manager.currentWeek + 6);

      expect(projection.openingHigh).toBeGreaterThanOrEqual(projection.openingLow);
    });

    it('clamps critical score between 0 and 100', () => {
      const project = setupManagerWithProject(manager);
      const projection = manager.releaseService.buildProjection(project, manager.currentWeek + 6);

      expect(projection.critical).toBeGreaterThanOrEqual(0);
      expect(projection.critical).toBeLessThanOrEqual(100);
    });

    it('clamps roi between 0.4 and 4.5', () => {
      const project = setupManagerWithProject(manager);
      const projection = manager.releaseService.buildProjection(project, manager.currentWeek + 6);

      expect(projection.roi).toBeGreaterThanOrEqual(0.4);
      expect(projection.roi).toBeLessThanOrEqual(4.5);
    });
  });

  // --- buildReleaseReport ---

  describe('buildReleaseReport', () => {
    it('calculates totalBudget as ceiling + marketingBudget', () => {
      const project = makeReleasedProject(manager);
      const report = manager.releaseService.buildReleaseReport(project);

      const expected = Math.round(project.budget.ceiling + project.marketingBudget);
      expect(report.totalBudget).toBe(expected);
    });

    it('calculates totalGross from finalBoxOffice', () => {
      const project = makeReleasedProject(manager);
      const report = manager.releaseService.buildReleaseReport(project);

      expect(report.totalGross).toBe(Math.round(project.finalBoxOffice ?? 0));
    });

    it('calculates studioNet as totalGross * studioRevenueShare', () => {
      const project = makeReleasedProject(manager);
      const report = manager.releaseService.buildReleaseReport(project);

      const expectedNet = Math.round((project.finalBoxOffice ?? 0) * project.studioRevenueShare);
      expect(report.studioNet).toBe(expectedNet);
    });

    it('calculates profit as studioNet - totalBudget', () => {
      const project = makeReleasedProject(manager);
      const report = manager.releaseService.buildReleaseReport(project);

      expect(report.profit).toBe(report.studioNet - report.totalBudget);
    });

    it('calculates roi as studioNet / totalBudget', () => {
      const project = makeReleasedProject(manager);
      const report = manager.releaseService.buildReleaseReport(project);

      const expectedRoi = report.studioNet / Math.max(1, report.totalBudget);
      expect(report.roi).toBeCloseTo(expectedRoi, 6);
    });

    it('includes a breakdown object with expected keys', () => {
      const project = makeReleasedProject(manager);
      const report = manager.releaseService.buildReleaseReport(project);

      expect(report.breakdown).toBeDefined();
      expect(report.breakdown).toHaveProperty('script');
      expect(report.breakdown).toHaveProperty('direction');
      expect(report.breakdown).toHaveProperty('starPower');
      expect(report.breakdown).toHaveProperty('marketing');
      expect(report.breakdown).toHaveProperty('timing');
      expect(report.breakdown).toHaveProperty('genreCycle');
    });
  });

  // --- calendarPressureMultiplier ---

  describe('calendarPressureMultiplier', () => {
    it('returns 1 when no rival releases are nearby', () => {
      // Clear all rival upcoming releases
      for (const rival of manager.rivals) {
        rival.upcomingReleases = [];
      }
      const multiplier = manager.releaseService.calendarPressureMultiplier(manager.currentWeek + 10, 'action');

      expect(multiplier).toBe(1);
    });

    it('returns less than 1 when a rival has a release at the same week', () => {
      // Set a rival release at the target week
      const targetWeek = manager.currentWeek + 10;
      manager.rivals[0].upcomingReleases = [
        {
          title: 'Rival Blockbuster',
          genre: 'action',
          releaseWeek: targetWeek,
          estimatedBudget: 150_000_000,
        },
      ];

      const multiplier = manager.releaseService.calendarPressureMultiplier(targetWeek, 'action');

      expect(multiplier).toBeLessThan(1);
    });

    it('never returns below 0.45', () => {
      const targetWeek = manager.currentWeek + 10;
      // Flood the week with many big-budget rival releases
      for (const rival of manager.rivals) {
        rival.upcomingReleases = [
          { title: 'BigFilm', genre: 'action', releaseWeek: targetWeek, estimatedBudget: 200_000_000 },
          { title: 'BigFilm2', genre: 'action', releaseWeek: targetWeek, estimatedBudget: 200_000_000 },
        ];
      }

      const multiplier = manager.releaseService.calendarPressureMultiplier(targetWeek, 'action');

      expect(multiplier).toBeGreaterThanOrEqual(0.45);
    });
  });

  // --- applyWeeklyBurn ---

  describe('applyWeeklyBurn', () => {
    it('reduces cash and increases actualSpend on active (non-released) projects', () => {
      const project = setupManagerWithProject(manager);
      const initialCash = manager.cash;
      const initialSpend = project.budget.actualSpend;

      const burned = manager.releaseService.applyWeeklyBurn();

      expect(burned).toBeGreaterThan(0);
      expect(manager.cash).toBeLessThan(initialCash);
      expect(project.budget.actualSpend).toBeGreaterThan(initialSpend);
    });

    it('decrements scheduledWeeksRemaining', () => {
      const project = setupManagerWithProject(manager);
      const initialWeeks = project.scheduledWeeksRemaining;

      manager.releaseService.applyWeeklyBurn();

      expect(project.scheduledWeeksRemaining).toBe(Math.max(0, initialWeeks - 1));
    });

    it('does not burn released projects', () => {
      const project = makeReleasedProject(manager);
      const initialSpend = project.budget.actualSpend;

      manager.releaseService.applyWeeklyBurn();

      expect(project.budget.actualSpend).toBe(initialSpend);
    });
  });

  // --- applyHypeDecay ---

  describe('applyHypeDecay', () => {
    it('reduces hype on active projects', () => {
      const project = setupManagerWithProject(manager);
      project.hypeScore = 50;

      manager.releaseService.applyHypeDecay();

      expect(project.hypeScore).toBeLessThan(50);
    });

    it('does not reduce hype below 0', () => {
      const project = setupManagerWithProject(manager);
      project.hypeScore = 0;

      manager.releaseService.applyHypeDecay();

      expect(project.hypeScore).toBe(0);
    });
  });

  // --- getActiveMilestones ---

  describe('getActiveMilestones', () => {
    it('returns milestones sorted by unlockedWeek descending', () => {
      manager.milestones = [
        { id: 'firstHit', title: 'First Hit', description: 'desc', unlockedWeek: 5 },
        { id: 'firstBlockbuster', title: 'First Blockbuster', description: 'desc', unlockedWeek: 20 },
        { id: 'boxOffice100m', title: '100M Club', description: 'desc', unlockedWeek: 12 },
      ];

      const milestones = manager.releaseService.getActiveMilestones();

      expect(milestones).toHaveLength(3);
      expect(milestones[0].unlockedWeek).toBe(20);
      expect(milestones[1].unlockedWeek).toBe(12);
      expect(milestones[2].unlockedWeek).toBe(5);
    });

    it('returns empty array when no milestones exist', () => {
      manager.milestones = [];
      const milestones = manager.releaseService.getActiveMilestones();
      expect(milestones).toEqual([]);
    });
  });

  // --- getLatestReleaseReport ---

  describe('getLatestReleaseReport', () => {
    it('returns report matching the projectId', () => {
      const project = makeReleasedProject(manager);
      const report = manager.releaseService.buildReleaseReport(project);
      manager.releaseReports.unshift(report);

      const found = manager.releaseService.getLatestReleaseReport(project.id);

      expect(found).not.toBeNull();
      expect(found!.projectId).toBe(project.id);
      expect(found!.title).toBe(project.title);
    });

    it('returns null when no report exists for the given projectId', () => {
      const result = manager.releaseService.getLatestReleaseReport('nonexistent-id');
      expect(result).toBeNull();
    });
  });
});
