import { describe, expect, it, beforeEach } from 'vitest';
import { StudioManager } from '../studio-manager';
import type { MovieProject, Talent } from '../types';

function createManager(): StudioManager {
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

function acquireFirstProject(manager: StudioManager): MovieProject {
  const script = manager.scriptMarket[0];
  manager.acquireScript(script.id);
  return manager.activeProjects[0];
}

function findAvailableTalent(manager: StudioManager, role: Talent['role']): Talent | undefined {
  return manager.talentPool.find(
    (t) => t.role === role && t.availability === 'available'
  );
}

describe('TalentService', () => {
  let manager: StudioManager;

  beforeEach(() => {
    manager = createManager();
  });

  // --- Trust & Memory ---

  describe('Trust & Memory', () => {
    it('getTalentMemory returns relationship memory with trust, loyalty, and interactionHistory', () => {
      const talent = manager.talentPool[0];
      const memory = manager.talentService.getTalentMemory(talent);

      expect(memory).toBeDefined();
      expect(typeof memory.trust).toBe('number');
      expect(typeof memory.loyalty).toBe('number');
      expect(Array.isArray(memory.interactionHistory)).toBe(true);
      expect(memory.trust).toBeGreaterThanOrEqual(0);
      expect(memory.trust).toBeLessThanOrEqual(100);
    });

    it('recordTalentInteraction updates trust and loyalty and adds to history', () => {
      const talent = manager.talentPool[0];
      const memoryBefore = manager.talentService.getTalentMemory(talent);
      const trustBefore = memoryBefore.trust;
      const loyaltyBefore = memoryBefore.loyalty;
      const historyLenBefore = memoryBefore.interactionHistory.length;

      manager.talentService.recordTalentInteraction(talent, {
        kind: 'dealSigned',
        trustDelta: 5,
        loyaltyDelta: 6,
        note: 'Test interaction',
      });

      const memoryAfter = manager.talentService.getTalentMemory(talent);
      expect(memoryAfter.trust).toBe(Math.min(100, trustBefore + 5));
      expect(memoryAfter.loyalty).toBe(Math.min(100, loyaltyBefore + 6));
      expect(memoryAfter.interactionHistory.length).toBe(historyLenBefore + 1);
      expect(memoryAfter.interactionHistory.at(-1)!.kind).toBe('dealSigned');
      expect(memoryAfter.interactionHistory.at(-1)!.note).toBe('Test interaction');
    });

    it('getTalentTrustLevel returns appropriate level based on trust score', () => {
      const talent = manager.talentPool[0];
      const memory = manager.talentService.getTalentMemory(talent);

      // Force trust to specific values and check levels
      memory.trust = 10;
      expect(manager.talentService.getTalentTrustLevel(talent)).toBe('hostile');

      memory.trust = 35;
      expect(manager.talentService.getTalentTrustLevel(talent)).toBe('wary');

      memory.trust = 55;
      expect(manager.talentService.getTalentTrustLevel(talent)).toBe('neutral');

      memory.trust = 75;
      expect(manager.talentService.getTalentTrustLevel(talent)).toBe('aligned');

      memory.trust = 90;
      expect(manager.talentService.getTalentTrustLevel(talent)).toBe('loyal');
    });
  });

  // --- Cast Requirements ---

  describe('Cast Requirements', () => {
    it('castCountsForProject correctly counts actors/actresses by role', () => {
      const project = acquireFirstProject(manager);
      // Initially no cast attached
      const counts = manager.talentService.castCountsForProject(project);
      expect(counts.actorCount).toBe(0);
      expect(counts.actressCount).toBe(0);
      expect(counts.total).toBe(0);

      // Manually attach a lead actor
      const actor = findAvailableTalent(manager, 'leadActor');
      if (actor) {
        project.castIds.push(actor.id);
        const updated = manager.talentService.castCountsForProject(project);
        expect(updated.actorCount).toBe(1);
        expect(updated.total).toBe(1);
      }
    });

    it('meetsCastRequirements returns true when requirements met, false otherwise', () => {
      const project = acquireFirstProject(manager);
      // With empty cast, should not meet requirements (requirements > 0)
      const reqTotal =
        project.castRequirements.actorCount + project.castRequirements.actressCount;

      if (reqTotal > 0) {
        expect(manager.talentService.meetsCastRequirements(project)).toBe(false);
      }

      // Manually fill cast to meet requirements
      const actors = manager.talentPool.filter(
        (t) => t.role === 'leadActor' && t.availability === 'available'
      );
      const actresses = manager.talentPool.filter(
        (t) => t.role === 'leadActress' && t.availability === 'available'
      );
      for (let i = 0; i < project.castRequirements.actorCount && i < actors.length; i++) {
        project.castIds.push(actors[i].id);
      }
      for (let i = 0; i < project.castRequirements.actressCount && i < actresses.length; i++) {
        project.castIds.push(actresses[i].id);
      }

      expect(manager.talentService.meetsCastRequirements(project)).toBe(true);
    });

    it('getProjectCastStatus returns counts with requiredTotal', () => {
      const project = acquireFirstProject(manager);
      const status = manager.talentService.getProjectCastStatus(project.id);

      expect(status).not.toBeNull();
      expect(status!.requiredTotal).toBe(
        project.castRequirements.actorCount + project.castRequirements.actressCount
      );
      expect(typeof status!.actorCount).toBe('number');
      expect(typeof status!.actressCount).toBe('number');
      expect(typeof status!.total).toBe('number');
    });
  });

  // --- Talent Availability ---

  describe('Talent Availability', () => {
    it('getAvailableTalentForRole filters by role and availability', () => {
      // First populate the market so marketWindowExpiresWeek is set
      manager.talentService.refreshTalentMarket();

      const directors = manager.talentService.getAvailableTalentForRole('director');
      for (const t of directors) {
        expect(t.role).toBe('director');
        expect(t.availability).toBe('available');
        expect(t.marketWindowExpiresWeek).not.toBeNull();
      }
      expect(directors.length).toBeGreaterThan(0);
    });

    it('refreshTalentMarket populates talent market on first call', () => {
      // Create a fresh manager without founding setup to check marketInitialized
      const fresh = new StudioManager({
        talentSeed: 42,
        startWithSeedProjects: false,
        includeOpeningDecisions: false,
      });
      // Clear any pre-initialized market windows
      for (const t of fresh.talentPool) {
        t.marketWindowExpiresWeek = null;
      }
      fresh.marketInitialized = false;

      const beforeCount = fresh.talentPool.filter(
        (t) => t.marketWindowExpiresWeek !== null
      ).length;
      expect(beforeCount).toBe(0);

      fresh.talentService.refreshTalentMarket();

      expect(fresh.marketInitialized).toBe(true);
      const afterCount = fresh.talentPool.filter(
        (t) => t.marketWindowExpiresWeek !== null
      ).length;
      expect(afterCount).toBeGreaterThan(0);
    });

    it('dismissTalentNegotiation removes negotiation and resets talent availability', () => {
      manager.talentService.refreshTalentMarket();
      const project = acquireFirstProject(manager);
      const talent = manager.talentService.getAvailableTalentForRole('director')[0];
      expect(talent).toBeDefined();

      // Start a negotiation
      const result = manager.talentService.startTalentNegotiation(project.id, talent.id);
      expect(result.success).toBe(true);
      expect(talent.availability).toBe('inNegotiation');
      expect(
        manager.playerNegotiations.some(
          (n) => n.talentId === talent.id && n.projectId === project.id
        )
      ).toBe(true);

      // Dismiss it
      manager.talentService.dismissTalentNegotiation(project.id, talent.id);

      expect(
        manager.playerNegotiations.some(
          (n) => n.talentId === talent.id && n.projectId === project.id
        )
      ).toBe(false);
      expect(talent.availability).toBe('available');
    });
  });

  // --- Release Talent ---

  describe('Release Talent', () => {
    it('releaseTalent frees talent from project and records interaction', () => {
      manager.talentService.refreshTalentMarket();
      const project = acquireFirstProject(manager);
      const talent = findAvailableTalent(manager, 'leadActor')!;
      expect(talent).toBeDefined();

      // Manually attach talent
      talent.attachedProjectId = project.id;
      talent.availability = 'attached';
      project.castIds.push(talent.id);

      const historyBefore = manager.talentService.getTalentMemory(talent).interactionHistory.length;

      manager.talentService.releaseTalent(project.id, 'released');

      expect(talent.attachedProjectId).toBeNull();
      expect(talent.availability).toBe('available');
      const historyAfter = manager.talentService.getTalentMemory(talent).interactionHistory.length;
      expect(historyAfter).toBe(historyBefore + 1);

      const lastEntry = talent.relationshipMemory.interactionHistory.at(-1)!;
      expect(lastEntry.kind).toBe('projectReleased');
      expect(lastEntry.trustDelta).toBe(2);
    });

    it('releaseTalent with abandoned context records negative interaction', () => {
      const project = acquireFirstProject(manager);
      const talent = findAvailableTalent(manager, 'leadActor')!;
      expect(talent).toBeDefined();

      talent.attachedProjectId = project.id;
      talent.availability = 'attached';
      project.castIds.push(talent.id);

      const trustBefore = manager.talentService.getTalentMemory(talent).trust;

      manager.talentService.releaseTalent(project.id, 'abandoned');

      expect(talent.attachedProjectId).toBeNull();
      expect(talent.availability).toBe('available');

      const lastEntry = talent.relationshipMemory.interactionHistory.at(-1)!;
      expect(lastEntry.kind).toBe('projectAbandoned');
      expect(lastEntry.trustDelta).toBe(-9);
      expect(lastEntry.loyaltyDelta).toBe(-11);
      expect(talent.relationshipMemory.trust).toBeLessThan(trustBefore);
    });
  });

  // --- Budget Planning ---

  describe('Budget Planning', () => {
    it('buildProjectBudgetPlan returns reasonable budget allocations', () => {
      manager.talentService.refreshTalentMarket();

      const plan = manager.talentService.buildProjectBudgetPlan(
        'action',
        50_000_000,
        { actorCount: 2, actressCount: 1 }
      );

      expect(typeof plan.directorPlanned).toBe('number');
      expect(typeof plan.castPlannedTotal).toBe('number');
      expect(typeof plan.castPlannedActor).toBe('number');
      expect(typeof plan.castPlannedActress).toBe('number');
      expect(plan.directorPlanned).toBeGreaterThan(0);
      // Director planned should be between 6% and 26% of ceiling
      expect(plan.directorPlanned).toBeGreaterThanOrEqual(50_000_000 * 0.06);
      expect(plan.directorPlanned).toBeLessThanOrEqual(50_000_000 * 0.26);
    });

    it('talentCompensationValue returns base + perks cost', () => {
      const talent = manager.talentPool[0];
      const value = manager.talentService.talentCompensationValue(talent);
      expect(value).toBe(talent.salary.base + talent.salary.perksCost);
    });
  });

  // --- Negotiation Basics ---

  describe('Negotiation Basics', () => {
    it('startTalentNegotiation creates a negotiation entry', () => {
      manager.talentService.refreshTalentMarket();
      const project = acquireFirstProject(manager);
      const talent = manager.talentService.getAvailableTalentForRole('director')[0];
      expect(talent).toBeDefined();

      const negsBefore = manager.playerNegotiations.length;
      const result = manager.talentService.startTalentNegotiation(project.id, talent.id);

      expect(result.success).toBe(true);
      expect(manager.playerNegotiations.length).toBe(negsBefore + 1);

      const neg = manager.playerNegotiations.find(
        (n) => n.talentId === talent.id && n.projectId === project.id
      );
      expect(neg).toBeDefined();
      expect(neg!.rounds).toBe(0);
      expect(neg!.openedWeek).toBe(manager.currentWeek);
      expect(talent.availability).toBe('inNegotiation');
    });

    it('canOpenTalentNegotiation returns ok:true for available talent', () => {
      const talent = findAvailableTalent(manager, 'director')!;
      expect(talent).toBeDefined();

      const result = manager.talentService.canOpenTalentNegotiation(talent);
      expect(result.ok).toBe(true);
      expect(result.lockoutWeeks).toBe(0);
      expect(result.reason).toBeNull();
    });
  });
});
