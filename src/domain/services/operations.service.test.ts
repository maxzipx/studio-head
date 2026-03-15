import { describe, expect, it } from 'vitest';

import { StudioManager } from '../studio-manager';

function createManager(): StudioManager {
  const manager = new StudioManager({ talentSeed: 42, startWithSeedProjects: false, includeOpeningDecisions: false });
  manager.operationsService.completeFoundingSetup({ specialization: 'balanced', foundingProfile: 'none' });
  return manager;
}

describe('OperationsService', () => {
  // ── Studio Name ──────────────────────────────────────────────────

  it('renames studio with valid name', () => {
    const manager = createManager();
    const result = manager.operationsService.setStudioName('Apex Films');
    expect(result.success).toBe(true);
    expect(manager.studioName).toBe('Apex Films');
  });

  it('rejects studio name shorter than 2 chars', () => {
    const manager = createManager();
    const result = manager.operationsService.setStudioName('A');
    expect(result.success).toBe(false);
  });

  it('truncates studio name at 32 chars', () => {
    const manager = createManager();
    manager.operationsService.setStudioName('A'.repeat(50));
    expect(manager.studioName.length).toBe(32);
  });

  // ── Specialization ──────────────────────────────────────────────

  it('stages a specialization change', () => {
    const manager = createManager();
    const result = manager.operationsService.setStudioSpecialization('blockbuster');
    expect(result.success).toBe(true);
    expect(manager.pendingSpecialization).toBe('blockbuster');
  });

  it('rejects same pending specialization', () => {
    const manager = createManager();
    manager.operationsService.setStudioSpecialization('prestige');
    const result = manager.operationsService.setStudioSpecialization('prestige');
    expect(result.success).toBe(false);
  });

  it('reverts specialization when set back to current', () => {
    const manager = createManager();
    manager.operationsService.setStudioSpecialization('indie');
    const result = manager.operationsService.setStudioSpecialization('balanced');
    expect(result.success).toBe(true);
    expect(result.message).toBeDefined();
    expect(result.message).toContain('reverted');
  });

  // ── Founding Setup ──────────────────────────────────────────────

  it('rejects double founding setup', () => {
    const manager = createManager();
    const result = manager.operationsService.completeFoundingSetup({ specialization: 'indie', foundingProfile: 'none' });
    expect(result.success).toBe(false);
  });

  // ── Marketing Upgrades ──────────────────────────────────────────

  it('upgrades marketing team when affordable', () => {
    const manager = createManager();
    manager.cash = 10_000_000;
    const before = manager.marketingTeamLevel;
    const result = manager.operationsService.upgradeMarketingTeam();
    expect(result.success).toBe(true);
    expect(manager.marketingTeamLevel).toBe(before + 1);
  });

  it('rejects marketing upgrade with insufficient cash', () => {
    const manager = createManager();
    manager.cash = 0;
    const result = manager.operationsService.upgradeMarketingTeam();
    expect(result.success).toBe(false);
  });

  it('returns null upgrade cost when at tier cap', () => {
    const manager = createManager();
    manager.marketingTeamLevel = 5;
    expect(manager.operationsService.getMarketingTeamUpgradeCost()).toBeNull();
  });

  // ── Studio Capacity ─────────────────────────────────────────────

  it('expands studio capacity when affordable', () => {
    const manager = createManager();
    manager.cash = 10_000_000;
    const beforeCap = manager.projectCapacityLimit;
    const result = manager.operationsService.upgradeStudioCapacity();
    expect(result.success).toBe(true);
    expect(manager.projectCapacityLimit).toBeGreaterThan(beforeCap);
  });

  it('returns capacity upgrade cost based on upgrade count', () => {
    const manager = createManager();
    const cost0 = manager.operationsService.getStudioCapacityUpgradeCost();
    expect(cost0).toBeTypeOf('number');
    expect(cost0).toBeGreaterThan(0);
  });

  // ── Animation Division ──────────────────────────────────────────

  it('founds animation division at 8M cost', () => {
    const manager = createManager();
    manager.cash = 10_000_000;
    const result = manager.operationsService.foundAnimationDivision();
    expect(result.success).toBe(true);
    expect(manager.animationDivisionUnlocked).toBe(true);
    expect(manager.cash).toBe(2_000_000);
  });

  it('rejects animation division with insufficient cash', () => {
    const manager = createManager();
    manager.cash = 5_000_000;
    const result = manager.operationsService.foundAnimationDivision();
    expect(result.success).toBe(false);
    expect(manager.animationDivisionUnlocked).toBe(false);
  });

  it('rejects duplicate animation division founding', () => {
    const manager = createManager();
    manager.cash = 20_000_000;
    manager.operationsService.foundAnimationDivision();
    const result = manager.operationsService.foundAnimationDivision();
    expect(result.success).toBe(false);
  });

  // ── Department Investment ───────────────────────────────────────

  it('invests in department and increments level', () => {
    const manager = createManager();
    manager.cash = 5_000_000;
    const result = manager.operationsService.investDepartment('development');
    expect(result.success).toBe(true);
    expect(manager.departmentLevels.development).toBe(1);
  });

  it('rejects department investment at max level', () => {
    const manager = createManager();
    manager.departmentLevels.production = 4;
    const result = manager.operationsService.investDepartment('production');
    expect(result.success).toBe(false);
  });

  it('charges increasing cost per department level', () => {
    const manager = createManager();
    manager.cash = 50_000_000;
    manager.operationsService.investDepartment('distribution');
    const cashAfterFirst = manager.cash;
    manager.operationsService.investDepartment('distribution');
    const firstCost = 50_000_000 - cashAfterFirst;
    const secondCost = cashAfterFirst - manager.cash;
    expect(secondCost).toBeGreaterThan(firstCost);
  });

  // ── Exclusive Partners ──────────────────────────────────────────

  it('signs exclusive distribution partner', () => {
    const manager = createManager();
    manager.cash = 5_000_000;
    const result = manager.operationsService.signExclusiveDistributionPartner('Aster Peak Pictures');
    expect(result.success).toBe(true);
    expect(manager.exclusiveDistributionPartner).toBe('Aster Peak Pictures');
    expect(manager.exclusivePartnerUntilWeek).toBe(manager.currentWeek + 26);
  });

  it('rejects unknown distribution partner', () => {
    const manager = createManager();
    manager.cash = 5_000_000;
    const result = manager.operationsService.signExclusiveDistributionPartner('Fake Partner');
    expect(result.success).toBe(false);
  });

  it('returns active partner when within window', () => {
    const manager = createManager();
    manager.cash = 5_000_000;
    manager.operationsService.signExclusiveDistributionPartner('Silverline Distribution');
    expect(manager.operationsService.getActiveExclusivePartner()).toBe('Silverline Distribution');
  });

  it('clears expired partner', () => {
    const manager = createManager();
    manager.exclusiveDistributionPartner = 'Silverline Distribution';
    manager.exclusivePartnerUntilWeek = manager.currentWeek - 1;
    expect(manager.operationsService.getActiveExclusivePartner()).toBeNull();
  });

  // ── Executive Poach ─────────────────────────────────────────────

  it('poaches executive team and increments level', () => {
    const manager = createManager();
    manager.cash = 5_000_000;
    const result = manager.operationsService.poachExecutiveTeam();
    expect(result.success).toBe(true);
    expect(manager.executiveNetworkLevel).toBe(1);
  });

  it('rejects executive poach at max level', () => {
    const manager = createManager();
    manager.executiveNetworkLevel = 3;
    const result = manager.operationsService.poachExecutiveTeam();
    expect(result.success).toBe(false);
  });

  it('boosts talent reputation on executive poach', () => {
    const manager = createManager();
    manager.cash = 5_000_000;
    const before = manager.reputation.talent;
    manager.operationsService.poachExecutiveTeam();
    expect(manager.reputation.talent).toBeGreaterThan(before);
  });
});
