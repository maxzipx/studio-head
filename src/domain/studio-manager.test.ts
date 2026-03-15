import { describe, expect, it } from 'vitest';

import { TALENT_LIFECYCLE, TALENT_MARKET_RULES } from './balance-constants';
import { createSeedScriptMarket } from './seeds';
import { buildOperationalCrisisForManager } from './studio-manager.events';
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

  it('advances two weeks by default', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 1, rivalRng: () => 1 });
    const startingWeek = manager.currentWeek;

    const summary = manager.endTurn();

    expect(manager.currentWeek).toBe(startingWeek + 2);
    expect(summary.week).toBe(manager.currentWeek);
    expect(summary.events.length).toBeGreaterThan(0);
  });

  it('pauses the fixed two-week turn when a blocking crisis appears after week one', () => {
    const manager = new StudioManager({ crisisRng: () => 0, eventRng: () => 1, rivalRng: () => 1 });
    const startingWeek = manager.currentWeek;

    const summary = manager.endTurn();

    expect(manager.currentWeek).toBe(startingWeek + 1);
    expect(summary.hasPendingCrises).toBe(true);
    expect(summary.events.some((entry) => entry.includes('Turn paused'))).toBe(true);
  });

  it('uses a fixed two-week turn length', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95 });
    expect(manager.turnLengthWeeks).toBe(2);
  });

  it('completes founding setup by committing specialization and founding profile immediately', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, startWithSeedProjects: false, includeOpeningDecisions: false });

    const result = manager.completeFoundingSetup({
      specialization: 'prestige',
      foundingProfile: 'culturalBrand',
    });

    expect(result.success).toBe(true);
    expect(result.message).toBe('Studio charter set.');
    expect(manager.studioSpecialization).toBe('prestige');
    expect(manager.pendingSpecialization).toBe('prestige');
    expect(manager.specializationCommittedWeek).toBe(manager.currentWeek);
    expect(manager.foundingProfile).toBe('culturalBrand');
    expect(manager.needsFoundingSetup).toBe(false);
    expect(manager.foundingSetupCompletedWeek).toBe(manager.currentWeek);
    expect(manager.studioChronicle[0]?.type).toBe('studioFounding');
  });

  it('refuses to complete founding setup more than once', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, startWithSeedProjects: false, includeOpeningDecisions: false });

    manager.completeFoundingSetup({
      specialization: 'balanced',
      foundingProfile: 'starDriven',
    });
    const second = manager.completeFoundingSetup({
      specialization: 'indie',
      foundingProfile: 'dataDriven',
    });

    expect(second.success).toBe(false);
    expect(second.message).toContain('already set');
    expect(manager.studioSpecialization).toBe('balanced');
    expect(manager.foundingProfile).toBe('starDriven');
  });

  it('founds the animation division once and deducts the unlock cost', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95 });
    const cashBefore = manager.cash;

    const result = manager.foundAnimationDivision();

    expect(result.success).toBe(true);
    expect(result.message).toBe('Animation Division founded.');
    expect(manager.animationDivisionUnlocked).toBe(true);
    expect(manager.cash).toBe(cashBefore - 8_000_000);
  });

  it('refuses to found the animation division twice', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95 });
    manager.foundAnimationDivision();

    const result = manager.foundAnimationDivision();

    expect(result.success).toBe(false);
    expect(result.message).toContain('already founded');
  });

  it('refuses to found the animation division without enough cash', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95 });
    manager.cash = 7_999_999;

    const result = manager.foundAnimationDivision();

    expect(result.success).toBe(false);
    expect(result.message).toContain('8M needed');
    expect(manager.animationDivisionUnlocked).toBe(false);
  });

  it('applies recurring scale overhead every 13 weeks based on tier and capacity', () => {
    const manager = new StudioManager({
      crisisRng: () => 0.95,
      eventRng: () => 0.99,
      rivalRng: () => 0.99,
      negotiationRng: () => 0.99,
      startWithSeedProjects: false,
      includeOpeningDecisions: false,
    });
    manager.currentWeek = 14;
    manager.lastScaleOverheadWeek = 1;
    const expectedCost = manager.getScaleOverheadCost();
    const cashBefore = manager.cash;

    const summary = manager.endWeek();

    expect(manager.cash).toBe(cashBefore - expectedCost);
    expect(manager.lastScaleOverheadWeek).toBe(14);
    expect(summary.events.some((entry) => entry.includes('Scale overhead applied'))).toBe(true);
  });

  it('keeps the tutorial ineligible until founding setup is complete', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, startWithSeedProjects: false, includeOpeningDecisions: false });

    expect(manager.isTutorialEligible()).toBe(false);

    const advance = manager.advanceTutorial();
    expect(advance.success).toBe(false);
    expect(manager.tutorialState).toBe('hqIntro');
  });

  it('activates the HQ tutorial when founding setup completes', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, startWithSeedProjects: false, includeOpeningDecisions: false });

    manager.completeFoundingSetup({ specialization: 'indie', foundingProfile: 'dataDriven' });

    expect(manager.isTutorialEligible()).toBe(true);
    expect(manager.tutorialState).toBe('hqIntro');
    expect(manager.tutorialCompleted).toBe(false);
    expect(manager.tutorialDismissed).toBe(false);
  });

  it('advances tutorial steps in sequence through firstProject without requiring a created film', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, startWithSeedProjects: false, includeOpeningDecisions: false });
    manager.completeFoundingSetup({ specialization: 'balanced', foundingProfile: 'starDriven' });

    expect(manager.advanceTutorial().success).toBe(true);
    expect(manager.tutorialState).toBe('strategy');
    expect(manager.advanceTutorial().success).toBe(true);
    expect(manager.tutorialState).toBe('firstProject');

    const advanced = manager.advanceTutorial();
    expect(advanced.success).toBe(true);
    expect(manager.tutorialState).toBe('marketing');
  });

  it('dismisses and restarts tutorial state consistently', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, startWithSeedProjects: false, includeOpeningDecisions: false });
    manager.completeFoundingSetup({ specialization: 'balanced', foundingProfile: 'culturalBrand' });

    const dismissed = manager.dismissTutorial();
    expect(dismissed.success).toBe(true);
    expect(manager.tutorialDismissed).toBe(true);
    expect(manager.tutorialCompleted).toBe(false);
    expect(manager.tutorialState).toBe('complete');

    const restarted = manager.restartTutorial();
    expect(restarted.success).toBe(true);
    expect(manager.tutorialDismissed).toBe(false);
    expect(manager.tutorialCompleted).toBe(false);
    expect(manager.tutorialState).toBe('hqIntro');
  });

  it('refuses to dismiss tutorial when it is not active', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, startWithSeedProjects: false, includeOpeningDecisions: false });

    const result = manager.dismissTutorial();

    expect(result.success).toBe(false);
    expect(result.message).toContain('not currently active');
    expect(manager.tutorialDismissed).toBe(false);
  });

  it('rejects tutorial restart before founding setup is complete', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, startWithSeedProjects: false, includeOpeningDecisions: false });

    const result = manager.restartTutorial();

    expect(result.success).toBe(false);
    expect(result.message).toContain('founding setup');
  });

  it('advances the tutorial after acquiring the first script project', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, startWithSeedProjects: false, includeOpeningDecisions: false });
    manager.completeFoundingSetup({ specialization: 'balanced', foundingProfile: 'dataDriven' });
    manager.advanceTutorial();
    manager.advanceTutorial();
    expect(manager.tutorialState).toBe('firstProject');

    const script = manager.scriptMarket[0];
    const result = manager.acquireScript(script.id);

    expect(result.success).toBe(true);
    expect(manager.tutorialState).toBe('marketing');
  });

  it('advances the tutorial after opening a first project from owned IP', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0.5, startWithSeedProjects: false, includeOpeningDecisions: false });
    manager.completeFoundingSetup({ specialization: 'balanced', foundingProfile: 'franchiseVision' });
    manager.advanceTutorial();
    manager.advanceTutorial();
    manager.cash = 100_000_000;
    manager.refreshIpMarketplace();
    const ip = manager.ownedIps.find((entry) => !entry.major) ?? manager.ownedIps[0];
    expect(ip).toBeTruthy();

    const rights = manager.acquireIpRights(ip!.id);
    expect(rights.success).toBe(true);

    const developed = manager.developProjectFromIp(ip!.id);

    expect(developed.success).toBe(true);
    expect(manager.tutorialState).toBe('marketing');
  });

  it('marks the tutorial complete after the final step', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95 });
    manager.completeFoundingSetup({ specialization: 'prestige', foundingProfile: 'culturalBrand' });

    expect(manager.advanceTutorial().success).toBe(true);
    expect(manager.advanceTutorial().success).toBe(true);
    expect(manager.advanceTutorial().success).toBe(true);
    expect(manager.advanceTutorial().success).toBe(true);
    expect(manager.advanceTutorial().success).toBe(true);
    expect(manager.advanceTutorial().success).toBe(true);

    expect(manager.tutorialState).toBe('complete');
    expect(manager.tutorialCompleted).toBe(true);
    expect(manager.tutorialDismissed).toBe(false);
  });

  it('gives star-driven studios a modest talent negotiation edge', () => {
    const base = new StudioManager({ crisisRng: () => 0.95, negotiationRng: () => 0.5, talentSeed: 41 });
    const boosted = new StudioManager({ crisisRng: () => 0.95, negotiationRng: () => 0.5, talentSeed: 41 });
    base.completeFoundingSetup({ specialization: 'balanced', foundingProfile: 'none' });
    boosted.completeFoundingSetup({ specialization: 'balanced', foundingProfile: 'starDriven' });

    const baseProject = base.activeProjects.find((project) => project.phase === 'development');
    const boostedProject = boosted.activeProjects.find((project) => project.phase === 'development');
    const baseTalent = base.talentPool.find((talent) => talent.role === 'leadActor');
    const boostedTalent = boosted.talentPool.find((talent) => talent.role === 'leadActor');
    expect(baseProject).toBeTruthy();
    expect(boostedProject).toBeTruthy();
    expect(baseTalent).toBeTruthy();
    expect(boostedTalent).toBeTruthy();

    const baseChance = base.getNegotiationChance(baseTalent!.id, baseProject!.id) ?? 0;
    const boostedChance = boosted.getNegotiationChance(boostedTalent!.id, boostedProject!.id) ?? 0;

    expect(boostedChance).toBeGreaterThan(baseChance);
  });

  it('gives data-driven studios stronger tracking confidence', () => {
    const base = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0.5, rivalRng: () => 1, talentSeed: 17 });
    const boosted = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0.5, rivalRng: () => 1, talentSeed: 17 });
    base.completeFoundingSetup({ specialization: 'balanced', foundingProfile: 'none' });
    boosted.completeFoundingSetup({ specialization: 'balanced', foundingProfile: 'dataDriven' });

    const baseProject = base.activeProjects[0];
    const boostedProject = boosted.activeProjects[0];
    for (const project of [baseProject, boostedProject]) {
      project.phase = 'distribution';
      project.releaseWeek = 6;
      project.releaseWeekLocked = true;
      project.releaseWindow = 'wideTheatrical';
      project.marketingBudget = 900_000;
      project.studioRevenueShare = 0.6;
    }

    const baseResult = base.runTrackingLeverage(baseProject.id);
    const boostedResult = boosted.runTrackingLeverage(boostedProject.id);

    expect(baseResult.success).toBe(true);
    expect(boostedResult.success).toBe(true);
    expect(boostedProject.trackingConfidence ?? 0).toBeGreaterThan(baseProject.trackingConfidence ?? 0);
    expect((boostedProject.trackingLeverageAmount ?? 0)).toBeGreaterThan(baseProject.trackingLeverageAmount ?? 0);
  });

  it('stops auto-advance when a new decision replaces an expired one at the same queue size', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0, rivalRng: () => 1 });
    (manager as unknown as { eventDeck: unknown[] }).eventDeck = [
      {
        id: 'auto-advance-replacement',
        category: 'operations',
        scope: 'studio',
        title: 'Replacement Event',
        decisionTitle: 'Replacement Decision',
        body: 'replacement',
        cooldownWeeks: 1,
        baseWeight: 10,
        minWeek: 1,
        buildDecision: ({ idFactory }: { idFactory: (prefix: string) => string }) => ({
          id: idFactory('decision'),
          projectId: null,
          title: 'Replacement Decision',
          body: 'replacement',
          weeksUntilExpiry: 2,
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
    manager.decisionQueue = [
      {
        id: 'expiring-decision',
        projectId: null,
        title: 'Expiring Decision',
        body: 'expiring',
        weeksUntilExpiry: 0,
        options: [
          {
            id: 'expiring-opt',
            label: 'Ok',
            preview: 'ok',
            cashDelta: 0,
            scriptQualityDelta: 0,
            hypeDelta: 0,
          },
        ],
      },
    ];

    const result = manager.advanceUntilDecision(1);

    expect(result.success).toBe(true);
    expect(result.reason).toBe('decision');
    expect(result.advancedWeeks).toBe(1);
    expect(manager.decisionQueue.some((item) => item.title === 'Replacement Decision')).toBe(true);
  });

  it('stops auto-advance on the next inbox change using the default limit', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0, rivalRng: () => 1 });
    (manager as unknown as { eventDeck: unknown[] }).eventDeck = [
      {
        id: 'auto-advance-replacement',
        category: 'operations',
        scope: 'studio',
        title: 'Replacement Event',
        decisionTitle: 'Replacement Decision',
        body: 'replacement',
        cooldownWeeks: 1,
        baseWeight: 10,
        minWeek: 1,
        buildDecision: ({ idFactory }: { idFactory: (prefix: string) => string }) => ({
          id: idFactory('decision'),
          projectId: null,
          title: 'Replacement Decision',
          body: 'replacement',
          weeksUntilExpiry: 2,
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
    manager.decisionQueue = [
      {
        id: 'expiring-decision',
        projectId: null,
        title: 'Expiring Decision',
        body: 'expiring',
        weeksUntilExpiry: 0,
        options: [
          {
            id: 'expiring-opt',
            label: 'Ok',
            preview: 'ok',
            cashDelta: 0,
            scriptQualityDelta: 0,
            hypeDelta: 0,
          },
        ],
      },
    ];

    const result = manager.advanceUntilDecision();

    expect(result.success).toBe(true);
    expect(result.reason).toBe('decision');
    expect(result.advancedWeeks).toBe(1);
    expect(manager.currentWeek).toBe(2);
  });

  it('caps auto-advance to 8 weeks when nothing new enters the inbox', () => {
    const manager = new StudioManager({
      crisisRng: () => 0.95,
      eventRng: () => 0.999,
      rivalRng: () => 0.999,
      negotiationRng: () => 0.999,
      startWithSeedProjects: false,
      includeOpeningDecisions: false,
    });
    manager.currentWeek = 4;
    manager.decisionQueue = [];
    manager.inboxNotifications = [];
    manager.pendingReleaseReveals = [];
    manager.pendingFinalReleaseReveals = [];
    manager.activeProjects = [];

    const result = manager.advanceUntilDecision();

    expect(result.success).toBe(true);
    expect(result.reason).toBe('limit');
    expect(result.advancedWeeks).toBe(8);
    expect(manager.currentWeek).toBe(12);
    expect(result.message).toContain('no new inbox change');
  });

  it('blocks endWeek when unresolved crises exist', () => {
    const manager = new StudioManager({ crisisRng: () => 0.0 });
    manager.endWeek();
    expect(manager.pendingCrises.length).toBeGreaterThan(0);

    expect(() => manager.endWeek()).toThrow('Resolve all crises before ending the week.');
  });

  it('allows progression after resolving crisis', () => {
    const manager = new StudioManager({ crisisRng: () => 0.0, rivalRng: () => 0.99 });
    manager.endWeek();

    const crisis = manager.pendingCrises[0];
    const result = manager.resolveCrisis(crisis.id, crisis.options[0].id);

    expect(result.success).toBe(true);
    expect(result.message).toContain('Crisis resolved');
    expect(manager.pendingCrises.length).toBe(0);

    const summary = manager.endWeek();
    expect(summary.week).toBe(manager.currentWeek);
  });

  it('limits fresh crisis generation to one new blocking crisis per turn window', () => {
    const manager = new StudioManager({ crisisRng: () => 0, rivalRng: () => 1 });
    manager.pendingCrises = [];
    manager.generatedCrisisThisTurn = false;
    manager.activeProjects = manager.activeProjects.slice(0, 2);
    for (const project of manager.activeProjects) {
      project.phase = 'production';
      project.productionStatus = 'onTrack';
      project.budget.overrunRisk = 0.6;
    }

    const events: string[] = [];
    manager.eventService.rollForCrises(events);

    expect(manager.pendingCrises.length).toBe(1);
    expect(manager.generatedCrisisThisTurn).toBe(true);
    expect(manager.lastGeneratedCrisisWeek).toBe(manager.currentWeek);

    manager.eventService.rollForCrises(events);
    expect(manager.pendingCrises.length).toBe(1);
  });

  it('reduces immediate back-to-back crisis generation after a recent crisis week', () => {
    const manager = new StudioManager({ crisisRng: () => 0.09, rivalRng: () => 1 });
    const project = manager.activeProjects[0];
    project.phase = 'production';
    project.productionStatus = 'onTrack';
    project.budget.overrunRisk = 0.2;
    manager.pendingCrises = [];
    manager.generatedCrisisThisTurn = false;
    manager.lastGeneratedCrisisWeek = manager.currentWeek - 1;

    const events: string[] = [];
    manager.eventService.rollForCrises(events);

    expect(manager.pendingCrises.length).toBe(0);
    expect(manager.generatedCrisisThisTurn).toBe(false);
  });

  it('resets the per-turn crisis generation flag at the start of a new player turn', () => {
    const manager = new StudioManager({
      crisisRng: () => 0.95,
      eventRng: () => 0.95,
      rivalRng: () => 0.95,
      negotiationRng: () => 0.95,
      startWithSeedProjects: false,
      includeOpeningDecisions: false,
    });
    manager.generatedCrisisThisTurn = true;

    manager.endTurn();

    expect(manager.generatedCrisisThisTurn).toBe(false);
  });

  it('returns a clear failure result when resolving a stale crisis', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95 });
    const result = manager.resolveCrisis('missing-crisis', 'missing-option');

    expect(result.success).toBe(false);
    expect(result.message).toContain('no longer active');
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
    expect(result.message).toContain('Script acquired');
    expect(manager.activeProjects.length).toBe(beforeProjects + 1);
    expect(manager.scriptMarket.length).toBe(beforeScripts - 1);
    const created = manager.activeProjects.find((project) => project.id === result.projectId);
    expect(created).toBeTruthy();
    expect(manager.newlyAcquiredProjectId).toBe(created!.id);
    expect(manager.inboxNotifications[0]?.kind).toBe('scriptAcquired');
    expect(manager.inboxNotifications[0]?.projectId).toBe(created!.id);
    expect(created!.budgetPlan.directorPlanned).toBeGreaterThan(0);
    expect(created!.budgetPlan.castPlannedTotal).toBeGreaterThan(0);
    expect(created!.budgetPlan.castPlannedActor).toBeGreaterThanOrEqual(0);
    expect(created!.budgetPlan.castPlannedActress).toBeGreaterThanOrEqual(0);
  });

  it('randomizes cast requirements with mostly 1-2 slots and rare 3-slot casts', () => {
    const rng = (() => {
      let state = 17;
      return () => {
        state = (state * 1_664_525 + 1_013_904_223) >>> 0;
        return state / 4_294_967_296;
      };
    })();
    const manager = new StudioManager({ crisisRng: rng, eventRng: rng, rivalRng: () => 1, negotiationRng: () => 1 });
    manager.cash = 200_000_000;
    manager.activeProjects = [];
    manager.decisionQueue = [];

    const totals: number[] = [];
    let actressNeededCount = 0;
    for (let i = 0; i < 60; i += 1) {
      if (manager.scriptMarket.length === 0) {
        manager.eventService.refillScriptMarket([]);
      }
      const script = manager.scriptMarket[0];
      const result = manager.acquireScript(script.id);
      expect(result.success).toBe(true);
      const project = manager.activeProjects.find((item) => item.id === result.projectId);
      expect(project).toBeTruthy();
      const total = project!.castRequirements.actorCount + project!.castRequirements.actressCount;
      totals.push(total);
      if (project!.castRequirements.actressCount > 0) actressNeededCount += 1;
      manager.activeProjects = [];
    }

    const threes = totals.filter((count) => count === 3).length;
    expect(totals.every((count) => count >= 1 && count <= 3)).toBe(true);
    expect(actressNeededCount).toBeGreaterThan(0);
    expect(threes).toBeGreaterThan(0);
    expect(threes / totals.length).toBeLessThan(0.25);
  });

  it('updates cast/director committed spend inputs when deals are signed', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, negotiationRng: () => 0 });
    const project = manager.activeProjects.find((item) => item.phase === 'development');
    const director = manager.talentPool.find((item) => item.role === 'director');
    const lead = manager.talentPool.find((item) => item.role === 'leadActor');
    expect(project).toBeTruthy();
    expect(director).toBeTruthy();
    expect(lead).toBeTruthy();

    const attachDirector = manager.negotiateAndAttachTalent(project!.id, director!.id);
    const attachLead = manager.negotiateAndAttachTalent(project!.id, lead!.id);
    expect(attachDirector.success).toBe(true);
    expect(attachLead.success).toBe(true);

    const directorCommitted = director!.salary.base + director!.salary.perksCost;
    const castCommitted = lead!.salary.base + lead!.salary.perksCost;
    expect(project!.directorId).toBe(director!.id);
    expect(project!.castIds).toContain(lead!.id);
    expect(directorCommitted).toBeGreaterThan(0);
    expect(castCommitted).toBeGreaterThan(0);
  });

  it('enforces actor/actress cast requirements for greenlight readiness', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, negotiationRng: () => 0 });
    const project = manager.activeProjects.find((item) => item.phase === 'development');
    const director = manager.talentPool.find((item) => item.role === 'director');
    const actor = manager.talentPool.find((item) => item.role === 'leadActor');
    const actress = manager.talentPool.find((item) => item.role === 'leadActress');
    expect(project).toBeTruthy();
    expect(director).toBeTruthy();
    expect(actor).toBeTruthy();
    expect(actress).toBeTruthy();

    project!.castRequirements = { actorCount: 0, actressCount: 1 };
    project!.scriptQuality = 6.8;
    manager.negotiateAndAttachTalent(project!.id, director!.id);
    manager.negotiateAndAttachTalent(project!.id, actor!.id);

    const blocked = manager.runGreenlightReview(project!.id, true);
    expect(blocked.success).toBe(false);
    expect(blocked.message.toLowerCase()).toContain('not ready');

    manager.negotiateAndAttachTalent(project!.id, actress!.id);
    const approved = manager.runGreenlightReview(project!.id, true);
    expect(approved.success).toBe(true);
  });

  it('starts sequel development from an eligible released project and creates franchise tracking', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95 });
    const baseProject = manager.activeProjects[0];
    baseProject.phase = 'released';
    baseProject.releaseResolved = true;
    baseProject.releaseWeek = manager.currentWeek - 2;
    baseProject.criticalScore = 75;
    baseProject.audienceScore = 79;
    baseProject.projectedROI = 1.6;

    const eligibility = manager.getSequelEligibility(baseProject.id);
    expect(eligibility?.eligible).toBe(true);

    const result = manager.startSequel(baseProject.id);
    expect(result.success).toBe(true);
    expect(result.projectId).toBeTruthy();

    const sequel = manager.activeProjects.find((project) => project.id === result.projectId);
    expect(sequel).toBeTruthy();
    expect(sequel?.phase).toBe('development');
    expect(sequel?.franchiseId).toBeTruthy();
    expect(sequel?.franchiseEpisode).toBe(2);
    expect(sequel?.sequelToProjectId).toBe(baseProject.id);
    expect(sequel?.franchiseCarryoverHype).toBeGreaterThan(0);
    expect(manager.franchises.length).toBe(1);
    expect(manager.franchises[0].activeProjectId).toBe(sequel?.id);
  });

  it('gives franchise-vision studios a momentum edge when spinning up sequels', () => {
    const base = new StudioManager({ crisisRng: () => 0.95, talentSeed: 88 });
    const boosted = new StudioManager({ crisisRng: () => 0.95, talentSeed: 88 });
    base.completeFoundingSetup({ specialization: 'balanced', foundingProfile: 'none' });
    boosted.completeFoundingSetup({ specialization: 'balanced', foundingProfile: 'franchiseVision' });

    const baseProject = base.activeProjects[0];
    const boostedProject = boosted.activeProjects[0];
    for (const project of [baseProject, boostedProject]) {
      project.phase = 'released';
      project.releaseResolved = true;
      project.releaseWeek = 3;
      project.criticalScore = 75;
      project.audienceScore = 79;
      project.projectedROI = 1.6;
    }

    const baseResult = base.startSequel(baseProject.id);
    const boostedResult = boosted.startSequel(boostedProject.id);

    expect(baseResult.success).toBe(true);
    expect(boostedResult.success).toBe(true);
    expect(boosted.franchises[0]?.momentum ?? 0).toBeGreaterThan(base.franchises[0]?.momentum ?? 0);
  });

  it('blocks opening a second sequel while one franchise project is still active', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95 });
    const baseProject = manager.activeProjects[0];
    baseProject.phase = 'released';
    baseProject.releaseResolved = true;
    baseProject.releaseWeek = manager.currentWeek - 1;
    baseProject.criticalScore = 70;
    baseProject.audienceScore = 73;

    const first = manager.startSequel(baseProject.id);
    expect(first.success).toBe(true);

    const second = manager.startSequel(baseProject.id);
    expect(second.success).toBe(false);
    expect(second.message).toContain('Finish');
  });

  it('applies franchise strategy and returning package effects to sequel projections', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95 });
    const baseProject = manager.activeProjects[0];
    const director = manager.talentPool.find((talent) => talent.role === 'director');
    const lead = manager.talentPool.find((talent) => talent.role === 'leadActor');
    expect(director).toBeTruthy();
    expect(lead).toBeTruthy();

    baseProject.phase = 'released';
    baseProject.releaseResolved = true;
    baseProject.releaseWeek = manager.currentWeek - 2;
    baseProject.criticalScore = 78;
    baseProject.audienceScore = 80;
    baseProject.projectedROI = 1.7;
    baseProject.directorId = director!.id;
    baseProject.castIds = [lead!.id];

    const sequelStart = manager.startSequel(baseProject.id);
    expect(sequelStart.success).toBe(true);
    const sequel = manager.activeProjects.find((project) => project.id === sequelStart.projectId);
    expect(sequel).toBeTruthy();

    const baseModifiers = manager.getFranchiseProjectionModifiers(sequel!.id);
    expect(baseModifiers?.strategy).toBe('balanced');
    expect(baseModifiers?.returningDirector).toBe(false);
    expect(baseModifiers?.returningCastCount).toBe(0);

    sequel!.directorId = director!.id;
    sequel!.castIds = [lead!.id];
    const returningModifiers = manager.getFranchiseProjectionModifiers(sequel!.id);
    expect(returningModifiers?.returningDirector).toBe(true);
    expect((returningModifiers?.returningCastCount ?? 0)).toBeGreaterThan(0);

    const projectionBefore = manager.getProjectedForProject(sequel!.id);
    const cashBefore = manager.cash;
    const setStrategy = manager.setFranchiseStrategy(sequel!.id, 'reinvention');
    expect(setStrategy.success).toBe(true);
    expect(manager.cash).toBeLessThan(cashBefore);
    expect(sequel!.franchiseStrategy).toBe('reinvention');
    const projectionAfter = manager.getProjectedForProject(sequel!.id);
    expect((projectionAfter?.critical ?? 0)).toBeGreaterThan(projectionBefore?.critical ?? 0);

    const locked = manager.setFranchiseStrategy(sequel!.id, 'safe');
    expect(locked.success).toBe(false);
    expect(locked.message).toContain('locked');
  });

  it('blocks franchise strategy changes on non-sequel projects', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95 });
    const baseProject = manager.activeProjects.find((project) => project.phase === 'development');
    expect(baseProject).toBeTruthy();

    const result = manager.setFranchiseStrategy(baseProject!.id, 'safe');
    expect(result.success).toBe(false);
    expect(result.message).toContain('sequel');
  });

  it('scales franchise penalties by episode depth and release cadence', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95 });
    const baseProject = manager.activeProjects[0];
    baseProject.phase = 'released';
    baseProject.releaseResolved = true;
    baseProject.releaseWeek = manager.currentWeek - 2;
    baseProject.criticalScore = 78;
    baseProject.audienceScore = 82;
    baseProject.projectedROI = 1.75;

    const sequelStart = manager.startSequel(baseProject.id);
    expect(sequelStart.success).toBe(true);
    const sequel = manager.activeProjects.find((project) => project.id === sequelStart.projectId);
    expect(sequel).toBeTruthy();

    sequel!.releaseWeek = manager.currentWeek + 30;
    const baseline = manager.getFranchiseProjectionModifiers(sequel!.id);
    expect(baseline).toBeTruthy();

    sequel!.franchiseEpisode = 4;
    sequel!.releaseWeek = manager.currentWeek + 6;
    const pressured = manager.getFranchiseProjectionModifiers(sequel!.id);
    expect(pressured).toBeTruthy();
    expect((pressured?.openingPenaltyPct ?? 0)).toBeGreaterThan((baseline?.openingPenaltyPct ?? 0));
    expect((pressured?.roiPenaltyPct ?? 0)).toBeGreaterThan((baseline?.roiPenaltyPct ?? 0));
    expect((pressured?.openingMultiplier ?? 1)).toBeLessThan(baseline?.openingMultiplier ?? 1);
    expect((pressured?.roiMultiplier ?? 1)).toBeLessThan(baseline?.roiMultiplier ?? 1);
    expect((pressured?.cadencePressure ?? 0)).toBeGreaterThanOrEqual(baseline?.cadencePressure ?? 0);
  });

  it('runs repeatable franchise ops actions and exposes status with active flags', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95 });
    const baseProject = manager.activeProjects[0];
    baseProject.phase = 'released';
    baseProject.releaseResolved = true;
    baseProject.releaseWeek = manager.currentWeek - 2;
    baseProject.criticalScore = 74;
    baseProject.audienceScore = 77;
    baseProject.projectedROI = 1.45;
    manager.cash = 5_000_000;

    const sequelStart = manager.startSequel(baseProject.id);
    expect(sequelStart.success).toBe(true);
    const sequel = manager.activeProjects.find((project) => project.id === sequelStart.projectId);
    expect(sequel).toBeTruthy();
    sequel!.phase = 'development';

    const statusBefore = manager.getFranchiseStatus(sequel!.id);
    expect(statusBefore).toBeTruthy();
    expect(statusBefore?.nextBrandResetCost).toBe(150_000);

    const reset = manager.runFranchiseBrandReset(sequel!.id);
    expect(reset.success).toBe(true);
    const afterReset = manager.getFranchiseStatus(sequel!.id);
    expect(afterReset?.brandResetCount).toBe(1);
    expect(afterReset?.nextBrandResetCost).toBe(190_000);

    const campaign = manager.runFranchiseLegacyCastingCampaign(sequel!.id);
    expect(campaign.success).toBe(true);
    const afterCampaign = manager.getFranchiseStatus(sequel!.id);
    expect(afterCampaign?.legacyCastingCampaignCount).toBe(1);
    expect(afterCampaign?.nextLegacyCastingCampaignCost).toBe(165_000);

    sequel!.releaseWeek = manager.currentWeek + 5;
    const beforeHiatus = manager.getFranchiseStatus(sequel!.id);
    const hiatus = manager.runFranchiseHiatusPlanning(sequel!.id);
    expect(hiatus.success).toBe(true);
    const afterHiatus = manager.getFranchiseStatus(sequel!.id);
    expect((afterHiatus?.cadenceBufferWeeks ?? 0)).toBeGreaterThan(beforeHiatus?.cadenceBufferWeeks ?? 0);
    expect((afterHiatus?.modifiers.cadencePressure ?? 0)).toBeLessThanOrEqual(beforeHiatus?.modifiers.cadencePressure ?? 0);
    expect(afterHiatus?.activeFlags.some((flag) => flag.includes('Hiatus Planning'))).toBe(true);
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

  it('blocks opening negotiations when talent memory is hostile with high grudge', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, negotiationRng: () => 0.2 });
    const project = manager.activeProjects.find((item) => item.phase === 'development');
    const lead = manager.talentPool.find((item) => item.role === 'leadActor');
    expect(project).toBeTruthy();
    expect(lead).toBeTruthy();

    lead!.relationshipMemory.trust = 18;
    lead!.relationshipMemory.loyalty = 20;
    lead!.relationshipMemory.interactionHistory = [
      { week: manager.currentWeek, kind: 'negotiationHardline', trustDelta: -3, loyaltyDelta: -2, note: 'hardline' },
      { week: manager.currentWeek, kind: 'quickCloseFailed', trustDelta: -3, loyaltyDelta: -3, note: 'quick-close miss' },
      { week: manager.currentWeek, kind: 'projectAbandoned', trustDelta: -4, loyaltyDelta: -4, note: 'abandoned project' },
    ];

    const chance = manager.getNegotiationChance(lead!.id, project!.id);
    expect(chance).toBe(0);

    const opened = manager.startTalentNegotiation(project!.id, lead!.id);
    expect(opened.success).toBe(false);
    expect(opened.message.toLowerCase()).toContain('refused');
    expect(lead!.availability).toBe('available');
  });

  it('applies grudge-based chance penalty after repeated negative interactions', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, negotiationRng: () => 0.2 });
    const project = manager.activeProjects.find((item) => item.phase === 'development');
    const lead = manager.talentPool.find((item) => item.role === 'leadActor');
    expect(project).toBeTruthy();
    expect(lead).toBeTruthy();

    const baselineChance = manager.getNegotiationChance(lead!.id, project!.id) ?? 0;
    manager.recordTalentInteraction(lead!, {
      kind: 'negotiationHardline',
      trustDelta: -2,
      loyaltyDelta: -1,
      note: 'hardline 1',
      projectId: project!.id,
    });
    manager.recordTalentInteraction(lead!, {
      kind: 'quickCloseFailed',
      trustDelta: -3,
      loyaltyDelta: -2,
      note: 'hardline 2',
      projectId: project!.id,
    });

    const afterPenaltyChance = manager.getNegotiationChance(lead!.id, project!.id) ?? 0;
    expect(afterPenaltyChance).toBeLessThan(baselineChance);
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

  it('keeps negotiation open after first failed weekly check when rounds remain', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, negotiationRng: () => 0.99, eventRng: () => 1, rivalRng: () => 1 });
    const project = manager.activeProjects.find((item) => item.phase === 'development');
    const lead = manager.talentPool.find((item) => item.role === 'leadActor');
    expect(project).toBeTruthy();
    expect(lead).toBeTruthy();

    const opened = manager.startTalentNegotiationRound(project!.id, lead!.id, 'sweetenSalary');
    expect(opened.success).toBe(true);

    const summary = manager.endWeek();
    expect(summary.events.some((entry) => entry.includes('negotiation remains open'))).toBe(true);
    expect(manager.playerNegotiations.some((entry) => entry.projectId === project!.id && entry.talentId === lead!.id)).toBe(true);
    expect(lead!.availability).toBe('inNegotiation');
  });

  it('repairs stale availability drift instead of dropping a countered negotiation', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, negotiationRng: () => 0.99, eventRng: () => 1, rivalRng: () => 1 });
    const project = manager.activeProjects.find((item) => item.phase === 'development');
    const lead = manager.talentPool.find((item) => item.role === 'leadActor');
    expect(project).toBeTruthy();
    expect(lead).toBeTruthy();

    const opened = manager.startTalentNegotiationRound(project!.id, lead!.id, 'sweetenSalary');
    expect(opened.success).toBe(true);
    lead!.availability = 'available';

    const summary = manager.endWeek();
    expect(summary.events.some((entry) => entry.includes('negotiation remains open'))).toBe(true);
    expect(manager.playerNegotiations.some((entry) => entry.projectId === project!.id && entry.talentId === lead!.id)).toBe(true);
    expect(lead!.availability).toBe('inNegotiation');
  });

  it('removes only resolved negotiation entries even when stale duplicates share a talent id', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, negotiationRng: () => 0.99, eventRng: () => 1, rivalRng: () => 1 });
    const project = manager.activeProjects.find((item) => item.phase === 'development');
    const lead = manager.talentPool.find((item) => item.role === 'leadActor');
    expect(project).toBeTruthy();
    expect(lead).toBeTruthy();

    const opened = manager.startTalentNegotiationRound(project!.id, lead!.id, 'sweetenSalary');
    expect(opened.success).toBe(true);
    manager.playerNegotiations.push({
      talentId: lead!.id,
      projectId: 'missing-project',
      openedWeek: manager.currentWeek,
      rounds: 1,
      holdLineCount: 0,
      offerSalaryMultiplier: 1,
      offerBackendPoints: lead!.salary.backendPoints,
      offerPerksBudget: lead!.salary.perksCost,
    });

    manager.endWeek();
    expect(manager.playerNegotiations.some((entry) => entry.projectId === project!.id && entry.talentId === lead!.id)).toBe(true);
    expect(manager.playerNegotiations.some((entry) => entry.projectId === 'missing-project' && entry.talentId === lead!.id)).toBe(false);
  });

  it('does not drop an active countered negotiation when a duplicate key entry resolves', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, negotiationRng: () => 0.99, eventRng: () => 1, rivalRng: () => 1 });
    const project = manager.activeProjects.find((item) => item.phase === 'development');
    const lead = manager.talentPool.find((item) => item.role === 'leadActor');
    expect(project).toBeTruthy();
    expect(lead).toBeTruthy();

    const opened = manager.startTalentNegotiationRound(project!.id, lead!.id, 'sweetenSalary');
    expect(opened.success).toBe(true);
    manager.playerNegotiations.push({
      talentId: lead!.id,
      projectId: project!.id,
      openedWeek: manager.currentWeek,
      rounds: 4,
      holdLineCount: 2,
      offerSalaryMultiplier: 1,
      offerBackendPoints: lead!.salary.backendPoints,
      offerPerksBudget: lead!.salary.perksCost,
    });

    const summary = manager.endWeek();
    expect(summary.events.some((entry) => entry.includes('negotiation remains open'))).toBe(true);
    expect(manager.playerNegotiations.some((entry) => entry.projectId === project!.id && entry.talentId === lead!.id)).toBe(true);
  });

  it('retains negotiations whenever weekly summary reports a counter', () => {
    for (let seed = 1; seed <= 120; seed += 1) {
      const manager = new StudioManager({
        crisisRng: () => 0.95,
        eventRng: () => 0.95,
        rivalRng: () => 0.95,
        negotiationRng: () => 0.99,
        talentSeed: seed,
        startWithSeedProjects: false,
        includeOpeningDecisions: false,
      });

      const script = manager.scriptMarket[0];
      if (!script) continue;
      const acquired = manager.acquireScript(script.id);
      if (!acquired.success || !acquired.projectId) continue;
      const project = manager.activeProjects.find((item) => item.id === acquired.projectId);
      if (!project || project.phase !== 'development') continue;

      const director = manager.talentPool.find((item) => item.role === 'director' && item.availability === 'available');
      if (!director) continue;
      const opened = manager.startTalentNegotiationRound(project.id, director.id, 'sweetenSalary');
      if (!opened.success) continue;

      const summary = manager.endWeek();
      const counterEvent = summary.events.find((entry) => entry.includes('countered on') && entry.includes(project.title));
      if (!counterEvent) continue;

      expect(
        manager.playerNegotiations.some((entry) => entry.projectId === project.id && entry.talentId === director.id)
      ).toBe(true);
    }
  });

  it('retains counter-offer negotiation after endTurn (not just endWeek)', () => {
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

    const opened = manager.startTalentNegotiationRound(project!.id, lead!.id, 'sweetenSalary');
    expect(opened.success).toBe(true);
    expect(manager.playerNegotiations.length).toBe(1);

    const summary = manager.endTurn();
    const hasCounter = summary.events.some((e) => e.includes('countered'));
    expect(hasCounter).toBe(true);
    expect(manager.playerNegotiations.length).toBeGreaterThan(0);
    expect(manager.playerNegotiations.some((e) => e.talentId === lead!.id)).toBe(true);
    expect(lead!.availability).toBe('inNegotiation');
  });

  it('retains counter-offer negotiation after endTurn with turnLengthWeeks=2', () => {
    const manager = new StudioManager({
      crisisRng: () => 0.95,
      negotiationRng: () => 0.99,
      eventRng: () => 1,
      rivalRng: () => 1,
    });
    (manager as any).turnLengthWeeks = 2;
    const project = manager.activeProjects.find((item) => item.phase === 'development');
    const lead = manager.talentPool.find((item) => item.role === 'leadActor');
    expect(project).toBeTruthy();
    expect(lead).toBeTruthy();

    const opened = manager.startTalentNegotiationRound(project!.id, lead!.id, 'sweetenSalary');
    expect(opened.success).toBe(true);

    manager.endTurn();
    // After 2 weeks of processing, negotiation should still be open (counter on both passes)
    expect(manager.playerNegotiations.some((e) => e.talentId === lead!.id)).toBe(true);
    expect(lead!.availability).toBe('inNegotiation');
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

  it('applies specialization modifiers only after end-turn commitment', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, negotiationRng: () => 0, eventRng: () => 1, rivalRng: () => 1 });
    const project = manager.activeProjects[0];
    project.releaseWeek = manager.currentWeek + 8;

    const base = manager.getProjectedForProject(project.id);
    expect(base).toBeTruthy();

    manager.setStudioSpecialization('blockbuster');
    const preCommit = manager.getProjectedForProject(project.id);
    expect(preCommit).toBeTruthy();
    expect((preCommit?.openingHigh ?? 0)).toBeCloseTo(base?.openingHigh ?? 0, 4);
    manager.endTurn();
    const blockbuster = manager.getProjectedForProject(project.id);
    expect(blockbuster).toBeTruthy();
    expect((blockbuster?.openingHigh ?? 0)).toBeGreaterThan(base?.openingHigh ?? 0);

    const cashBeforeSecondPivot = manager.cash;
    manager.setStudioSpecialization('prestige');
    manager.endTurn();
    const prestige = manager.getProjectedForProject(project.id);
    expect(prestige).toBeTruthy();
    expect((prestige?.critical ?? 0)).toBeGreaterThan(base?.critical ?? 0);
    expect(cashBeforeSecondPivot - manager.cash).toBeGreaterThanOrEqual(1_000_000);
  });

  it('settles specialization cost on end-turn with first commitment free', () => {
    const manager = new StudioManager({ crisisRng: () => 1, eventRng: () => 1, rivalRng: () => 1 });
    manager.activeProjects = [];
    manager.decisionQueue = [];
    manager.cash = 3_000_000;

    const cashBeforeFirst = manager.cash;
    manager.setStudioSpecialization('blockbuster');
    manager.endTurn();
    expect(manager.studioSpecialization).toBe('blockbuster');
    expect(cashBeforeFirst - manager.cash).toBe(0);

    const cashBeforeSecond = manager.cash;
    manager.setStudioSpecialization('prestige');
    manager.endTurn();
    expect(manager.studioSpecialization).toBe('prestige');
    expect(cashBeforeSecond - manager.cash).toBe(1_000_000);
  });

  it('charges once for final specialization delta after multiple in-turn changes', () => {
    const manager = new StudioManager({ crisisRng: () => 1, eventRng: () => 1, rivalRng: () => 1 });
    manager.activeProjects = [];
    manager.decisionQueue = [];
    manager.cash = 4_000_000;
    manager.setStudioSpecialization('blockbuster');
    manager.endTurn();
    expect(manager.studioSpecialization).toBe('blockbuster');

    const before = manager.cash;
    manager.setStudioSpecialization('prestige');
    manager.setStudioSpecialization('indie');
    manager.endTurn();
    expect(manager.studioSpecialization).toBe('indie');
    expect(before - manager.cash).toBe(1_000_000);
  });

  it('does not charge when staged specialization is reverted before end-turn', () => {
    const manager = new StudioManager({ crisisRng: () => 1, eventRng: () => 1, rivalRng: () => 1 });
    manager.activeProjects = [];
    manager.decisionQueue = [];
    manager.cash = 4_000_000;
    manager.setStudioSpecialization('blockbuster');
    manager.endTurn();
    expect(manager.studioSpecialization).toBe('blockbuster');

    const before = manager.cash;
    manager.setStudioSpecialization('prestige');
    manager.setStudioSpecialization('blockbuster');
    manager.endTurn();
    expect(manager.studioSpecialization).toBe('blockbuster');
    expect(before - manager.cash).toBe(0);
  });

  it('keeps committed specialization when end-turn settlement lacks cash', () => {
    const manager = new StudioManager({ crisisRng: () => 1, eventRng: () => 1, rivalRng: () => 1 });
    manager.activeProjects = [];
    manager.decisionQueue = [];
    manager.cash = 2_000_000;
    manager.setStudioSpecialization('blockbuster');
    manager.endTurn();
    expect(manager.studioSpecialization).toBe('blockbuster');

    manager.cash = 500_000;
    manager.setStudioSpecialization('prestige');
    const summary = manager.endTurn();

    expect(manager.studioSpecialization).toBe('blockbuster');
    expect(manager.pendingSpecialization).toBe('blockbuster');
    expect(summary.events.some((event) => event.includes('failed'))).toBe(true);
    expect(manager.cash).toBe(500_000);
  });

  it('scales script sprint quality gain with development department level', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95 });
    const project = manager.activeProjects.find((item) => item.phase === 'development');
    expect(project).toBeTruthy();
    manager.cash = 10_000_000;
    project!.scriptQuality = 6.4;

    manager.investDepartment('development');
    manager.investDepartment('development');
    const before = project!.scriptQuality;
    const result = manager.runScriptDevelopmentSprint(project!.id);
    expect(result.success).toBe(true);
    expect(project!.scriptQuality - before).toBeGreaterThan(0.5);
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
    manager.runGreenlightReview(project!.id, true);
    result = manager.advanceProjectPhase(project!.id);
    expect(result.success).toBe(true);
    expect(project!.phase).toBe('preProduction');
  });

  it('does not spam duplicate event titles in same queue', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0.1, rivalRng: () => 0.99 });

    manager.endWeek();
    manager.endWeek();
    manager.endWeek();

    const titles = manager.decisionQueue.map((item) => item.title);
    const unique = new Set(titles);
    expect(unique.size).toBe(titles.length);
  });

  it('respects flag-gated events before and after prerequisite flag is set', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0, rivalRng: () => 0.99 });
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
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0, rivalRng: () => 0.99 });
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

    baseManager.lifecycleService.generateDistributionOffers(projectA.id);
    boostedManager.lifecycleService.generateDistributionOffers(projectB.id);

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
    manager.runGreenlightReview(project!.id, true);
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

  it('biases offer strength toward active exclusive distribution partner', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, negotiationRng: () => 0 });
    const project = manager.activeProjects.find((item) => item.phase === 'development');
    const director = manager.talentPool.find((item) => item.role === 'director');
    const lead = manager.talentPool.find((item) => item.role === 'leadActor');
    expect(project).toBeTruthy();
    expect(director).toBeTruthy();
    expect(lead).toBeTruthy();

    manager.signExclusiveDistributionPartner('Aster Peak Pictures');
    manager.negotiateAndAttachTalent(project!.id, director!.id);
    manager.negotiateAndAttachTalent(project!.id, lead!.id);
    manager.runGreenlightReview(project!.id, true);
    project!.marketingBudget = 1_000_000;

    manager.advanceProjectPhase(project!.id);
    project!.scheduledWeeksRemaining = 0;
    manager.advanceProjectPhase(project!.id);
    project!.scheduledWeeksRemaining = 0;
    manager.advanceProjectPhase(project!.id);
    project!.scheduledWeeksRemaining = 0;
    manager.advanceProjectPhase(project!.id);

    const offers = manager.getOffersForProject(project!.id);
    const exclusive = offers.find((offer) => offer.partner === 'Aster Peak Pictures');
    const nonExclusive = offers.find((offer) => offer.partner !== 'Aster Peak Pictures');
    expect(exclusive).toBeTruthy();
    expect(nonExclusive).toBeTruthy();
    expect((exclusive?.minimumGuarantee ?? 0)).toBeGreaterThan(nonExclusive?.minimumGuarantee ?? 0);
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
    manager.runGreenlightReview(project!.id, true);
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
    project.releaseWeekLocked = true;

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

  it('starts with a limited script market instead of loading the entire catalog', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0.42 });

    expect(manager.scriptMarket.length).toBeGreaterThan(0);
    expect(manager.scriptMarket.length).toBeLessThanOrEqual(4);
  });

  it('excludes animation scripts from the market before the animation division is unlocked', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0, startWithSeedProjects: false, includeOpeningDecisions: false });
    manager.scriptMarket = [];
    for (const genre of Object.keys(manager.genreCycles) as (keyof typeof manager.genreCycles)[]) {
      manager.genreCycles[genre].demand = genre === 'animation' ? 1.4 : 0.72;
      manager.genreCycles[genre].momentum = 0;
      manager.genreCycles[genre].shockDirection = null;
      manager.genreCycles[genre].shockLabel = null;
      manager.genreCycles[genre].shockStrength = null;
      manager.genreCycles[genre].shockUntilWeek = null;
    }

    manager.eventService.refillScriptMarket([]);

    expect(manager.scriptMarket.length).toBeGreaterThan(0);
    expect(manager.scriptMarket.every((script) => script.genre !== 'animation')).toBe(true);
  });

  it('allows animation scripts into the market after the animation division is unlocked', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0, startWithSeedProjects: false, includeOpeningDecisions: false });
    manager.animationDivisionUnlocked = true;
    manager.scriptMarket = [];
    for (const genre of Object.keys(manager.genreCycles) as (keyof typeof manager.genreCycles)[]) {
      manager.genreCycles[genre].demand = genre === 'animation' ? 1.4 : 0.72;
      manager.genreCycles[genre].momentum = 0;
      manager.genreCycles[genre].shockDirection = null;
      manager.genreCycles[genre].shockLabel = null;
      manager.genreCycles[genre].shockStrength = null;
      manager.genreCycles[genre].shockUntilWeek = null;
    }

    manager.eventService.refillScriptMarket([]);

    expect(manager.scriptMarket.length).toBeGreaterThan(0);
    expect(manager.scriptMarket.some((script) => script.genre === 'animation')).toBe(true);
  });

  it('generates bargain-bin scripts with steep discounts and quality penalties', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0, startWithSeedProjects: false, includeOpeningDecisions: false });
    manager.scriptMarket = [];
    const baseByTitle = new Map(createSeedScriptMarket().map((script) => [script.title, script]));

    manager.eventService.refillScriptMarket([]);

    expect(manager.scriptMarket.length).toBeGreaterThan(0);
    for (const script of manager.scriptMarket) {
      const source = baseByTitle.get(script.title);
      expect(source).toBeTruthy();
      expect(script.marketTier).toBe('bargain');
      expect(script.askingPrice).toBeGreaterThanOrEqual(Math.max(25_000, Math.round((source?.askingPrice ?? 0) * 0.1)));
      expect(script.askingPrice).toBeLessThanOrEqual(Math.max(25_000, Math.round((source?.askingPrice ?? 0) * 0.2)));
      expect(script.scriptQuality).toBeGreaterThanOrEqual((source?.scriptQuality ?? 0) * 0.5 - 0.01);
      expect(script.scriptQuality).toBeLessThanOrEqual((source?.scriptQuality ?? 0) * 0.7 + 0.01);
      expect(script.conceptStrength).toBeGreaterThanOrEqual((source?.conceptStrength ?? 0) * 0.5 - 0.01);
      expect(script.conceptStrength).toBeLessThanOrEqual((source?.conceptStrength ?? 0) * 0.7 + 0.01);
    }
  });

  it('generates bidding-war scripts with quality boosts and price spikes', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0.3, startWithSeedProjects: false, includeOpeningDecisions: false });
    manager.scriptMarket = [];
    const baseByTitle = new Map(createSeedScriptMarket().map((script) => [script.title, script]));

    manager.eventService.refillScriptMarket([]);

    expect(manager.scriptMarket.length).toBeGreaterThan(0);
    for (const script of manager.scriptMarket) {
      const source = baseByTitle.get(script.title);
      expect(source).toBeTruthy();
      expect(script.marketTier).toBe('biddingWar');
      expect(script.askingPrice).toBeGreaterThanOrEqual(Math.round((source?.askingPrice ?? 0) * 2.5));
      expect(script.askingPrice).toBeLessThanOrEqual(Math.round((source?.askingPrice ?? 0) * 4));
      expect(script.scriptQuality).toBeGreaterThanOrEqual(Math.min(9.8, (source?.scriptQuality ?? 0) + 1.5) - 0.01);
      expect(script.scriptQuality).toBeLessThanOrEqual(Math.min(9.8, (source?.scriptQuality ?? 0) + 2.5) + 0.01);
      expect(script.conceptStrength).toBeGreaterThanOrEqual(Math.min(9.8, (source?.conceptStrength ?? 0) + 1.5) - 0.01);
      expect(script.conceptStrength).toBeLessThanOrEqual(Math.min(9.8, (source?.conceptStrength ?? 0) + 2.5) + 0.01);
    }
  });

  it('generates standard scripts with wider but bounded jitter', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0.8, startWithSeedProjects: false, includeOpeningDecisions: false });
    manager.scriptMarket = [];
    const baseByTitle = new Map(createSeedScriptMarket().map((script) => [script.title, script]));

    manager.eventService.refillScriptMarket([]);

    expect(manager.scriptMarket.length).toBeGreaterThan(0);
    for (const script of manager.scriptMarket) {
      const source = baseByTitle.get(script.title);
      expect(source).toBeTruthy();
      expect(script.marketTier).toBe('standard');
      expect(script.askingPrice).toBeGreaterThanOrEqual(Math.round((source?.askingPrice ?? 0) * 0.7));
      expect(script.askingPrice).toBeLessThanOrEqual(Math.round((source?.askingPrice ?? 0) * 1.4));
      expect(script.scriptQuality).toBeGreaterThanOrEqual(Math.max(1, (source?.scriptQuality ?? 0) - 1) - 0.01);
      expect(script.scriptQuality).toBeLessThanOrEqual(Math.min(9.9, (source?.scriptQuality ?? 0) + 1) + 0.01);
      expect(script.conceptStrength).toBeGreaterThanOrEqual(Math.max(1, (source?.conceptStrength ?? 0) - 1) - 0.01);
      expect(script.conceptStrength).toBeLessThanOrEqual(Math.min(9.9, (source?.conceptStrength ?? 0) + 1) + 0.01);
    }
  });

  it('keeps script market values within safe bounds and does not mutate base catalog', () => {
    const seededSnapshot = JSON.stringify(createSeedScriptMarket().map(({ id, ...rest }) => rest));
    let state = 0x1234abcd;
    const seededRng = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x1_0000_0000;
    };
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: seededRng, startWithSeedProjects: false, includeOpeningDecisions: false });

    for (let i = 0; i < 16; i += 1) {
      manager.endWeek();
      for (const script of manager.scriptMarket) {
        expect(script.askingPrice).toBeGreaterThanOrEqual(25_000);
        expect(script.scriptQuality).toBeGreaterThanOrEqual(1);
        expect(script.scriptQuality).toBeLessThanOrEqual(9.9);
        expect(script.conceptStrength).toBeGreaterThanOrEqual(1);
        expect(script.conceptStrength).toBeLessThanOrEqual(9.9);
      }
    }

    expect(JSON.stringify(createSeedScriptMarket().map(({ id, ...rest }) => rest))).toBe(seededSnapshot);
  });

  it('evaluates scripts independent of current talent pool state', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0.42, negotiationRng: () => 0.5, rivalRng: () => 0.5 });
    const script = manager.scriptMarket[0];
    expect(script).toBeTruthy();

    const baseline = manager.evaluateScriptPitch(script!.id);
    expect(baseline).toBeTruthy();

    for (const talent of manager.talentPool) {
      talent.starPower = talent.role === 'director' ? 9.9 : 3.8;
      talent.craftScore = talent.role === 'director' ? 4 : 9.9;
      talent.availability = 'unavailable';
      talent.marketWindowExpiresWeek = null;
    }

    const afterMutation = manager.evaluateScriptPitch(script!.id);
    expect(afterMutation).toEqual(baseline);
  });

  it('starts with a constrained visible talent market window', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95 });
    const visibleTalent = manager.talentPool.filter(
      (talent) => talent.availability === 'available' && talent.marketWindowExpiresWeek !== null
    );
    const visibleDirectors = visibleTalent.filter((talent) => talent.role === 'director').length;
    const visibleActors = visibleTalent.filter((talent) => talent.role === 'leadActor').length;
    const visibleActresses = visibleTalent.filter((talent) => talent.role === 'leadActress').length;
    const visibleLeadTotal = visibleActors + visibleActresses;

    expect(visibleDirectors).toBeGreaterThan(0);
    expect(visibleActors).toBeGreaterThan(0);
    expect(visibleActresses).toBeGreaterThan(0);
    expect(visibleDirectors).toBeLessThanOrEqual(TALENT_MARKET_RULES.MAX_VISIBLE_DIRECTORS);
    expect(visibleLeadTotal).toBeLessThanOrEqual(TALENT_MARKET_RULES.MAX_VISIBLE_ACTORS);
  });

  it('restores at least one visible actress after actresses disappear from the visible market', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0.42 });
    for (const talent of manager.talentPool) {
      if (talent.role === 'leadActress' && talent.marketWindowExpiresWeek !== null) {
        talent.marketWindowExpiresWeek = null;
      }
    }

    manager.talentService.refreshTalentMarket();

    const visibleActresses = manager.talentPool.filter(
      (talent) =>
        talent.role === 'leadActress' &&
        talent.availability === 'available' &&
        talent.marketWindowExpiresWeek !== null
    );
    expect(visibleActresses.length).toBeGreaterThan(0);
  });

  it('restores at least one visible actor after actors disappear from the visible market', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0.42 });
    for (const talent of manager.talentPool) {
      if (talent.role === 'leadActor' && talent.marketWindowExpiresWeek !== null) {
        talent.marketWindowExpiresWeek = null;
      }
    }

    manager.talentService.refreshTalentMarket();

    const visibleActors = manager.talentPool.filter(
      (talent) =>
        talent.role === 'leadActor' &&
        talent.availability === 'available' &&
        talent.marketWindowExpiresWeek !== null
    );
    expect(visibleActors.length).toBeGreaterThan(0);
  });

  it('rebalances a monopolized visible lead market without exceeding the cap', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0.42 });
    const visibleActors = manager.talentPool.filter(
      (talent) =>
        talent.role === 'leadActor' &&
        talent.availability === 'available' &&
        talent.marketWindowExpiresWeek !== null
    );
    const hiddenActors = manager.talentPool.filter(
      (talent) =>
        talent.role === 'leadActor' &&
        talent.availability === 'available' &&
        talent.marketWindowExpiresWeek === null
    );

    for (const talent of manager.talentPool) {
      if (talent.role === 'leadActress') {
        talent.marketWindowExpiresWeek = null;
      }
    }

    const actorTarget = TALENT_MARKET_RULES.MAX_VISIBLE_ACTORS;
    const actorSlotsNeeded = Math.max(0, actorTarget - visibleActors.length);
    for (const actor of hiddenActors.slice(0, actorSlotsNeeded)) {
      actor.marketWindowExpiresWeek = manager.currentWeek + 4;
    }

    manager.talentService.refreshTalentMarket();

    const totalVisibleLeads = manager.talentPool.filter(
      (talent) =>
        (talent.role === 'leadActor' || talent.role === 'leadActress') &&
        talent.availability === 'available' &&
        talent.marketWindowExpiresWeek !== null
    );
    const actorCount = totalVisibleLeads.filter((talent) => talent.role === 'leadActor').length;
    const actressCount = totalVisibleLeads.filter((talent) => talent.role === 'leadActress').length;

    expect(actorCount).toBeGreaterThan(0);
    expect(actressCount).toBeGreaterThan(0);
    expect(totalVisibleLeads.length).toBeLessThanOrEqual(TALENT_MARKET_RULES.MAX_VISIBLE_ACTORS);
  });

  it('seeds expanded actor pools with realistic full names and repeated components', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0.42 });
    const directors = manager.talentPool.filter((talent) => talent.role === 'director');
    const actors = manager.talentPool.filter((talent) => talent.role === 'leadActor');
    const actresses = manager.talentPool.filter((talent) => talent.role === 'leadActress');

    expect(directors.length).toBe(60);
    expect(actors.length).toBe(135);
    expect(actresses.length).toBe(135);

    const names = manager.talentPool.map((talent) => {
      const [first, ...rest] = talent.name.trim().split(/\s+/);
      return { first, last: rest.join(' ') };
    });
    const firstNames = names.map((entry) => entry.first);
    const lastNames = names.map((entry) => entry.last);

    expect(firstNames.every((value) => value.length > 0)).toBe(true);
    expect(lastNames.every((value) => value.length > 0)).toBe(true);
    expect(new Set(manager.talentPool.map((talent) => talent.name)).size).toBe(manager.talentPool.length);
    expect(new Set(firstNames).size).toBeLessThan(firstNames.length);
    expect(new Set(lastNames).size).toBeLessThan(lastNames.length);
  });

  it('uses talentSeed to generate deterministic but varied talent rosters', () => {
    const first = new StudioManager({ talentSeed: 17, crisisRng: () => 0.95, eventRng: () => 0.42 });
    const second = new StudioManager({ talentSeed: 17, crisisRng: () => 0.95, eventRng: () => 0.42 });
    const third = new StudioManager({ talentSeed: 18, crisisRng: () => 0.95, eventRng: () => 0.42 });

    const firstNames = first.talentPool.slice(0, 12).map((talent) => talent.name);
    const secondNames = second.talentPool.slice(0, 12).map((talent) => talent.name);
    const thirdNames = third.talentPool.slice(0, 12).map((talent) => talent.name);

    expect(firstNames).toEqual(secondNames);
    expect(thirdNames).not.toEqual(firstNames);
  });

  it('replenishes the annual talent batch with seeded names instead of placeholders', () => {
    const manager = new StudioManager({
      talentSeed: 9,
      crisisRng: () => 0.95,
      eventRng: () => 0.42,
      negotiationRng: () => 0.95,
      rivalRng: () => 0.95,
    });
    const initialCount = manager.talentPool.length;
    const existingNames = new Set(manager.talentPool.map((talent) => talent.name));

    manager.currentWeek = 51;
    manager.endWeek();

    const newTalents = manager.talentPool.slice(initialCount);
    expect(newTalents.length).toBe(TALENT_LIFECYCLE.REPLENISHMENT_BATCH_SIZE);
    expect(newTalents.every((talent) => !/^New Talent \d+-\d+$/.test(talent.name))).toBe(true);
    expect(newTalents.every((talent) => !existingNames.has(talent.name))).toBe(true);
    expect(new Set(manager.talentPool.map((talent) => talent.name)).size).toBe(manager.talentPool.length);
  });

  it('skips duplicate legacy names when replenishing', () => {
    const manager = new StudioManager({
      talentSeed: 12,
      crisisRng: () => 0.95,
      eventRng: () => 0.42,
      negotiationRng: () => 0.95,
      rivalRng: () => 0.95,
    });
    const initialCount = manager.talentPool.length;

    manager.talentPool[0].name = 'New Talent 51-0';
    manager.talentPool[1].name = 'Jordan Parker';
    manager.currentWeek = 51;
    manager.endWeek();

    const newTalents = manager.talentPool.slice(initialCount);
    expect(newTalents.every((talent) => talent.name !== 'New Talent 51-0')).toBe(true);
    expect(newTalents.every((talent) => talent.name !== 'Jordan Parker')).toBe(true);
    expect(new Set(manager.talentPool.map((talent) => talent.name)).size).toBe(manager.talentPool.length);
  });

  it('biases script market refill toward currently hot genres', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0 });
    manager.scriptMarket = [];
    manager.genreCycles.thriller.demand = 1.35;
    manager.genreCycles.sciFi.demand = 0.72;
    manager.genreCycles.drama.demand = 0.72;
    const events: string[] = [];

    manager.eventService.refillScriptMarket(events);

    expect(manager.scriptMarket.length).toBeGreaterThan(0);
    const thrillerCount = manager.scriptMarket.filter((script) => script.genre === 'thriller').length;
    expect(thrillerCount).toBeGreaterThanOrEqual(2);
  });

  it('limits each distribution offer to a single counter attempt', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, negotiationRng: () => 0 });
    const project = manager.activeProjects[0];
    project.phase = 'distribution';

    manager.lifecycleService.generateDistributionOffers(project.id);
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
    const manager = new StudioManager({ crisisRng: () => 0.95, negotiationRng: () => 0, rivalRng: () => 0.99 });
    const project = manager.activeProjects.find((item) => item.phase === 'development');
    const director = manager.talentPool.find((item) => item.role === 'director');
    const lead = manager.talentPool.find((item) => item.role === 'leadActor');
    expect(project).toBeTruthy();
    expect(director).toBeTruthy();
    expect(lead).toBeTruthy();

    manager.negotiateAndAttachTalent(project!.id, director!.id);
    manager.negotiateAndAttachTalent(project!.id, lead!.id);
    manager.runGreenlightReview(project!.id, true);
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
    project!.releaseWeekLocked = true;
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
    manager.runGreenlightReview(project!.id, true);
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
    project!.releaseWeekLocked = true;
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

  it('gives cultural-brand studios a higher awards campaign score', () => {
    const base = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 1, rivalRng: () => 1, negotiationRng: () => 1, talentSeed: 9 });
    const boosted = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 1, rivalRng: () => 1, negotiationRng: () => 1, talentSeed: 9 });
    base.completeFoundingSetup({ specialization: 'balanced', foundingProfile: 'none' });
    boosted.completeFoundingSetup({ specialization: 'balanced', foundingProfile: 'culturalBrand' });

    const baseProject = base.activeProjects[0];
    const boostedProject = boosted.activeProjects[0];
    for (const project of [baseProject, boostedProject]) {
      project.phase = 'released';
      project.releaseResolved = true;
      project.releaseWeek = 12;
      project.criticalScore = 86;
      project.scriptQuality = 8.1;
      project.conceptStrength = 8;
      project.prestige = 82;
      project.controversy = 4;
      project.awardsNominations = 0;
      project.awardsWins = 0;
    }
    base.currentWeek = 51;
    boosted.currentWeek = 51;

    base.endWeek();
    boosted.endWeek();

    const baseScore = base.awardsHistory[0]?.results.find((result) => result.projectId === baseProject.id)?.score ?? 0;
    const boostedScore = boosted.awardsHistory[0]?.results.find((result) => result.projectId === boostedProject.id)?.score ?? 0;

    expect(boostedScore).toBeGreaterThan(baseScore);
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
        calendarPressureLockUntilWeek: null,
        lastPressuredProjectId: null,
        lockedTalentIds: [],
        memory: { hostility: 55, respect: 52, retaliationBias: 50, cooperationBias: 45, interactionHistory: [] },
      },
    ];

    const events: string[] = [];
    manager.rivalAiService.processRivalTalentAcquisitions(events);

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
        calendarPressureLockUntilWeek: null,
        lastPressuredProjectId: null,
        lockedTalentIds: [],
        memory: { hostility: 55, respect: 52, retaliationBias: 50, cooperationBias: 45, interactionHistory: [] },
      },
    ];
    const project = manager.activeProjects[0];
    project.phase = 'distribution';
    project.releaseWeek = manager.currentWeek + 6;
    project.releaseWeekLocked = true;

    const events: string[] = [];
    manager.rivalAiService.processRivalCalendarMoves(events);

    expect(manager.rivals[0].upcomingReleases.length).toBeGreaterThan(0);
    expect(manager.rivals[0].upcomingReleases[0].releaseWeek).toBe(project.releaseWeek);
  });

  it('applies a cooldown after rival calendar pressure and avoids immediate repeat collisions', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, rivalRng: () => 0 });
    manager.rivals = [
      {
        id: 'r-blockbuster',
        name: 'Blockbuster Test',
        personality: 'blockbusterFactory',
        studioHeat: 70,
        activeReleases: [],
        upcomingReleases: [],
        calendarPressureLockUntilWeek: null,
        lastPressuredProjectId: null,
        lockedTalentIds: [],
        memory: { hostility: 55, respect: 52, retaliationBias: 50, cooperationBias: 45, interactionHistory: [] },
      },
    ];
    const project = manager.activeProjects[0];
    project.phase = 'distribution';
    project.releaseWeek = manager.currentWeek + 6;
    project.releaseWeekLocked = true;

    const events: string[] = [];
    manager.rivalAiService.processRivalCalendarMoves(events);
    manager.rivalAiService.processRivalCalendarMoves(events);

    const pressuredWeeks = manager.rivals[0].upcomingReleases.filter(
      (film) => Math.abs(film.releaseWeek - project.releaseWeek!) <= 2
    );

    expect(manager.rivals[0].calendarPressureLockUntilWeek).toBe(manager.currentWeek + 6);
    expect(manager.rivals[0].lastPressuredProjectId).toBe(project.id);
    expect(pressuredWeeks).toHaveLength(1);
    expect(manager.pendingCrises.filter((item) => item.kind === 'releaseConflict')).toHaveLength(1);
  });

  it('uses nearby corridors instead of exact date mirroring for standard rival calendar pressure', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, rivalRng: () => 0 });
    manager.rivals = [
      {
        id: 'r-scrappy',
        name: 'Scrappy Test',
        personality: 'scrappyUpstart',
        studioHeat: 48,
        activeReleases: [],
        upcomingReleases: [],
        calendarPressureLockUntilWeek: null,
        lastPressuredProjectId: null,
        lockedTalentIds: [],
        memory: { hostility: 55, respect: 52, retaliationBias: 50, cooperationBias: 45, interactionHistory: [] },
      },
    ];
    const project = manager.activeProjects[0];
    project.phase = 'distribution';
    project.releaseWeek = manager.currentWeek + 6;
    project.releaseWeekLocked = true;

    const events: string[] = [];
    manager.rivalAiService.processRivalCalendarMoves(events);

    expect(manager.rivals[0].upcomingReleases.length).toBeGreaterThan(0);
    expect(manager.rivals[0].upcomingReleases[0].releaseWeek).not.toBe(project.releaseWeek);
    expect(Math.abs(manager.rivals[0].upcomingReleases[0].releaseWeek - project.releaseWeek)).toBeLessThanOrEqual(2);
  });

  it('queues platform pressure response after release resolution', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, rivalRng: () => 0 });
    manager.rivals = [
      {
        id: 'r-stream',
        name: 'Stream Rival',
        personality: 'streamingFirst',
        studioHeat: 50,
        activeReleases: [],
        upcomingReleases: [],
        calendarPressureLockUntilWeek: null,
        lastPressuredProjectId: null,
        lockedTalentIds: [],
        memory: { hostility: 55, respect: 52, retaliationBias: 50, cooperationBias: 45, interactionHistory: [] },
      },
    ];
    const releasedProject = manager.activeProjects[0];
    releasedProject.phase = 'released';
    releasedProject.releaseResolved = true;

    const events: string[] = [];
    manager.rivalAiService.checkRivalReleaseResponses(
      releasedProject,
      events
    );

    expect(manager.decisionQueue.some((item) => item.title.includes('Platform Pressure'))).toBe(true);
  });

  it('respects rival calendar cooldown when checking post-release responses', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, rivalRng: () => 0 });
    manager.rivals = [
      {
        id: 'r-blockbuster',
        name: 'Blockbuster Test',
        personality: 'blockbusterFactory',
        studioHeat: 70,
        activeReleases: [],
        upcomingReleases: [],
        calendarPressureLockUntilWeek: manager.currentWeek + 4,
        lastPressuredProjectId: 'older-project',
        lockedTalentIds: [],
        memory: { hostility: 55, respect: 52, retaliationBias: 50, cooperationBias: 45, interactionHistory: [] },
      },
    ];
    const releasedProject = manager.activeProjects[0];
    releasedProject.phase = 'released';
    releasedProject.releaseResolved = true;
    const nextProject = manager.activeProjects[1];
    nextProject.phase = 'distribution';
    nextProject.releaseWeek = manager.currentWeek + 5;
    nextProject.releaseWeekLocked = true;

    const events: string[] = [];
    manager.rivalAiService.checkRivalReleaseResponses(
      releasedProject,
      events
    );

    expect(manager.rivals[0].upcomingReleases).toHaveLength(0);
  });

  it('keeps animation production crises out of live-action-only set failure events', () => {
    const manager = new StudioManager({ crisisRng: () => 0.6 });
    const project = manager.activeProjects[0];
    project.phase = 'production';
    project.genre = 'animation';

    const crisis = buildOperationalCrisisForManager(manager, project);

    expect(crisis.title).toContain('Render Farm Outage');
    expect(crisis.title).not.toContain('Set Build Failure');
  });

  it('still allows live-action production crises to roll set build failures', () => {
    const manager = new StudioManager({ crisisRng: () => 0.6 });
    const project = manager.activeProjects[0];
    project.phase = 'production';
    project.genre = 'action';

    const crisis = buildOperationalCrisisForManager(manager, project);

    expect(crisis.title).toContain('Set Build Failure');
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

    // Force deterministic rival pick by taking other candidates off-market.
    for (const talent of manager.talentPool) {
      if (talent.id === targetTalent!.id) continue;
      talent.availability = 'unavailable';
      talent.unavailableUntilWeek = manager.currentWeek + 12;
      talent.attachedProjectId = null;
    }

    manager.endWeek();
    const poach = manager.pendingCrises.find((item) => item.kind === 'talentPoached');
    expect(poach).toBeTruthy();
  });

  it('allows rivals to poach available talent even when talent is outside player market windows', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, rivalRng: () => 0 });
    const target = manager.talentPool.find((talent) => talent.role === 'director');
    expect(target).toBeTruthy();

    for (const talent of manager.talentPool) {
      talent.availability = 'unavailable';
      talent.unavailableUntilWeek = manager.currentWeek + 20;
      talent.attachedProjectId = null;
      talent.marketWindowExpiresWeek = null;
    }
    target!.availability = 'available';
    target!.unavailableUntilWeek = null;
    target!.marketWindowExpiresWeek = null;

    const events: string[] = [];
    manager.rivalAiService.processRivalTalentAcquisitions(events);

    expect(target!.availability).toBe('unavailable');
    expect(manager.rivals.some((rival) => rival.lockedTalentIds.includes(target!.id))).toBe(true);
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
    manager.runGreenlightReview(project!.id, true);
    project!.marketingBudget = 1_000_000;

    manager.advanceProjectPhase(project!.id);
    project!.scheduledWeeksRemaining = 0;
    manager.advanceProjectPhase(project!.id);
    project!.scheduledWeeksRemaining = 0;
    manager.advanceProjectPhase(project!.id);
    project!.scheduledWeeksRemaining = 0;
    manager.advanceProjectPhase(project!.id);

    expect(project!.phase).toBe('distribution');
    expect(project!.releaseWeekLocked).toBe(false);
    expect(manager.confirmProjectReleaseWeek(project!.id).success).toBe(true);
    manager.endWeek();
    const conflict = manager.pendingCrises.find((item) => item.kind === 'releaseConflict');
    expect(conflict).toBeTruthy();
  });

  it('leaves the default distribution release week unlocked until confirmed', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, negotiationRng: () => 0.95, rivalRng: () => 0.95 });
    const project = manager.activeProjects[0];
    project.phase = 'postProduction';
    project!.marketingBudget = 1_000_000;
    project!.scheduledWeeksRemaining = 0;

    const result = manager.advanceProjectPhase(project!.id);

    expect(result.success).toBe(true);
    expect(project!.phase).toBe('distribution');
    expect(project!.releaseWeek).toBe(manager.currentWeek + 4);
    expect(project!.releaseWeekLocked).toBe(false);
  });

  it('locks the suggested release week when confirmed and when manually moved', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, rivalRng: () => 0.95 });
    const project = manager.activeProjects[0];
    project.phase = 'distribution';
    project.releaseWeek = manager.currentWeek + 4;
    project.releaseWeekLocked = false;

    const confirm = manager.confirmProjectReleaseWeek(project.id);
    expect(confirm.success).toBe(true);
    expect(project.releaseWeekLocked).toBe(true);

    project.releaseWeekLocked = false;
    const move = manager.setProjectReleaseWeek(project.id, project.releaseWeek! + 1);
    expect(move.success).toBe(true);
    expect(project.releaseWeek).toBe(manager.currentWeek + 5);
    expect(project.releaseWeekLocked).toBe(true);
  });

  it('blocks release advancement until the release week is locked', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, rivalRng: () => 0.95 });
    const project = manager.activeProjects[0];
    project.phase = 'distribution';
    project.scheduledWeeksRemaining = 0;
    project.releaseWindow = 'wideTheatrical';
    project.releaseWeek = manager.currentWeek;
    project.releaseWeekLocked = false;

    const blocked = manager.advanceProjectPhase(project.id);
    expect(blocked.success).toBe(false);
    expect(blocked.message).toContain('Confirm a release week');

    project.releaseWeekLocked = true;
    const released = manager.advanceProjectPhase(project.id);
    expect(released.success).toBe(true);
    expect(project.phase).toBe('released');
  });

  it('suppresses release collisions until a distribution week is locked', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, rivalRng: () => 0 });
    manager.rivals = [
      {
        id: 'r-1',
        name: 'Test Blockbuster',
        personality: 'blockbusterFactory',
        studioHeat: 70,
        activeReleases: [],
        upcomingReleases: [],
        calendarPressureLockUntilWeek: null,
        lastPressuredProjectId: null,
        lockedTalentIds: [],
        memory: { hostility: 55, respect: 52, retaliationBias: 50, cooperationBias: 45, interactionHistory: [] },
      },
    ];
    const target = manager.activeProjects[0];
    target.phase = 'distribution';
    target.releaseWeek = manager.currentWeek + 8;
    target.releaseWeekLocked = false;

    const events: string[] = [];
    manager.rivalAiService.processRivalCalendarMoves(events);
    expect(manager.pendingCrises.some((item) => item.kind === 'releaseConflict')).toBe(false);

    target.releaseWeekLocked = true;
    manager.rivalAiService.processRivalCalendarMoves(events);
    expect(manager.pendingCrises.some((item) => item.kind === 'releaseConflict')).toBe(true);
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

  it('creates named genre shocks on cadence and records an event log entry', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0, rivalRng: () => 1 });
    manager.currentWeek = 16;

    const summary = manager.endWeek();
    const hasShock = Object.values(manager.genreCycles).some((state) => !!state.shockLabel && !!state.shockUntilWeek);

    expect(hasShock).toBe(true);
    expect(summary.events.some((entry) => entry.includes('Genre shock:'))).toBe(true);
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

  it('gives cultural-brand studios a small festival edge on marginal submissions', () => {
    const base = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0.425, rivalRng: () => 1, negotiationRng: () => 1, talentSeed: 23 });
    const boosted = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0.425, rivalRng: () => 1, negotiationRng: () => 1, talentSeed: 23 });
    base.completeFoundingSetup({ specialization: 'balanced', foundingProfile: 'none' });
    boosted.completeFoundingSetup({ specialization: 'balanced', foundingProfile: 'culturalBrand' });

    const baseProject = base.activeProjects[0];
    const boostedProject = boosted.activeProjects[0];
    for (const [manager, project] of [
      [base, baseProject] as const,
      [boosted, boostedProject] as const,
    ]) {
      manager.genreCycles[project.genre].demand = 1;
      manager.genreCycles[project.genre].momentum = 0;
      manager.genreCycles[project.genre].shockDirection = null;
      manager.genreCycles[project.genre].shockLabel = null;
      manager.genreCycles[project.genre].shockStrength = null;
      manager.genreCycles[project.genre].shockUntilWeek = null;
      project.phase = 'postProduction';
      project.criticalScore = 50;
      project.scriptQuality = 2;
      project.prestige = 10;
      project.originality = 18;
      project.controversy = 0;
      project.festivalBuzz = 0;
      project.festivalStatus = 'submitted';
      project.festivalTarget = 'Toronto';
      project.festivalResolutionWeek = manager.currentWeek;
    }

    base.endWeek();
    boosted.endWeek();

    expect(baseProject.festivalStatus).toBe('snubbed');
    expect(['selected', 'buzzed']).toContain(boostedProject.festivalStatus);
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
        calendarPressureLockUntilWeek: null,
        lastPressuredProjectId: null,
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

    const applied = manager.releaseService.applyWeeklyBurn();
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
        calendarPressureLockUntilWeek: null,
        lastPressuredProjectId: null,
        lockedTalentIds: [],
        memory: { hostility: 55, respect: 52, retaliationBias: 50, cooperationBias: 45, interactionHistory: [] },
      },
    ];

    const target = manager.activeProjects[0];
    target.phase = 'distribution';
    target.releaseWeek = manager.currentWeek + 4;
    target.releaseWeekLocked = true;
    const events: string[] = [];

    manager.rivalAiService.processRivalSignatureMoves(events);
    manager.rivalAiService.processRivalSignatureCrises(events);

    expect(manager.rivals[0].upcomingReleases.length).toBeGreaterThan(0);
    expect(manager.rivals[0].upcomingReleases[0].releaseWeek).toBe(target.releaseWeek);
    expect(events.some((entry) => entry.includes('tentpole'))).toBe(true);
    expect(manager.decisionQueue.some((item) => item.title.includes('Counterplay'))).toBe(true);
    expect(manager.storyFlags.rival_tentpole_threat).toBeGreaterThan(0);
  });

  it('lets rival calendar moves adapt film genre to cycle demand', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, rivalRng: () => 0, eventRng: () => 1 });
    manager.rivals = [
      {
        id: 'r-1',
        name: 'Test Blockbuster',
        personality: 'blockbusterFactory',
        studioHeat: 70,
        activeReleases: [],
        upcomingReleases: [],
        calendarPressureLockUntilWeek: null,
        lastPressuredProjectId: null,
        lockedTalentIds: [],
        memory: { hostility: 55, respect: 52, retaliationBias: 50, cooperationBias: 45, interactionHistory: [] },
      },
    ];
    manager.genreCycles.sciFi.demand = 1.38;
    manager.genreCycles.action.demand = 0.72;
    manager.genreCycles.animation.demand = 0.74;
    const events: string[] = [];

    manager.rivalAiService.processRivalCalendarMoves(events);

    expect(manager.rivals[0].upcomingReleases.length).toBeGreaterThan(0);
    expect(manager.rivals[0].upcomingReleases[0].genre).toBe('sciFi');
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
        calendarPressureLockUntilWeek: null,
        lastPressuredProjectId: null,
        lockedTalentIds: [],
        memory: { hostility: 55, respect: 52, retaliationBias: 50, cooperationBias: 45, interactionHistory: [] },
      },
    ];
    const target = manager.activeProjects[0];
    target.phase = 'distribution';
    target.releaseWeek = manager.currentWeek + 4;
    target.releaseWeekLocked = true;

    const events: string[] = [];
    manager.rivalAiService.processRivalSignatureMoves(events);
    manager.rivalAiService.processRivalSignatureCrises(events);

    expect(manager.storyFlags.rival_tentpole_threat).toBeGreaterThan(0);
    expect(manager.decisionQueue.some((item) => item.title.includes('Counterplay'))).toBe(true);

    const expiryEvents: string[] = [];
    manager.eventService.tickDecisionExpiry(expiryEvents);
    manager.eventService.tickDecisionExpiry(expiryEvents);

    expect(manager.storyFlags.rival_tentpole_threat).toBeUndefined();
    expect(manager.decisionQueue.some((item) => item.title.includes('Counterplay'))).toBe(false);

    manager.rivalAiService.processRivalSignatureMoves(events);
    manager.rivalAiService.processRivalSignatureCrises(events);
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
    manager.eventService.tickDecisionExpiry(expiryEvents);
    manager.eventService.tickDecisionExpiry(expiryEvents);
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
    manager.eventService.tickDecisionExpiry(expiryEvents);
    manager.eventService.tickDecisionExpiry(expiryEvents);
    expect(manager.storyFlags.rival_tentpole_threat).toBeUndefined();
  });

  it('creates a major IP contract commitment when major rights are acquired', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0.5 });
    manager.reputation.distributor = 80;
    manager.cash = 100_000_000;
    manager.refreshIpMarketplace(true);
    const major = manager.ownedIps.find((ip) => ip.major);
    expect(major).toBeTruthy();

    const result = manager.acquireIpRights(major!.id);
    expect(result.success).toBe(true);
    expect(result.message).toContain('Contract requires');

    const commitment = manager.getMajorIpCommitments().find((entry) => entry.ipId === major!.id);
    expect(commitment).toBeTruthy();
    expect(commitment?.remainingReleases).toBe(3);
    expect(commitment?.requiredReleases).toBe(3);
    expect(commitment?.deadlineWeek).toBeGreaterThan(manager.currentWeek);
  });

  it('locks unrelated script acquisitions when a major IP contract has no active installment', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0.5 });
    manager.reputation.distributor = 80;
    manager.cash = 100_000_000;
    manager.refreshIpMarketplace(true);
    const major = manager.ownedIps.find((ip) => ip.major);
    expect(major).toBeTruthy();
    manager.acquireIpRights(major!.id);

    const script = manager.scriptMarket[0];
    const result = manager.acquireScript(script.id);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Contract lock');
  });

  it('carries adaptedFromIpId into sequels so major IP contract tracking continues', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0.5 });
    manager.reputation.distributor = 80;
    manager.cash = 100_000_000;
    manager.refreshIpMarketplace(true);
    const major = manager.ownedIps.find((ip) => ip.major);
    expect(major).toBeTruthy();
    manager.acquireIpRights(major!.id);
    const adaptation = manager.developProjectFromIp(major!.id);
    expect(adaptation.success).toBe(true);
    const base = manager.activeProjects.find((project) => project.id === adaptation.projectId);
    expect(base).toBeTruthy();
    base!.phase = 'released';
    base!.releaseResolved = true;
    base!.releaseWeek = manager.currentWeek - 2;
    base!.criticalScore = 74;
    base!.audienceScore = 78;
    base!.projectedROI = 1.5;

    const sequelStart = manager.startSequel(base!.id);
    expect(sequelStart.success).toBe(true);
    const sequel = manager.activeProjects.find((project) => project.id === sequelStart.projectId);
    expect(sequel).toBeTruthy();
    expect(sequel?.adaptedFromIpId).toBe(major!.id);
  });

  it('applies breach penalties when major IP contract deadline is missed', () => {
    const manager = new StudioManager({ crisisRng: () => 0.95, eventRng: () => 0.5, rivalRng: () => 1 });
    manager.activeProjects = [];
    manager.decisionQueue = [];
    manager.reputation.distributor = 80;
    manager.cash = 100_000_000;
    manager.refreshIpMarketplace(true);
    const major = manager.ownedIps.find((ip) => ip.major);
    expect(major).toBeTruthy();
    manager.acquireIpRights(major!.id);
    const commitment = manager.getMajorIpCommitments().find((entry) => entry.ipId === major!.id);
    expect(commitment).toBeTruthy();
    const cashBefore = manager.cash;
    manager.currentWeek = commitment!.deadlineWeek + 1;

    const summary = manager.endWeek();
    expect(summary.events.some((entry) => entry.includes('contract breached'))).toBe(true);
    expect(cashBefore - manager.cash).toBeGreaterThanOrEqual(1_400_000);

    const breached = manager.getMajorIpCommitments().find((entry) => entry.ipId === major!.id);
    expect(breached?.breached).toBe(true);
    expect(breached?.remainingReleases).toBe(0);
  });

});

