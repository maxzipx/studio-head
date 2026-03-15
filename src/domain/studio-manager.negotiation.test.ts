import { describe, expect, it } from 'vitest';

import { StudioManager } from './studio-manager';
import {
  startTalentNegotiationForManager,
  startTalentNegotiationRoundForManager,
  adjustTalentNegotiationForManager,
  getNegotiationChanceForManager,
  getQuickCloseChanceForManager,
  getNegotiationSnapshotForManager,
  previewTalentNegotiationRoundForManager,
  negotiateAndAttachTalentForManager,
  processPlayerNegotiationsForManager,
} from './studio-manager.negotiation';

function createManager(overrides?: { negotiationRng?: () => number }): StudioManager {
  const manager = new StudioManager({
    talentSeed: 42,
    startWithSeedProjects: false,
    includeOpeningDecisions: false,
    negotiationRng: overrides?.negotiationRng,
  });
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

function findAvailableDirector(manager: StudioManager) {
  return manager.talentPool.find(
    (t) => t.role === 'director' && t.availability === 'available'
  );
}

function findAvailableTalent(manager: StudioManager) {
  return manager.talentPool.find((t) => t.availability === 'available');
}

describe('studio-manager.negotiation', () => {
  // ── startTalentNegotiationForManager ──────────────────────────────

  describe('startTalentNegotiationForManager', () => {
    it('opens a negotiation for an available talent on a development project', () => {
      const manager = createManager();
      const project = acquireFirstScript(manager);
      const talent = findAvailableTalent(manager)!;
      expect(talent).toBeDefined();

      const result = startTalentNegotiationForManager(manager, project.id, talent.id);
      expect(result.success).toBe(true);
      expect(result.message).toContain(talent.name);
      expect(manager.playerNegotiations.length).toBe(1);
      expect(talent.availability).toBe('inNegotiation');
    });

    it('rejects negotiation when talent is unavailable', () => {
      const manager = createManager();
      const project = acquireFirstScript(manager);
      const talent = findAvailableTalent(manager)!;
      talent.availability = 'attached';

      const result = startTalentNegotiationForManager(manager, project.id, talent.id);
      expect(result.success).toBe(false);
      expect(result.message).toContain('unavailable');
    });

    it('rejects negotiation when project is not found', () => {
      const manager = createManager();
      const result = startTalentNegotiationForManager(manager, 'nonexistent', 'any');
      expect(result.success).toBe(false);
      expect(result.message).toBe('Project not found.');
    });

    it('rejects negotiation when talent is already in negotiation', () => {
      const manager = createManager();
      const project = acquireFirstScript(manager);
      const talent = findAvailableTalent(manager)!;

      startTalentNegotiationForManager(manager, project.id, talent.id);
      // After opening, talent.availability becomes 'inNegotiation',
      // so a second attempt is rejected as unavailable.
      const result = startTalentNegotiationForManager(manager, project.id, talent.id);
      expect(result.success).toBe(false);
      expect(result.message).toContain('unavailable');
    });
  });

  // ── startTalentNegotiationRoundForManager ─────────────────────────

  describe('startTalentNegotiationRoundForManager', () => {
    it('opens a negotiation and applies an action in one call', () => {
      const manager = createManager();
      const project = acquireFirstScript(manager);
      const talent = findAvailableTalent(manager)!;

      const result = startTalentNegotiationRoundForManager(manager, project.id, talent.id, 'sweetenSalary');
      expect(result.success).toBe(true);
      expect(result.message).toContain(talent.name);
      expect(manager.playerNegotiations.length).toBe(1);

      const neg = manager.playerNegotiations[0];
      expect(neg.rounds).toBe(1);
    });
  });

  // ── adjustTalentNegotiationForManager ─────────────────────────────

  describe('adjustTalentNegotiationForManager', () => {
    it('adjusts an existing negotiation with sweetenSalary', () => {
      const manager = createManager();
      const project = acquireFirstScript(manager);
      const talent = findAvailableTalent(manager)!;

      startTalentNegotiationForManager(manager, project.id, talent.id);
      const neg = manager.playerNegotiations[0];
      const initialSalary = neg.offerSalaryMultiplier ?? 1;

      const result = adjustTalentNegotiationForManager(manager, project.id, talent.id, 'sweetenSalary');
      expect(result.success).toBe(true);

      const updated = manager.playerNegotiations[0];
      expect(updated.offerSalaryMultiplier).toBeGreaterThan(initialSalary);
      expect(updated.rounds).toBe(1);
    });

    it('adjusts with holdFirm increments hold count', () => {
      const manager = createManager();
      const project = acquireFirstScript(manager);
      const talent = findAvailableTalent(manager)!;

      startTalentNegotiationForManager(manager, project.id, talent.id);
      adjustTalentNegotiationForManager(manager, project.id, talent.id, 'holdFirm');

      const updated = manager.playerNegotiations[0];
      expect(updated.holdLineCount).toBe(1);
    });

    it('rejects when no open negotiation exists', () => {
      const manager = createManager();
      const project = acquireFirstScript(manager);
      const talent = findAvailableTalent(manager)!;

      const result = adjustTalentNegotiationForManager(manager, project.id, talent.id, 'sweetenSalary');
      expect(result.success).toBe(false);
      expect(result.message).toContain('No open negotiation');
    });

    it('rejects when negotiation rounds are exhausted', () => {
      const manager = createManager();
      const project = acquireFirstScript(manager);
      const talent = findAvailableTalent(manager)!;

      startTalentNegotiationForManager(manager, project.id, talent.id);
      // Force rounds to 4
      manager.playerNegotiations[0].rounds = 4;

      const result = adjustTalentNegotiationForManager(manager, project.id, talent.id, 'sweetenSalary');
      expect(result.success).toBe(false);
      expect(result.message).toContain('out of rounds');
    });
  });

  // ── getNegotiationChanceForManager ────────────────────────────────

  describe('getNegotiationChanceForManager', () => {
    it('returns a number between 0 and 1 for an existing talent', () => {
      const manager = createManager();
      const talent = findAvailableTalent(manager)!;

      const chance = getNegotiationChanceForManager(manager, talent.id);
      expect(chance).not.toBeNull();
      expect(chance).toBeGreaterThanOrEqual(0);
      expect(chance).toBeLessThanOrEqual(1);
    });

    it('returns null for a nonexistent talent', () => {
      const manager = createManager();
      const chance = getNegotiationChanceForManager(manager, 'nonexistent');
      expect(chance).toBeNull();
    });
  });

  // ── getQuickCloseChanceForManager ─────────────────────────────────

  describe('getQuickCloseChanceForManager', () => {
    it('returns a number between 0 and 1 for an available talent', () => {
      const manager = createManager();
      const talent = findAvailableTalent(manager)!;

      const chance = getQuickCloseChanceForManager(manager, talent.id);
      expect(chance).not.toBeNull();
      expect(chance).toBeGreaterThanOrEqual(0);
      expect(chance).toBeLessThanOrEqual(1);
    });

    it('returns null for nonexistent talent', () => {
      const manager = createManager();
      const chance = getQuickCloseChanceForManager(manager, 'nonexistent');
      expect(chance).toBeNull();
    });
  });

  // ── getNegotiationSnapshotForManager ──────────────────────────────

  describe('getNegotiationSnapshotForManager', () => {
    it('returns null when no negotiation is open', () => {
      const manager = createManager();
      const project = acquireFirstScript(manager);
      const talent = findAvailableTalent(manager)!;

      const snapshot = getNegotiationSnapshotForManager(manager, project.id, talent.id);
      expect(snapshot).toBeNull();
    });

    it('returns a complete snapshot when a negotiation is open', () => {
      const manager = createManager();
      const project = acquireFirstScript(manager);
      const talent = findAvailableTalent(manager)!;

      startTalentNegotiationForManager(manager, project.id, talent.id);
      const snapshot = getNegotiationSnapshotForManager(manager, project.id, talent.id);

      expect(snapshot).not.toBeNull();
      expect(snapshot!.salaryMultiplier).toBeGreaterThanOrEqual(1);
      expect(snapshot!.chance).toBeGreaterThanOrEqual(0);
      expect(snapshot!.chance).toBeLessThanOrEqual(1);
      expect(snapshot!.roundsRemaining).toBeLessThanOrEqual(4);
      expect(['salary', 'backend', 'perks']).toContain(snapshot!.pressurePoint);
      expect(typeof snapshot!.signal).toBe('string');
      expect(snapshot!.demandSalaryMultiplier).toBeGreaterThanOrEqual(1);
    });
  });

  // ── previewTalentNegotiationRoundForManager ───────────────────────

  describe('previewTalentNegotiationRoundForManager', () => {
    it('returns a preview without modifying manager state', () => {
      const manager = createManager();
      const project = acquireFirstScript(manager);
      const talent = findAvailableTalent(manager)!;

      const negCountBefore = manager.playerNegotiations.length;
      const result = previewTalentNegotiationRoundForManager(manager, project.id, talent.id, 'sweetenSalary');

      expect(result.success).toBe(true);
      expect(result.preview).toBeDefined();
      expect(result.preview!.action).toBe('sweetenSalary');
      expect(result.preview!.chance).toBeGreaterThanOrEqual(0);
      expect(result.preview!.chance).toBeLessThanOrEqual(1);
      expect(result.preview!.rounds).toBe(1);
      // No negotiation should have been actually created
      expect(manager.playerNegotiations.length).toBe(negCountBefore);
    });

    it('fails for a project not in development', () => {
      const manager = createManager();
      const project = acquireFirstScript(manager);
      project.phase = 'production';
      const talent = findAvailableTalent(manager)!;

      const result = previewTalentNegotiationRoundForManager(manager, project.id, talent.id, 'sweetenSalary');
      expect(result.success).toBe(false);
      expect(result.message).toContain('development');
    });
  });

  // ── negotiateAndAttachTalentForManager (quick close) ──────────────

  describe('negotiateAndAttachTalentForManager', () => {
    it('attaches talent when quick-close RNG succeeds', () => {
      // RNG always returns 0 => always below chance => success
      const manager = createManager({ negotiationRng: () => 0 });
      const project = acquireFirstScript(manager);
      const talent = findAvailableTalent(manager)!;

      const result = negotiateAndAttachTalentForManager(manager, project.id, talent.id);
      expect(result.success).toBe(true);
      expect(result.message).toContain('attached');
    });

    it('fails when quick-close RNG fails', () => {
      // RNG always returns 1 => always above chance => failure
      const manager = createManager({ negotiationRng: () => 1 });
      const project = acquireFirstScript(manager);
      const talent = findAvailableTalent(manager)!;

      const result = negotiateAndAttachTalentForManager(manager, project.id, talent.id);
      expect(result.success).toBe(false);
      expect(result.message).toContain('declined');
    });

    it('fails when talent is unavailable', () => {
      const manager = createManager();
      const project = acquireFirstScript(manager);
      const talent = findAvailableTalent(manager)!;
      talent.availability = 'attached';

      const result = negotiateAndAttachTalentForManager(manager, project.id, talent.id);
      expect(result.success).toBe(false);
      expect(result.message).toContain('unavailable');
    });
  });

  // ── processPlayerNegotiationsForManager ───────────────────────────

  describe('processPlayerNegotiationsForManager', () => {
    it('resolves a successful negotiation when RNG rolls low', () => {
      const manager = createManager({ negotiationRng: () => 0 });
      const project = acquireFirstScript(manager);
      const talent = findAvailableTalent(manager)!;

      startTalentNegotiationForManager(manager, project.id, talent.id);
      expect(manager.playerNegotiations.length).toBe(1);

      const events: string[] = [];
      processPlayerNegotiationsForManager(manager, events);

      // Negotiation should be resolved (either attached or removed)
      expect(events.length).toBeGreaterThan(0);
    });

    it('keeps negotiation open when talent counters and rounds remain', () => {
      // RNG always fails but rounds < 4 and holdLine < 2 => counter
      const manager = createManager({ negotiationRng: () => 1 });
      const project = acquireFirstScript(manager);
      const talent = findAvailableTalent(manager)!;

      startTalentNegotiationForManager(manager, project.id, talent.id);
      const events: string[] = [];
      processPlayerNegotiationsForManager(manager, events);

      // Should still be open since rounds=0, holdLine=0
      const remaining = manager.playerNegotiations.find((n) => n.talentId === talent.id);
      expect(remaining).toBeDefined();
      expect(events.some((e) => e.includes('countered'))).toBe(true);
    });

    it('removes negotiation when project moves out of development', () => {
      const manager = createManager({ negotiationRng: () => 1 });
      const project = acquireFirstScript(manager);
      const talent = findAvailableTalent(manager)!;

      startTalentNegotiationForManager(manager, project.id, talent.id);
      project.phase = 'production';

      const events: string[] = [];
      processPlayerNegotiationsForManager(manager, events);

      expect(manager.playerNegotiations.length).toBe(0);
      expect(events.some((e) => e.includes('closed'))).toBe(true);
    });
  });
});
