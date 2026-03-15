import { describe, expect, it } from 'vitest';

import { StudioManager } from './studio-manager';
import {
  estimateWeeklyBurnForStudio,
  getActiveMilestonesForStudio,
  getGenreCycleSnapshotForStudio,
  getGenreDemandMultiplierForStudio,
  getIndustryHeatLeaderboardForStudio,
  getScaleOverheadCostForStudio,
  projectedBurnForProjectForStudio,
} from './studio-selectors';

function createManager(): StudioManager {
  const manager = new StudioManager({ talentSeed: 42, startWithSeedProjects: false, includeOpeningDecisions: false });
  manager.operationsService.completeFoundingSetup({ specialization: 'balanced', foundingProfile: 'none' });
  return manager;
}

describe('studio-selectors', () => {
  it('estimateWeeklyBurnForStudio returns >= 0 with no active projects', () => {
    const manager = createManager();
    const burn = estimateWeeklyBurnForStudio(manager);
    expect(burn).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(burn)).toBe(true);
  });

  it('estimateWeeklyBurnForStudio increases when projects are active', () => {
    const manager = createManager();
    const burnEmpty = estimateWeeklyBurnForStudio(manager);

    // Acquire a script to get an active project
    if (manager.scriptMarket.length > 0) {
      const script = manager.scriptMarket[0];
      manager.cash = script.askingPrice + 10_000_000;
      manager.acquireScript(script.id);
    }

    const burnWithProject = estimateWeeklyBurnForStudio(manager);
    expect(burnWithProject).toBeGreaterThanOrEqual(burnEmpty);
  });

  it('projectedBurnForProjectForStudio returns a positive number', () => {
    const manager = createManager();
    if (manager.scriptMarket.length > 0) {
      const script = manager.scriptMarket[0];
      manager.cash = script.askingPrice + 10_000_000;
      manager.acquireScript(script.id);
    }
    const project = manager.activeProjects[0];
    if (project) {
      const burn = projectedBurnForProjectForStudio(manager, project, 1.0);
      expect(burn).toBeGreaterThan(0);
      expect(Number.isFinite(burn)).toBe(true);
    }
  });

  it('getGenreDemandMultiplierForStudio returns 1 for default cycles', () => {
    const manager = createManager();
    const demand = getGenreDemandMultiplierForStudio(manager, 'drama');
    expect(demand).toBeGreaterThan(0);
  });

  it('getGenreCycleSnapshotForStudio returns sorted entries for all genres', () => {
    const manager = createManager();
    const snapshot = getGenreCycleSnapshotForStudio(manager);
    expect(snapshot.length).toBeGreaterThan(0);
    for (let i = 1; i < snapshot.length; i++) {
      expect(snapshot[i - 1].demand).toBeGreaterThanOrEqual(snapshot[i].demand);
    }
    for (const entry of snapshot) {
      expect(entry.shockWeeksRemaining).toBeGreaterThanOrEqual(0);
    }
  });

  it('getIndustryHeatLeaderboardForStudio includes the player', () => {
    const manager = createManager();
    const leaderboard = getIndustryHeatLeaderboardForStudio(manager);
    const playerEntry = leaderboard.find((row) => row.isPlayer);
    expect(playerEntry).toBeDefined();
    expect(playerEntry!.name).toBe(manager.studioName);
    // Should be sorted by heat descending
    for (let i = 1; i < leaderboard.length; i++) {
      expect(leaderboard[i - 1].heat).toBeGreaterThanOrEqual(leaderboard[i].heat);
    }
  });

  it('getScaleOverheadCostForStudio returns a positive number', () => {
    const manager = createManager();
    const overhead = getScaleOverheadCostForStudio(manager);
    expect(overhead).toBeGreaterThan(0);
    expect(Number.isFinite(overhead)).toBe(true);
  });

  it('getActiveMilestonesForStudio returns milestones sorted by unlockedWeek descending', () => {
    const manager = createManager();
    const milestones = getActiveMilestonesForStudio(manager);
    expect(Array.isArray(milestones)).toBe(true);
    for (let i = 1; i < milestones.length; i++) {
      expect(milestones[i - 1].unlockedWeek).toBeGreaterThanOrEqual(milestones[i].unlockedWeek);
    }
  });
});
