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
});
