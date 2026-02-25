import { describe, expect, it } from 'vitest';

import { StudioManager } from './studio-manager';

describe('StudioManager', () => {
  it('advances week and returns a summary when no blocking crises exist', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95 });
    const startingWeek = manager.currentWeek;

    const summary = manager.endWeek();

    expect(manager.currentWeek).toBe(startingWeek + 1);
    expect(summary.week).toBe(manager.currentWeek);
    expect(summary.events.length).toBeGreaterThan(0);
  });

  it('advances two weeks when turn length is set to two', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 1, rivalRng: () => 1 });
    const result = manager.setTurnLengthWeeks(2);
    const startingWeek = manager.currentWeek;

    const summary = manager.endTurn();

    expect(result.success).toBe(true);
    expect(manager.currentWeek).toBe(startingWeek + 2);
    expect(summary.week).toBe(manager.currentWeek);
    expect(summary.events.length).toBeGreaterThan(0);
  });

  it('pauses a two-week turn when a blocking crisis appears after week one', () => {
    const manager = new StudioManager({ crisisRng: () => 0, eventRng: () => 1, rivalRng: () => 1 });
    manager.setTurnLengthWeeks(2);
    const startingWeek = manager.currentWeek;

    const summary = manager.endTurn();

    expect(manager.currentWeek).toBe(startingWeek + 1);
    expect(summary.hasPendingCrises).toBe(true);
    expect(summary.events.some((entry) => entry.includes('Turn paused'))).toBe(true);
  });

  it('validates turn length input to 1 or 2 weeks', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95 });

    const invalid = manager.setTurnLengthWeeks(3);
    expect(invalid.success).toBe(false);
    expect(manager.turnLengthWeeks).toBe(1);

    const valid = manager.setTurnLengthWeeks(2);
    expect(valid.success).toBe(true);
    expect(manager.turnLengthWeeks).toBe(2);
  });

  it('blocks endWeek when unresolved crises exist', () => {
    const manager = new StudioManager({ crisisRng: () => 0.0 });
    manager.endWeek();
    expect(manager.pendingCrises.length).toBeGreaterThan(0);

    expect(() => manager.endWeek()).toThrow('Resolve all crises before ending the week.');
  });

  it('allows progression after resolving crisis', () => {
    const manager = new StudioManager({ crisisRng: () => 0.0 });
    manager.endWeek();

    const crisis = manager.pendingCrises[0];
    manager.resolveCrisis(crisis.id, crisis.options[0].id);

    expect(manager.pendingCrises.length).toBe(0);

    const summary = manager.endWeek();
    expect(summary.week).toBe(manager.currentWeek);
  });

  it('applies decision option effects and removes decision item', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95 });
    const decision = manager.decisionQueue[0];
    const cashBefore = manager.cash;

    manager.resolveDecision(decision.id, decision.options[0].id);

    expect(manager.decisionQueue.find((item) => item.id === decision.id)).toBeUndefined();
    expect(manager.cash).toBeLessThan(cashBefore);
  });

  it('does not apply project mutations for studio-level decisions without explicit projectId', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95 });
    const project = manager.activeProjects[0];
    const startScript = project.scriptQuality;
    const startHype = project.hypeScore;

    manager.decisionQueue.push({
      id: 'studio-only-decision',
      projectId: null,
      title: 'Studio Macro Choice',
      body: 'test',
      weeksUntilExpiry: 1,
      options: [
        {
          id: 'studio-only-option',
          label: 'Apply',
          preview: 'test',
          cashDelta: 0,
          scriptQualityDelta: 1.5,
          hypeDelta: 8,
        },
      ],
    });

    manager.resolveDecision('studio-only-decision', 'studio-only-option');

    expect(project.scriptQuality).toBe(startScript);
    expect(project.hypeScore).toBe(startHype);
  });

  it('keeps opening decision copy aligned with project-level effects', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95 });
    const opening = manager.decisionQueue[0];
    const targetProject = opening.projectId
      ? manager.activeProjects.find((project) => project.id === opening.projectId)
      : null;

    expect(opening.title).toContain('Script Doctor');
    expect(opening.options[0].label).toBe('Fund the Sprint');
    expect(opening.options[0].preview).toContain('Night Ledger');
    expect(opening.projectId).toBeTruthy();
    expect(targetProject).toBeTruthy();

    const baselineScript = targetProject!.scriptQuality;
    manager.resolveDecision(opening.id, opening.options[0].id);
    expect(targetProject!.scriptQuality).toBeGreaterThan(baselineScript);
  });

  it('applies extended decision effects to project, heat, and story flags', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95 });
    const project = manager.activeProjects[0];
    const startWeeks = project.scheduledWeeksRemaining;
    const startMarketing = project.marketingBudget;
    const startRisk = project.budget.overrunRisk;
    const startHeat = manager.studioHeat;

    manager.decisionQueue.push({
      id: 'custom-decision',
      projectId: project.id,
      arcId: 'ops-arc',
      arcStage: 0,
      title: 'Custom Ops Decision',
      body: 'test',
      weeksUntilExpiry: 1,
      options: [
        {
          id: 'opt-a',
          label: 'Commit',
          preview: 'test',
          cashDelta: -50_000,
          scriptQualityDelta: 0.2,
          hypeDelta: 1,
          studioHeatDelta: 2,
          scheduleDelta: -1,
          marketingDelta: 120_000,
          overrunRiskDelta: -0.03,
          setFlag: 'ops_patch',
          setArcStage: 1,
        },
      ],
    });

    manager.resolveDecision('custom-decision', 'opt-a');

    expect(project.scheduledWeeksRemaining).toBe(Math.max(0, startWeeks - 1));
    expect(project.marketingBudget).toBe(startMarketing + 120_000);
    expect(project.budget.overrunRisk).toBeLessThan(startRisk);
    expect(manager.studioHeat).toBe(startHeat + 2);
    expect(manager.storyFlags.ops_patch).toBe(1);
    expect(manager.storyArcs['ops-arc']?.stage).toBe(1);
    expect(manager.storyArcs['ops-arc']?.status).toBe('active');
  });

  it('acquires script from market and creates development project', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95 });
    const beforeProjects = manager.activeProjects.length;
    const beforeScripts = manager.scriptMarket.length;
    const targetScript = manager.scriptMarket[0];

    const result = manager.acquireScript(targetScript.id);

    expect(result.success).toBe(true);
    expect(manager.activeProjects.length).toBe(beforeProjects + 1);
    expect(manager.scriptMarket.length).toBe(beforeScripts - 1);
  });

  it('attaches available talent through negotiation', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, negotiationRng: () => 0 });
    const project = manager.activeProjects.find((item) => item.phase === 'development');
    const director = manager.talentPool.find((item) => item.role === 'director');
    expect(project).toBeTruthy();
    expect(director).toBeTruthy();

    const result = manager.negotiateAndAttachTalent(project!.id, director!.id);

    expect(result.success).toBe(true);
    expect(project!.directorId).toBe(director!.id);
    expect(director!.availability).toBe('attached');
  });

  it('records talent memory changes across attachment and abandonment', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, negotiationRng: () => 0 });
    const project = manager.activeProjects.find((item) => item.phase === 'development');
    const director = manager.talentPool.find((item) => item.role === 'director');
    expect(project).toBeTruthy();
    expect(director).toBeTruthy();
    const baselineTrust = director!.relationshipMemory.trust;
    const baselineLoyalty = director!.relationshipMemory.loyalty;

    const attach = manager.negotiateAndAttachTalent(project!.id, director!.id);
    expect(attach.success).toBe(true);
    expect(director!.relationshipMemory.trust).toBeGreaterThan(baselineTrust);
    expect(director!.relationshipMemory.loyalty).toBeGreaterThan(baselineLoyalty);

    const trustAfterAttach = director!.relationshipMemory.trust;
    const loyaltyAfterAttach = director!.relationshipMemory.loyalty;
    const abandon = manager.abandonProject(project!.id);
    expect(abandon.success).toBe(true);
    expect(director!.availability).toBe('available');
    expect(director!.relationshipMemory.trust).toBeLessThan(trustAfterAttach);
    expect(director!.relationshipMemory.loyalty).toBeLessThan(loyaltyAfterAttach);
    expect(director!.relationshipMemory.interactionHistory.at(-1)?.kind).toBe('projectAbandoned');
  });

  it('caps talent interaction history length to bounded memory', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95 });
    const talent = manager.talentPool[0];

    for (let i = 0; i < 14; i += 1) {
      manager.recordTalentInteraction(talent, {
        kind: 'negotiationHardline',
        trustDelta: -1,
        loyaltyDelta: -1,
        note: `memory-${i}`,
      });
    }

    expect(talent.relationshipMemory.interactionHistory.length).toBe(10);
    expect(talent.relationshipMemory.interactionHistory[0]?.note).toBe('memory-4');
    expect(talent.relationshipMemory.interactionHistory[9]?.note).toBe('memory-13');
  });

  it('blocks negotiations and attachments for non-development projects', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, negotiationRng: () => 0 });
    const project = manager.activeProjects.find((item) => item.phase === 'development');
    const director = manager.talentPool.find((item) => item.role === 'director');
    expect(project).toBeTruthy();
    expect(director).toBeTruthy();

    project!.phase = 'preProduction';
    const open = manager.startTalentNegotiation(project!.id, director!.id);
    const quickClose = manager.negotiateAndAttachTalent(project!.id, director!.id);

    expect(open.success).toBe(false);
    expect(open.message).toContain('development');
    expect(quickClose.success).toBe(false);
    expect(quickClose.message).toContain('development');
  });

  it('does not claim talent accepted if retainer cash is unavailable at resolution', () => {
    const manager = new StudioManager({
      crisisRng: () => 0.95,
      negotiationRng: () => 0,
      rivalRng: () => 1,
      eventRng: () => 1,
    });
    const project = manager.activeProjects.find((item) => item.phase === 'development');
    const director = manager.talentPool.find((item) => item.role === 'director');
    expect(project).toBeTruthy();
    expect(director).toBeTruthy();

    const opened = manager.startTalentNegotiation(project!.id, director!.id);
    expect(opened.success).toBe(true);
    manager.cash = 0;

    manager.endWeek();
    const summary = manager.endWeek();
    expect(summary.events.some((entry) => entry.includes('accepted in principle'))).toBe(true);
    expect(summary.events.some((entry) => entry.includes('accepted terms with'))).toBe(false);
    expect(director!.availability).toBe('unavailable');
    expect(director!.unavailableUntilWeek).toBe(manager.currentWeek - 1 + 1);
    expect(project!.directorId).not.toBe(director!.id);
  });

  it('supports negotiation rounds with term sweeteners and hold-line penalties', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, negotiationRng: () => 0.5, eventRng: () => 1, rivalRng: () => 1 });
    const project = manager.activeProjects.find((item) => item.phase === 'development');
    const lead = manager.talentPool.find((item) => item.role === 'leadActor');
    expect(project).toBeTruthy();
    expect(lead).toBeTruthy();

    const opened = manager.startTalentNegotiation(project!.id, lead!.id);
    expect(opened.success).toBe(true);

    const baseline = manager.getNegotiationSnapshot(project!.id, lead!.id);
    expect(baseline).toBeTruthy();
    expect(baseline?.rounds).toBe(0);

    manager.adjustTalentNegotiation(project!.id, lead!.id, 'holdFirm');
    const afterHold = manager.getNegotiationSnapshot(project!.id, lead!.id);
    expect(afterHold).toBeTruthy();
    expect(afterHold?.rounds).toBe(1);
    expect((afterHold?.chance ?? 0)).toBeLessThan(baseline?.chance ?? 1);

    manager.adjustTalentNegotiation(project!.id, lead!.id, 'sweetenSalary');
    const afterSweetener = manager.getNegotiationSnapshot(project!.id, lead!.id);
    expect(afterSweetener).toBeTruthy();
    expect(afterSweetener?.rounds).toBe(2);
    expect((afterSweetener?.salaryMultiplier ?? 0)).toBeGreaterThan(afterHold?.salaryMultiplier ?? 0);
    expect((afterSweetener?.chance ?? 0)).toBeGreaterThan(afterHold?.chance ?? 0);
  });

  it('reports explicit decline reason after repeated hardline rounds', () => {
    const manager = new StudioManager({
      crisisRng: () => 0.95,
      negotiationRng: () => 0.99,
      eventRng: () => 1,
      rivalRng: () => 1,
    });
    const project = manager.activeProjects.find((item) => item.phase === 'development');
    const lead = manager.talentPool.find((item) => item.role === 'leadActor');
    expect(project).toBeTruthy();
    expect(lead).toBeTruthy();

    manager.startTalentNegotiation(project!.id, lead!.id);
    manager.adjustTalentNegotiation(project!.id, lead!.id, 'holdFirm');
    manager.adjustTalentNegotiation(project!.id, lead!.id, 'holdFirm');

    manager.endWeek();
    const summary = manager.endWeek();
    expect(summary.events.some((entry) => entry.includes('hardline rounds'))).toBe(true);
    expect(lead!.availability).toBe('unavailable');
  });

  it('shows preview signal before negotiation resolves', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, negotiationRng: () => 0.5, eventRng: () => 1, rivalRng: () => 1 });
    const project = manager.activeProjects.find((item) => item.phase === 'development');
    const lead = manager.talentPool.find((item) => item.role === 'leadActor');
    expect(project).toBeTruthy();
    expect(lead).toBeTruthy();

    manager.startTalentNegotiation(project!.id, lead!.id);
    const snapshot = manager.getNegotiationSnapshot(project!.id, lead!.id);
    expect(snapshot).toBeTruthy();
    expect(snapshot?.signal.includes('accepted')).toBe(false);
  });

  it('applies quick-close attempt cost and cooldown on decline', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, negotiationRng: () => 0.99 });
    const project = manager.activeProjects.find((item) => item.phase === 'development');
    const lead = manager.talentPool.find((item) => item.role === 'leadActor');
    expect(project).toBeTruthy();
    expect(lead).toBeTruthy();

    const cashBefore = manager.cash;
    const result = manager.negotiateAndAttachTalent(project!.id, lead!.id);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Attempt cost');
    expect(manager.cash).toBeLessThan(cashBefore);
    expect(lead!.availability).toBe('unavailable');

    const retry = manager.negotiateAndAttachTalent(project!.id, lead!.id);
    expect(retry.success).toBe(false);
    expect(retry.message).toContain('unavailable');
  });

  it('cancels open negotiation if project leaves development before resolution', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, negotiationRng: () => 0, eventRng: () => 1, rivalRng: () => 1 });
    const project = manager.activeProjects.find((item) => item.phase === 'development');
    const lead = manager.talentPool.find((item) => item.role === 'leadActor');
    expect(project).toBeTruthy();
    expect(lead).toBeTruthy();

    const opened = manager.startTalentNegotiation(project!.id, lead!.id);
    expect(opened.success).toBe(true);
    project!.phase = 'preProduction';

    manager.endWeek();
    const summary = manager.endWeek();
    expect(summary.events.some((entry) => entry.includes('moved out of development'))).toBe(true);
    expect(lead!.availability).toBe('available');
    expect(project!.castIds.includes(lead!.id)).toBe(false);
  });

  it('gates optional action on cash and applies to lowest-marketing active project', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95 });
    const [projectA, projectB] = manager.activeProjects;
    expect(projectA).toBeTruthy();
    expect(projectB).toBeTruthy();

    projectA.hypeScore = 12;
    projectB.hypeScore = 48;
    projectA.marketingBudget = 900_000;
    projectB.marketingBudget = 0;
    const projectBMarketingBefore = projectB.marketingBudget;
    const projectAMarketingBefore = projectA.marketingBudget;

    manager.cash = 100_000;
    const blocked = manager.runOptionalAction();
    expect(blocked.success).toBe(false);
    expect(blocked.message).toContain('Insufficient cash');

    manager.cash = 1_000_000;
    const success = manager.runOptionalAction();
    expect(success.success).toBe(true);
    expect(success.message).toContain(projectB.title);
    expect(projectB.marketingBudget).toBe(projectBMarketingBefore + 180_000);
    expect(projectA.marketingBudget).toBe(projectAMarketingBefore);
  });

  it('runs script sprint only in development and caps quality at 8.5', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95 });
    const project = manager.activeProjects.find((item) => item.phase === 'development');
    expect(project).toBeTruthy();

    manager.cash = 500_000;
    project!.scriptQuality = 8.3;
    const first = manager.runScriptDevelopmentSprint(project!.id);
    const second = manager.runScriptDevelopmentSprint(project!.id);

    expect(first.success).toBe(true);
    expect(project!.scriptQuality).toBe(8.5);
    expect(second.success).toBe(false);
    expect(second.message).toContain('max sprint quality');
  });

  it('runs post-production polish pass with 2-use cap and editorial ceiling', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95 });
    const project = manager.activeProjects[0];
    project.phase = 'postProduction';
    project.editorialScore = 5;
    project.postPolishPasses = 0;
    manager.cash = 1_000_000;

    const first = manager.runPostProductionPolishPass(project.id);
    const second = manager.runPostProductionPolishPass(project.id);
    const third = manager.runPostProductionPolishPass(project.id);

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(project.editorialScore).toBe(9);
    expect(project.postPolishPasses).toBe(2);
    expect(third.success).toBe(false);
  });

  it('enforces phase progression gates and advances when requirements are met', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, negotiationRng: () => 0 });
    const project = manager.activeProjects.find((item) => item.phase === 'development');
    const director = manager.talentPool.find((item) => item.role === 'director');
    const lead = manager.talentPool.find((item) => item.role === 'leadActor');
    expect(project).toBeTruthy();
    expect(director).toBeTruthy();
    expect(lead).toBeTruthy();

    let result = manager.advanceProjectPhase(project!.id);
    expect(result.success).toBe(false);

    manager.negotiateAndAttachTalent(project!.id, director!.id);
    manager.negotiateAndAttachTalent(project!.id, lead!.id);
    result = manager.advanceProjectPhase(project!.id);
    expect(result.success).toBe(true);
    expect(project!.phase).toBe('preProduction');
  });

  it('does not spam duplicate event titles in same queue', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0.1 });

    manager.endWeek();
    manager.endWeek();
    manager.endWeek();

    const titles = manager.decisionQueue.map((item) => item.title);
    const unique = new Set(titles);
    expect(unique.size).toBe(titles.length);
  });

  it('respects flag-gated events before and after prerequisite flag is set', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0 });
    (manager as unknown as { eventDeck: unknown[] }).eventDeck = [
      {
        id: 'gated',
        category: 'operations',
        scope: 'studio',
        requiresFlag: 'gate_open',
        title: 'Gated Event',
        decisionTitle: 'Gated Decision',
        body: 'gated',
        cooldownWeeks: 1,
        baseWeight: 10,
        minWeek: 1,
        buildDecision: ({ idFactory }: { idFactory: (prefix: string) => string }) => ({
          id: idFactory('decision'),
          projectId: null,
          title: 'Gated Decision',
          body: 'gated',
          weeksUntilExpiry: 1,
          options: [
            {
              id: idFactory('opt'),
              label: 'Ok',
              preview: 'ok',
              cashDelta: 0,
              scriptQualityDelta: 0,
              hypeDelta: 0,
            },
          ],
        }),
      },
      {
        id: 'open',
        category: 'operations',
        scope: 'studio',
        title: 'Open Event',
        decisionTitle: 'Open Decision',
        body: 'open',
        cooldownWeeks: 1,
        baseWeight: 1,
        minWeek: 1,
        buildDecision: ({ idFactory }: { idFactory: (prefix: string) => string }) => ({
          id: idFactory('decision'),
          projectId: null,
          title: 'Open Decision',
          body: 'open',
          weeksUntilExpiry: 1,
          options: [
            {
              id: idFactory('opt'),
              label: 'Ok',
              preview: 'ok',
              cashDelta: 0,
              scriptQualityDelta: 0,
              hypeDelta: 0,
            },
          ],
        }),
      },
    ];

    manager.decisionQueue = [];
    manager.endWeek();
    expect(manager.decisionQueue.some((item) => item.title === 'Gated Decision')).toBe(false);
    expect(manager.decisionQueue.some((item) => item.title === 'Open Decision')).toBe(true);

    manager.decisionQueue = [];
    manager.storyFlags.gate_open = 1;
    manager.endWeek();
    expect(manager.decisionQueue.some((item) => item.title === 'Gated Decision')).toBe(true);
  });

  it('respects arc-gated events before and after prerequisite stage is reached', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0 });
    (manager as unknown as { eventDeck: unknown[] }).eventDeck = [
      {
        id: 'arc-gated',
        category: 'operations',
        scope: 'studio',
        requiresArc: { id: 'arc_a', minStage: 2, status: 'active' },
        title: 'Arc Gated Event',
        decisionTitle: 'Arc Gated Decision',
        body: 'arc gated',
        cooldownWeeks: 1,
        baseWeight: 10,
        minWeek: 1,
        buildDecision: ({ idFactory }: { idFactory: (prefix: string) => string }) => ({
          id: idFactory('decision'),
          projectId: null,
          title: 'Arc Gated Decision',
          body: 'arc gated',
          weeksUntilExpiry: 1,
          options: [
            {
              id: idFactory('opt'),
              label: 'Ok',
              preview: 'ok',
              cashDelta: 0,
              scriptQualityDelta: 0,
              hypeDelta: 0,
            },
          ],
        }),
      },
      {
        id: 'fallback-open',
        category: 'operations',
        scope: 'studio',
        title: 'Fallback Open',
        decisionTitle: 'Fallback Open Decision',
        body: 'fallback',
        cooldownWeeks: 1,
        baseWeight: 1,
        minWeek: 1,
        buildDecision: ({ idFactory }: { idFactory: (prefix: string) => string }) => ({
          id: idFactory('decision'),
          projectId: null,
          title: 'Fallback Open Decision',
          body: 'fallback',
          weeksUntilExpiry: 1,
          options: [
            {
              id: idFactory('opt'),
              label: 'Ok',
              preview: 'ok',
              cashDelta: 0,
              scriptQualityDelta: 0,
              hypeDelta: 0,
            },
          ],
        }),
      },
    ];

    manager.decisionQueue = [];
    manager.endWeek();
    expect(manager.decisionQueue.some((item) => item.title === 'Arc Gated Decision')).toBe(false);
    expect(manager.decisionQueue.some((item) => item.title === 'Fallback Open Decision')).toBe(true);

    manager.decisionQueue = [];
    manager.storyArcs.arc_a = { stage: 2, status: 'active', lastUpdatedWeek: manager.currentWeek };
    manager.endWeek();
    expect(manager.decisionQueue.some((item) => item.title === 'Arc Gated Decision')).toBe(true);
  });

  it('derives persistent modifiers from resolved and failed arcs', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95 });
    manager.storyArcs['awards-circuit'] = { stage: 3, status: 'resolved', lastUpdatedWeek: manager.currentWeek };
    manager.storyArcs['exhibitor-war'] = { stage: 2, status: 'failed', lastUpdatedWeek: manager.currentWeek };

    const modifiers = (manager as unknown as { getArcOutcomeModifiers: () => { releaseHeatMomentum: number; distributionLeverage: number } }).getArcOutcomeModifiers();
    expect(modifiers.releaseHeatMomentum).toBeGreaterThanOrEqual(1);
    expect(modifiers.distributionLeverage).toBeLessThan(0.05);
  });

  it('applies arc outcome modifiers to generated distribution offers', () => {
    const baseManager = new StudioManager({ crisisRng: () => 0.95, negotiationRng: () => 0 });
    const boostedManager = new StudioManager({ crisisRng: () => 0.95, negotiationRng: () => 0 });
    const projectA = baseManager.activeProjects[0];
    const projectB = boostedManager.activeProjects[0];
    projectA.phase = 'distribution';
    projectB.phase = 'distribution';

    boostedManager.storyArcs['exhibitor-war'] = { stage: 3, status: 'resolved', lastUpdatedWeek: boostedManager.currentWeek };

    (baseManager as unknown as { generateDistributionOffers: (projectId: string) => void }).generateDistributionOffers(projectA.id);
    (boostedManager as unknown as { generateDistributionOffers: (projectId: string) => void }).generateDistributionOffers(projectB.id);

    const offerA = baseManager.getOffersForProject(projectA.id)[0];
    const offerB = boostedManager.getOffersForProject(projectB.id)[0];
    expect(offerA).toBeTruthy();
    expect(offerB).toBeTruthy();
    expect((offerB?.minimumGuarantee ?? 0)).toBeGreaterThan(offerA?.minimumGuarantee ?? 0);
  });

  it('generates and manages distribution offers', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, negotiationRng: () => 0 });
    const project = manager.activeProjects.find((item) => item.phase === 'development');
    const director = manager.talentPool.find((item) => item.role === 'director');
    const lead = manager.talentPool.find((item) => item.role === 'leadActor');
    expect(project).toBeTruthy();
    expect(director).toBeTruthy();
    expect(lead).toBeTruthy();

    manager.negotiateAndAttachTalent(project!.id, director!.id);
    manager.negotiateAndAttachTalent(project!.id, lead!.id);
    project!.marketingBudget = 1_000_000;

    manager.advanceProjectPhase(project!.id);
    project!.scheduledWeeksRemaining = 0;
    manager.advanceProjectPhase(project!.id);
    project!.scheduledWeeksRemaining = 0;
    manager.advanceProjectPhase(project!.id);
    project!.scheduledWeeksRemaining = 0;
    manager.advanceProjectPhase(project!.id);

    expect(project!.phase).toBe('distribution');
    const offers = manager.getOffersForProject(project!.id);
    expect(offers.length).toBeGreaterThanOrEqual(2);

    const counter = manager.counterDistributionOffer(project!.id, offers[0].id);
    expect(counter.success).toBe(true);

    const accept = manager.acceptDistributionOffer(project!.id, offers[0].id);
    expect(accept.success).toBe(true);
    expect(project!.releaseWindow).toBeTruthy();

    manager.walkAwayDistribution(project!.id);
    expect(manager.getOffersForProject(project!.id).length).toBe(0);
  });

  it('preserves backend share reductions when accepting distribution offers', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, negotiationRng: () => 0 });
    const project = manager.activeProjects.find((item) => item.phase === 'development');
    const director = manager.talentPool.find((item) => item.role === 'director');
    const lead = manager.talentPool.find((item) => item.role === 'leadActor');
    expect(project).toBeTruthy();
    expect(director).toBeTruthy();
    expect(lead).toBeTruthy();

    manager.negotiateAndAttachTalent(project!.id, director!.id);
    manager.negotiateAndAttachTalent(project!.id, lead!.id);
    project!.marketingBudget = 1_000_000;

    manager.advanceProjectPhase(project!.id);
    project!.scheduledWeeksRemaining = 0;
    manager.advanceProjectPhase(project!.id);
    project!.scheduledWeeksRemaining = 0;
    manager.advanceProjectPhase(project!.id);
    project!.scheduledWeeksRemaining = 0;
    manager.advanceProjectPhase(project!.id);

    const offer = manager.getOffersForProject(project!.id)[0];
    expect(offer).toBeTruthy();
    const beforeShare = project!.studioRevenueShare;
    manager.acceptDistributionOffer(project!.id, offer.id);

    expect(project!.studioRevenueShare).toBe(Math.min(beforeShare, offer.revenueShareToStudio));
  });

  it('prevents release before selected release week', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95 });
    const project = manager.activeProjects[0];
    project.phase = 'distribution';
    project.releaseWindow = 'wideTheatrical';
    project.scheduledWeeksRemaining = 0;
    project.releaseWeek = manager.currentWeek + 2;

    const blocked = manager.advanceProjectPhase(project.id);
    expect(blocked.success).toBe(false);
    expect(blocked.message).toContain('scheduled for week');

    manager.currentWeek = project.releaseWeek;
    const released = manager.advanceProjectPhase(project.id);
    expect(released.success).toBe(true);
    expect(project.phase).toBe('released');
  });

  it('replenishes script market after expirations', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0.42 });
    manager.scriptMarket = manager.scriptMarket.slice(0, 1);
    manager.scriptMarket[0].expiresInWeeks = 0;

    manager.endWeek();

    expect(manager.scriptMarket.length).toBeGreaterThanOrEqual(3);
  });

  it('limits each distribution offer to a single counter attempt', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, negotiationRng: () => 0 });
    const project = manager.activeProjects[0];
    project.phase = 'distribution';

    (manager as unknown as { generateDistributionOffers: (projectId: string) => void }).generateDistributionOffers(project.id);
    const offer = manager.getOffersForProject(project.id)[0];
    expect(offer).toBeTruthy();

    const first = manager.counterDistributionOffer(project.id, offer.id);
    const second = manager.counterDistributionOffer(project.id, offer.id);

    expect(first.success).toBe(true);
    expect(second.success).toBe(false);
    expect(second.message).toContain('will not entertain another counter');
  });

  it('applies release-week shifts from decision options', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95 });
    const project = manager.activeProjects[0];
    project.phase = 'distribution';
    project.releaseWeek = manager.currentWeek + 6;

    manager.decisionQueue.push({
      id: 'release-shift-decision',
      projectId: project.id,
      title: 'Release Shift Test',
      body: 'test',
      weeksUntilExpiry: 1,
      options: [
        {
          id: 'release-shift-option',
          label: 'Shift',
          preview: 'test',
          cashDelta: 0,
          scriptQualityDelta: 0,
          hypeDelta: 0,
          releaseWeekShift: -1,
        },
      ],
    });

    manager.resolveDecision('release-shift-decision', 'release-shift-option');

    expect(project.releaseWeek).toBe(manager.currentWeek + 5);
  });

  it('resolves release run over weeks and finalizes heat impact', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, negotiationRng: () => 0 });
    const project = manager.activeProjects.find((item) => item.phase === 'development');
    const director = manager.talentPool.find((item) => item.role === 'director');
    const lead = manager.talentPool.find((item) => item.role === 'leadActor');
    expect(project).toBeTruthy();
    expect(director).toBeTruthy();
    expect(lead).toBeTruthy();

    manager.negotiateAndAttachTalent(project!.id, director!.id);
    manager.negotiateAndAttachTalent(project!.id, lead!.id);
    project!.marketingBudget = 1_000_000;

    manager.advanceProjectPhase(project!.id);
    project!.scheduledWeeksRemaining = 0;
    manager.advanceProjectPhase(project!.id);
    project!.scheduledWeeksRemaining = 0;
    manager.advanceProjectPhase(project!.id);
    project!.scheduledWeeksRemaining = 0;
    manager.advanceProjectPhase(project!.id);
    const offer = manager.getOffersForProject(project!.id)[0];
    manager.acceptDistributionOffer(project!.id, offer.id);
    project!.scheduledWeeksRemaining = 0;
    project!.releaseWeek = manager.currentWeek;
    manager.advanceProjectPhase(project!.id);

    expect(project!.phase).toBe('released');
    expect(project!.openingWeekendGross).toBeTruthy();

    let guard = 20;
    while (!project!.releaseResolved && guard > 0) {
      manager.endWeek();
      guard -= 1;
    }

    expect(project!.releaseResolved).toBe(true);
    expect(project!.weeklyGrossHistory.length).toBeGreaterThan(2);
    expect(project!.projectedROI).toBeGreaterThan(0);
  });

  it('queues and dismisses opening weekend reveal card', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, negotiationRng: () => 0 });
    const project = manager.activeProjects.find((item) => item.phase === 'development');
    const director = manager.talentPool.find((item) => item.role === 'director');
    const lead = manager.talentPool.find((item) => item.role === 'leadActor');
    expect(project).toBeTruthy();
    expect(director).toBeTruthy();
    expect(lead).toBeTruthy();

    manager.negotiateAndAttachTalent(project!.id, director!.id);
    manager.negotiateAndAttachTalent(project!.id, lead!.id);
    project!.marketingBudget = 1_000_000;

    manager.advanceProjectPhase(project!.id);
    project!.scheduledWeeksRemaining = 0;
    manager.advanceProjectPhase(project!.id);
    project!.scheduledWeeksRemaining = 0;
    manager.advanceProjectPhase(project!.id);
    project!.scheduledWeeksRemaining = 0;
    manager.advanceProjectPhase(project!.id);
    const offer = manager.getOffersForProject(project!.id)[0];
    manager.acceptDistributionOffer(project!.id, offer.id);
    project!.scheduledWeeksRemaining = 0;
    project!.releaseWeek = manager.currentWeek;
    manager.advanceProjectPhase(project!.id);

    const reveal = manager.getNextReleaseReveal();
    expect(reveal?.id).toBe(project!.id);
    manager.dismissReleaseReveal(project!.id);
    expect(manager.getNextReleaseReveal()).toBeNull();
  });

  it('ticks rival heat and produces news + leaderboard updates', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, rivalRng: () => 1 });
    const before = manager.rivals.map((rival) => rival.studioHeat);

    manager.endWeek();

    const after = manager.rivals.map((rival) => rival.studioHeat);
    expect(after.some((value, index) => value !== before[index])).toBe(true);
    expect(manager.industryNewsLog.length).toBeGreaterThan(0);

    const board = manager.getIndustryHeatLeaderboard();
    for (let i = 1; i < board.length; i += 1) {
      expect(board[i - 1].heat).toBeGreaterThanOrEqual(board[i].heat);
    }
  });

  it('adapts rival aggression profile from long-term memory', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, rivalRng: () => 0.5 });
    const rival = manager.rivals.find((item) => item.personality === 'blockbusterFactory') ?? manager.rivals[0];
    const profileBefore = (manager as unknown as { getRivalBehaviorProfile: (rival: unknown) => { conflictPush: number; talentPoachChance: number } })
      .getRivalBehaviorProfile(rival);

    manager.recordRivalInteraction(rival, {
      kind: 'releaseCollision',
      hostilityDelta: 18,
      respectDelta: -8,
      note: 'Stress-test rivalry escalation.',
      projectId: null,
    });

    const profileAfter = (manager as unknown as { getRivalBehaviorProfile: (rival: unknown) => { conflictPush: number; talentPoachChance: number } })
      .getRivalBehaviorProfile(rival);
    expect(profileAfter.conflictPush).toBeGreaterThan(profileBefore.conflictPush);
    expect(profileAfter.talentPoachChance).toBeGreaterThan(profileBefore.talentPoachChance);
  });

  it('caps rival interaction history length to bounded memory', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, rivalRng: () => 0.5 });
    const rival = manager.rivals[0];

    for (let i = 0; i < 17; i += 1) {
      manager.recordRivalInteraction(rival, {
        kind: 'counterplayEscalation',
        hostilityDelta: 1,
        respectDelta: -1,
        note: `rival-memory-${i}`,
      });
    }

    expect(rival.memory.interactionHistory.length).toBe(12);
    expect(rival.memory.interactionHistory[0]?.note).toBe('rival-memory-5');
    expect(rival.memory.interactionHistory[11]?.note).toBe('rival-memory-16');
  });

  it('runs annual awards season and applies outcomes to eligible released films', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 1, rivalRng: () => 0, negotiationRng: () => 1 });
    const project = manager.activeProjects[0];
    project.phase = 'released';
    project.releaseResolved = true;
    project.releaseWeek = 12;
    project.criticalScore = 92;
    project.scriptQuality = 8.9;
    project.conceptStrength = 8.4;
    project.prestige = 88;
    project.controversy = 6;
    project.awardsNominations = 0;
    project.awardsWins = 0;
    manager.currentWeek = 51;
    const criticsBefore = manager.reputation.critics;

    manager.endWeek();

    expect(manager.currentWeek).toBe(52);
    expect(manager.awardsHistory.length).toBeGreaterThan(0);
    expect(project.awardsNominations).toBeGreaterThanOrEqual(1);
    expect(project.awardsWins).toBeGreaterThanOrEqual(0);
    expect(manager.reputation.critics).toBeGreaterThanOrEqual(criticsBefore);
    expect(manager.awardsSeasonsProcessed.includes(1)).toBe(true);
  });

  it('limits prestige rival poaches to directors', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, rivalRng: () => 0 });
    manager.rivals = [
      {
        id: 'r-prestige',
        name: 'Prestige Test',
        personality: 'prestigeHunter',
        studioHeat: 65,
        activeReleases: [],
        upcomingReleases: [],
        lockedTalentIds: [],
        memory: { hostility: 55, respect: 52, retaliationBias: 50, cooperationBias: 45, interactionHistory: [] },
      },
    ];

    const events: string[] = [];
    (manager as unknown as { processRivalTalentAcquisitions: (events: string[]) => void }).processRivalTalentAcquisitions(events);

    const lockedId = manager.rivals[0].lockedTalentIds[0];
    expect(lockedId).toBeTruthy();
    const lockedTalent = manager.talentPool.find((talent) => talent.id === lockedId);
    expect(lockedTalent?.role).toBe('director');
  });

  it('targets player release weeks for blockbuster calendar moves', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, rivalRng: () => 0 });
    manager.rivals = [
      {
        id: 'r-blockbuster',
        name: 'Blockbuster Test',
        personality: 'blockbusterFactory',
        studioHeat: 70,
        activeReleases: [],
        upcomingReleases: [],
        lockedTalentIds: [],
        memory: { hostility: 55, respect: 52, retaliationBias: 50, cooperationBias: 45, interactionHistory: [] },
      },
    ];
    const project = manager.activeProjects[0];
    project.phase = 'distribution';
    project.releaseWeek = manager.currentWeek + 6;

    const events: string[] = [];
    (manager as unknown as { processRivalCalendarMoves: (events: string[]) => void }).processRivalCalendarMoves(events);

    expect(manager.rivals[0].upcomingReleases.length).toBeGreaterThan(0);
    expect(manager.rivals[0].upcomingReleases[0].releaseWeek).toBe(project.releaseWeek);
  });

  it('queues streaming output-deal response after release resolution', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, rivalRng: () => 0 });
    manager.rivals = [
      {
        id: 'r-stream',
        name: 'Stream Rival',
        personality: 'streamingFirst',
        studioHeat: 50,
        activeReleases: [],
        upcomingReleases: [],
        lockedTalentIds: [],
        memory: { hostility: 55, respect: 52, retaliationBias: 50, cooperationBias: 45, interactionHistory: [] },
      },
    ];
    const releasedProject = manager.activeProjects[0];
    releasedProject.phase = 'released';
    releasedProject.releaseResolved = true;

    const events: string[] = [];
    (manager as unknown as { checkRivalReleaseResponses: (project: unknown, events: string[]) => void }).checkRivalReleaseResponses(
      releasedProject,
      events
    );

    expect(manager.decisionQueue.some((item) => item.title.includes('Output Deal'))).toBe(true);
  });

  it('creates talent poach interrupt when rival closes during player negotiation', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, rivalRng: () => 0 });
    const project = manager.activeProjects.find((item) => item.phase === 'development');
    const targetTalent = manager.talentPool
      .filter((item) => item.role === 'leadActor')
      .sort((a, b) => b.craftScore - a.craftScore)[0];
    expect(project).toBeTruthy();
    expect(targetTalent).toBeTruthy();

    const start = manager.startTalentNegotiation(project!.id, targetTalent!.id);
    expect(start.success).toBe(true);

    manager.endWeek();
    const poach = manager.pendingCrises.find((item) => item.kind === 'talentPoached');
    expect(poach).toBeTruthy();
  });

  it('creates release conflict interrupt when rival moves into player week', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, negotiationRng: () => 0, rivalRng: () => 0 });
    const project = manager.activeProjects.find((item) => item.phase === 'development');
    const director = manager.talentPool.find((item) => item.role === 'director');
    const lead = manager.talentPool.find((item) => item.role === 'leadActor');
    expect(project).toBeTruthy();
    expect(director).toBeTruthy();
    expect(lead).toBeTruthy();

    manager.negotiateAndAttachTalent(project!.id, director!.id);
    manager.negotiateAndAttachTalent(project!.id, lead!.id);
    project!.marketingBudget = 1_000_000;

    manager.advanceProjectPhase(project!.id);
    project!.scheduledWeeksRemaining = 0;
    manager.advanceProjectPhase(project!.id);
    project!.scheduledWeeksRemaining = 0;
    manager.advanceProjectPhase(project!.id);
    project!.scheduledWeeksRemaining = 0;
    manager.advanceProjectPhase(project!.id);

    expect(project!.phase).toBe('distribution');
    manager.endWeek();
    const conflict = manager.pendingCrises.find((item) => item.kind === 'releaseConflict');
    expect(conflict).toBeTruthy();
  });

  it('applies calendar pressure when rival release overlaps week', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, rivalRng: () => 0.95 });
    const project = manager.activeProjects[0];
    project.releaseWeek = manager.currentWeek + 6;
    const clearProjection = manager.getProjectedForProject(project.id);
    expect(clearProjection).toBeTruthy();

    manager.rivals[0].upcomingReleases.push({
      id: 'test-rival-film',
      title: 'Overlap Film',
      genre: project.genre,
      releaseWeek: project.releaseWeek,
      releaseWindow: 'wideTheatrical',
      estimatedBudget: 140_000_000,
      hypeScore: 80,
      finalGross: null,
      criticalScore: null,
    });

    const pressuredProjection = manager.getProjectedForProject(project.id);
    expect(pressuredProjection).toBeTruthy();
    expect((pressuredProjection?.openingHigh ?? 0)).toBeLessThan(clearProjection?.openingHigh ?? 0);
  });

  it('projects alternate release weeks without mutating project state', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, rivalRng: () => 0.95 });
    const project = manager.activeProjects[0];
    project.releaseWeek = manager.currentWeek + 6;
    const originalWeek = project.releaseWeek;

    manager.rivals[0].upcomingReleases.push({
      id: 'test-rival-week',
      title: 'Pressure Week Film',
      genre: project.genre,
      releaseWeek: originalWeek,
      releaseWindow: 'wideTheatrical',
      estimatedBudget: 150_000_000,
      hypeScore: 85,
      finalGross: null,
      criticalScore: null,
    });

    const atCurrent = manager.getProjectedForProject(project.id);
    const atSameWeek = manager.getProjectedForProjectAtWeek(project.id, originalWeek);
    const atLaterWeek = manager.getProjectedForProjectAtWeek(project.id, originalWeek + 4);

    expect(atCurrent).toBeTruthy();
    expect(atSameWeek).toBeTruthy();
    expect(atLaterWeek).toBeTruthy();
    expect((atSameWeek?.openingHigh ?? 0)).toBeCloseTo(atCurrent?.openingHigh ?? 0, 5);
    expect((atLaterWeek?.openingHigh ?? 0)).toBeGreaterThan(atSameWeek?.openingHigh ?? 0);
    expect(project.releaseWeek).toBe(originalWeek);
  });

  it('applies genre cycle demand multiplier to projections', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, rivalRng: () => 1 });
    const project = manager.activeProjects[0];
    project.releaseWeek = manager.currentWeek + 4;

    manager.genreCycles[project.genre].demand = 1.25;
    const hotProjection = manager.getProjectedForProject(project.id);
    manager.genreCycles[project.genre].demand = 0.8;
    const coolProjection = manager.getProjectedForProject(project.id);

    expect(hotProjection).toBeTruthy();
    expect(coolProjection).toBeTruthy();
    expect((hotProjection?.openingHigh ?? 0)).toBeGreaterThan(coolProjection?.openingHigh ?? 0);
  });

  it('submits to festival circuit and resolves into prestige outcomes', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0, rivalRng: () => 1, negotiationRng: () => 1 });
    const project = manager.activeProjects.find((item) => item.phase === 'development') ?? manager.activeProjects[0];
    project.phase = 'postProduction';
    project.prestige = 84;
    project.scriptQuality = 8.5;
    project.originality = 80;
    project.controversy = 4;
    const criticsBefore = manager.reputation.critics;

    const submit = manager.runFestivalSubmission(project.id);
    expect(submit.success).toBe(true);
    expect(project.festivalStatus).toBe('submitted');
    expect(project.festivalResolutionWeek).toBe(manager.currentWeek + 2);

    manager.endWeek();
    manager.endWeek();
    manager.endWeek();

    expect(['selected', 'buzzed']).toContain(project.festivalStatus);
    expect(project.festivalBuzz).toBeGreaterThan(0);
    expect(manager.reputation.critics).toBeGreaterThan(criticsBefore);
  });

  it('applies rival personality pressure to matching arc families', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, rivalRng: () => 0.5 });
    manager.rivals = [
      {
        id: 'r-1',
        name: 'Test Blockbuster',
        personality: 'blockbusterFactory',
        studioHeat: 70,
        activeReleases: [],
        upcomingReleases: [],
        lockedTalentIds: [],
        memory: { hostility: 55, respect: 52, retaliationBias: 50, cooperationBias: 45, interactionHistory: [] },
      },
    ];

    const arcPressure = (manager as unknown as { getArcPressureFromRivals: (arcId: string) => number }).getArcPressureFromRivals(
      'exhibitor-war'
    );
    const unrelatedPressure = (manager as unknown as { getArcPressureFromRivals: (arcId: string) => number }).getArcPressureFromRivals(
      'awards-circuit'
    );

    expect(arcPressure).toBeGreaterThan(unrelatedPressure);
    expect(arcPressure).toBeGreaterThan(0);
  });

  it('estimates weekly burn with the same formula used for burn application', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95 });
    const estimated = manager.estimateWeeklyBurn();

    const applied = (manager as unknown as { applyWeeklyBurn: () => number }).applyWeeklyBurn();
    expect(estimated).toBeCloseTo(applied, 5);
  });

  it('runs blockbuster signature move and injects tentpole release conflict pressure', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, rivalRng: () => 0 });
    manager.rivals = [
      {
        id: 'r-1',
        name: 'Test Blockbuster',
        personality: 'blockbusterFactory',
        studioHeat: 70,
        activeReleases: [],
        upcomingReleases: [],
        lockedTalentIds: [],
        memory: { hostility: 55, respect: 52, retaliationBias: 50, cooperationBias: 45, interactionHistory: [] },
      },
    ];

    const target = manager.activeProjects[0];
    target.phase = 'distribution';
    target.releaseWeek = manager.currentWeek + 4;
    const events: string[] = [];

    (manager as unknown as { processRivalSignatureMoves: (events: string[]) => void }).processRivalSignatureMoves(events);

    expect(manager.rivals[0].upcomingReleases.length).toBeGreaterThan(0);
    expect(manager.rivals[0].upcomingReleases[0].releaseWeek).toBe(target.releaseWeek);
    expect(events.some((entry) => entry.includes('tentpole'))).toBe(true);
    expect(manager.decisionQueue.some((item) => item.title.includes('Counterplay'))).toBe(true);
    expect(manager.storyFlags.rival_tentpole_threat).toBeGreaterThan(0);
  });

  it('clears counterplay flag on expiry so future counterplay can re-queue', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, rivalRng: () => 0 });
    manager.rivals = [
      {
        id: 'r-1',
        name: 'Test Blockbuster',
        personality: 'blockbusterFactory',
        studioHeat: 70,
        activeReleases: [],
        upcomingReleases: [],
        lockedTalentIds: [],
        memory: { hostility: 55, respect: 52, retaliationBias: 50, cooperationBias: 45, interactionHistory: [] },
      },
    ];
    const target = manager.activeProjects[0];
    target.phase = 'distribution';
    target.releaseWeek = manager.currentWeek + 4;

    const events: string[] = [];
    (manager as unknown as { processRivalSignatureMoves: (events: string[]) => void }).processRivalSignatureMoves(events);

    expect(manager.storyFlags.rival_tentpole_threat).toBeGreaterThan(0);
    expect(manager.decisionQueue.some((item) => item.title.includes('Counterplay'))).toBe(true);

    const expiryEvents: string[] = [];
    (manager as unknown as { tickDecisionExpiry: (events: string[]) => void }).tickDecisionExpiry(expiryEvents);
    (manager as unknown as { tickDecisionExpiry: (events: string[]) => void }).tickDecisionExpiry(expiryEvents);

    expect(manager.storyFlags.rival_tentpole_threat).toBeUndefined();
    expect(manager.decisionQueue.some((item) => item.title.includes('Counterplay'))).toBe(false);

    (manager as unknown as { processRivalSignatureMoves: (events: string[]) => void }).processRivalSignatureMoves(events);
    expect(manager.decisionQueue.some((item) => item.title.includes('Counterplay'))).toBe(true);
  });

  it('decrements stacked counterplay flags one layer at a time on expiry', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, rivalRng: () => 0 });
    manager.storyFlags.rival_tentpole_threat = 2;
    manager.decisionQueue.push({
      id: 'stacked-flag-decision',
      projectId: null,
      category: 'marketing',
      title: 'Counterplay: Stacked Threat',
      body: 'test',
      weeksUntilExpiry: 1,
      onExpireClearFlag: 'rival_tentpole_threat',
      options: [
        {
          id: 'stacked-flag-option',
          label: 'test',
          preview: 'test',
          cashDelta: 0,
          scriptQualityDelta: 0,
          hypeDelta: 0,
        },
      ],
    });

    const expiryEvents: string[] = [];
    (manager as unknown as { tickDecisionExpiry: (events: string[]) => void }).tickDecisionExpiry(expiryEvents);
    (manager as unknown as { tickDecisionExpiry: (events: string[]) => void }).tickDecisionExpiry(expiryEvents);
    expect(manager.storyFlags.rival_tentpole_threat).toBe(1);

    manager.decisionQueue.push({
      id: 'stacked-flag-decision-2',
      projectId: null,
      category: 'marketing',
      title: 'Counterplay: Stacked Threat 2',
      body: 'test',
      weeksUntilExpiry: 1,
      onExpireClearFlag: 'rival_tentpole_threat',
      options: [
        {
          id: 'stacked-flag-option-2',
          label: 'test',
          preview: 'test',
          cashDelta: 0,
          scriptQualityDelta: 0,
          hypeDelta: 0,
        },
      ],
    });
    (manager as unknown as { tickDecisionExpiry: (events: string[]) => void }).tickDecisionExpiry(expiryEvents);
    (manager as unknown as { tickDecisionExpiry: (events: string[]) => void }).tickDecisionExpiry(expiryEvents);
    expect(manager.storyFlags.rival_tentpole_threat).toBeUndefined();
  });
});

