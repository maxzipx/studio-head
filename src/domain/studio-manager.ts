import {
  heatDeltaFromRelease,
  projectedCriticalScore,
  projectedOpeningWeekendRange,
  projectedROI,
} from './formulas';
import { getEventDeck } from './event-deck';
import {
  createOpeningDecisions,
  createSeedProjects,
  createSeedRivals,
  createSeedScriptMarket,
  createSeedTalentPool,
} from './seeds';
import type {
  CrisisEvent,
  DecisionCategory,
  DecisionItem,
  DistributionOffer,
  EventTemplate,
  IndustryNewsItem,
  MovieGenre,
  MovieProject,
  PlayerNegotiation,
  RivalFilm,
  RivalStudio,
  ScriptPitch,
  StoryArcState,
  Talent,
  TalentRole,
  WeekSummary,
} from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function id(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function phaseBurnMultiplier(phase: MovieProject['phase']): number {
  switch (phase) {
    case 'development':
      return 0.005;
    case 'preProduction':
      return 0.008;
    case 'production':
      return 0.015;
    case 'postProduction':
      return 0.009;
    case 'distribution':
      return 0.0035;
    default:
      return 0;
  }
}

function initialBudgetForGenre(genre: MovieGenre): number {
  switch (genre) {
    case 'action':
      return 28_000_000;
    case 'sciFi':
      return 32_000_000;
    case 'animation':
      return 36_000_000;
    case 'horror':
      return 14_000_000;
    case 'documentary':
      return 6_000_000;
    default:
      return 18_000_000;
  }
}

const AGENT_DIFFICULTY: Record<Talent['agentTier'], number> = {
  independent: 1,
  uta: 1.2,
  wme: 1.3,
  caa: 1.4,
};

export class StudioManager {
  private readonly crisisRng: () => number;
  private readonly eventRng: () => number;
  private readonly negotiationRng: () => number;
  private readonly rivalRng: () => number;
  private readonly eventDeck: EventTemplate[] = getEventDeck();
  private readonly lastEventWeek = new Map<string, number>();

  studioName = 'Project Greenlight';
  cash = 50_000_000;
  studioHeat = 12;
  currentWeek = 1;
  pendingCrises: CrisisEvent[] = [];
  distributionOffers: DistributionOffer[] = [];
  pendingReleaseReveals: string[] = [];
  decisionQueue: DecisionItem[] = createOpeningDecisions();
  activeProjects: MovieProject[] = createSeedProjects();
  talentPool: Talent[] = createSeedTalentPool();
  scriptMarket: ScriptPitch[] = createSeedScriptMarket();
  rivals: RivalStudio[] = createSeedRivals();
  industryNewsLog: IndustryNewsItem[] = [];
  playerNegotiations: PlayerNegotiation[] = [];
  storyFlags: Record<string, number> = {};
  storyArcs: Record<string, StoryArcState> = {};
  recentDecisionCategories: DecisionCategory[] = [];
  lastWeekSummary: WeekSummary | null = null;

  constructor(input?: {
    crisisRng?: () => number;
    eventRng?: () => number;
    negotiationRng?: () => number;
    rivalRng?: () => number;
  }) {
    this.crisisRng = input?.crisisRng ?? Math.random;
    this.eventRng = input?.eventRng ?? Math.random;
    this.negotiationRng = input?.negotiationRng ?? Math.random;
    this.rivalRng = input?.rivalRng ?? Math.random;
  }

  get canEndWeek(): boolean {
    return this.pendingCrises.length === 0;
  }

  getAvailableTalentForRole(role: TalentRole): Talent[] {
    return this.talentPool.filter((talent) => talent.role === role && talent.availability === 'available');
  }

  getIndustryHeatLeaderboard(): { name: string; heat: number; isPlayer: boolean }[] {
    const rows = [
      { name: this.studioName, heat: this.studioHeat, isPlayer: true },
      ...this.rivals.map((rival) => ({ name: rival.name, heat: rival.studioHeat, isPlayer: false })),
    ];
    return rows.sort((a, b) => b.heat - a.heat);
  }

  runOptionalAction(): void {
    const project = this.activeProjects[0];
    if (!project) return;
    project.hypeScore = clamp(project.hypeScore + 5, 0, 100);
    project.marketingBudget += 180_000;
    this.cash -= 180_000;
  }

  startTalentNegotiation(projectId: string, talentId: string): { success: boolean; message: string } {
    const project = this.activeProjects.find((item) => item.id === projectId);
    if (!project) return { success: false, message: 'Project not found.' };

    const talent = this.talentPool.find((item) => item.id === talentId);
    if (!talent) return { success: false, message: 'Talent not found.' };
    if (talent.availability !== 'available') return { success: false, message: `${talent.name} is unavailable.` };
    if (this.playerNegotiations.some((item) => item.talentId === talentId)) {
      return { success: false, message: `${talent.name} is already in negotiation.` };
    }

    talent.availability = 'inNegotiation';
    this.playerNegotiations.push({
      talentId,
      projectId,
      openedWeek: this.currentWeek,
    });
    return { success: true, message: `Opened negotiation with ${talent.name}.` };
  }

  setProjectReleaseWeek(projectId: string, releaseWeek: number): { success: boolean; message: string } {
    const project = this.activeProjects.find((item) => item.id === projectId);
    if (!project || project.phase !== 'distribution') {
      return { success: false, message: 'Project is not in distribution.' };
    }
    project.releaseWeek = clamp(Math.round(releaseWeek), this.currentWeek + 1, this.currentWeek + 52);
    return { success: true, message: `${project.title} release moved to week ${project.releaseWeek}.` };
  }

  getOffersForProject(projectId: string): DistributionOffer[] {
    return this.distributionOffers.filter((offer) => offer.projectId === projectId);
  }

  getNextReleaseReveal(): MovieProject | null {
    const nextId = this.pendingReleaseReveals[0];
    if (!nextId) return null;
    return this.activeProjects.find((project) => project.id === nextId) ?? null;
  }

  dismissReleaseReveal(projectId: string): void {
    this.pendingReleaseReveals = this.pendingReleaseReveals.filter((idValue) => idValue !== projectId);
  }

  acquireScript(scriptId: string): { success: boolean; message: string; projectId?: string } {
    const pitch = this.scriptMarket.find((item) => item.id === scriptId);
    if (!pitch) return { success: false, message: 'Script not found.' };
    if (this.cash < pitch.askingPrice) return { success: false, message: 'Insufficient funds for script acquisition.' };

    this.cash -= pitch.askingPrice;
    this.scriptMarket = this.scriptMarket.filter((item) => item.id !== scriptId);

    const ceiling = initialBudgetForGenre(pitch.genre);
    const project: MovieProject = {
      id: id('project'),
      title: pitch.title,
      genre: pitch.genre,
      phase: 'development',
      budget: {
        ceiling,
        aboveTheLine: ceiling * 0.3,
        belowTheLine: ceiling * 0.5,
        postProduction: ceiling * 0.15,
        contingency: ceiling * 0.1,
        overrunRisk: 0.28,
        actualSpend: pitch.askingPrice,
      },
      scriptQuality: pitch.scriptQuality,
      conceptStrength: pitch.conceptStrength,
      directorId: null,
      castIds: [],
      productionStatus: 'onTrack',
      scheduledWeeksRemaining: 6,
      hypeScore: 8,
      marketingBudget: 0,
      releaseWindow: null,
      releaseWeek: null,
      distributionPartner: null,
      studioRevenueShare: 0.52,
      projectedROI: 1,
      openingWeekendGross: null,
      weeklyGrossHistory: [],
      releaseWeeksRemaining: 0,
      releaseResolved: false,
      finalBoxOffice: null,
      criticalScore: null,
      audienceScore: null,
    };
    this.activeProjects.push(project);
    return { success: true, message: `Acquired "${pitch.title}".`, projectId: project.id };
  }

  passScript(scriptId: string): void {
    this.scriptMarket = this.scriptMarket.filter((item) => item.id !== scriptId);
  }

  negotiateAndAttachTalent(projectId: string, talentId: string): { success: boolean; message: string } {
    const project = this.activeProjects.find((item) => item.id === projectId);
    if (!project) return { success: false, message: 'Project not found.' };

    const talent = this.talentPool.find((item) => item.id === talentId);
    if (!talent) return { success: false, message: 'Talent not found.' };
    if (talent.availability !== 'available') return { success: false, message: `${talent.name} is unavailable.` };

    const difficulty = AGENT_DIFFICULTY[talent.agentTier] + talent.egoLevel * 0.04;
    const chance = clamp(
      0.72 + this.studioHeat / 220 + talent.studioRelationship * 0.15 - difficulty * 0.2,
      0.15,
      0.95
    );
    const retainer = talent.salary.base * 0.08;
    if (this.cash < retainer) return { success: false, message: 'Insufficient funds for deal memo retainer.' };
    if (this.negotiationRng() > chance) return { success: false, message: `${talent.name}'s reps declined current terms.` };
    this.finalizeTalentAttachment(project, talent);
    return { success: true, message: `${talent.name} attached to ${project.title}.` };
  }

  advanceProjectPhase(projectId: string): { success: boolean; message: string } {
    const project = this.activeProjects.find((item) => item.id === projectId);
    if (!project) return { success: false, message: 'Project not found.' };

    if (project.phase === 'development') {
      if (!project.directorId) return { success: false, message: 'Attach a director before moving to pre-production.' };
      if (project.castIds.length < 1) return { success: false, message: 'Attach at least one cast lead before moving forward.' };
      if (project.scriptQuality < 6) return { success: false, message: 'Script quality is too low to greenlight.' };
      project.phase = 'preProduction';
      project.scheduledWeeksRemaining = 8;
      return { success: true, message: `${project.title} moved to Pre-Production.` };
    }

    if (project.phase === 'preProduction') {
      if (project.scheduledWeeksRemaining > 0) {
        return { success: false, message: 'Finish pre-production weeks before principal photography.' };
      }
      project.phase = 'production';
      project.scheduledWeeksRemaining = 14;
      project.productionStatus = 'onTrack';
      return { success: true, message: `${project.title} moved to Production.` };
    }

    if (project.phase === 'production') {
      if (project.scheduledWeeksRemaining > 0) {
        return { success: false, message: 'Production schedule still has remaining weeks.' };
      }
      if (this.pendingCrises.some((item) => item.projectId === project.id)) {
        return { success: false, message: 'Resolve project crises before moving to post.' };
      }
      project.phase = 'postProduction';
      project.scheduledWeeksRemaining = 6;
      project.productionStatus = 'onTrack';
      return { success: true, message: `${project.title} moved to Post-Production.` };
    }

    if (project.phase === 'postProduction') {
      if (project.scheduledWeeksRemaining > 0) {
        return { success: false, message: 'Editorial timeline still in progress.' };
      }
      if (project.marketingBudget <= 0) {
        return { success: false, message: 'Allocate marketing spend before entering distribution.' };
      }
      project.phase = 'distribution';
      project.releaseWindow = null;
      project.releaseWeek = this.currentWeek + 4;
      project.scheduledWeeksRemaining = 3;
      this.generateDistributionOffers(project.id);
      return { success: true, message: `${project.title} moved to Distribution.` };
    }

    if (project.phase === 'distribution') {
      if (project.scheduledWeeksRemaining > 0) {
        return { success: false, message: 'Distribution setup is still underway.' };
      }
      if (!project.releaseWindow) {
        return { success: false, message: 'Select a distribution deal first.' };
      }
      const projection = this.getProjectedForProject(project.id);
      if (!projection) return { success: false, message: 'Projection unavailable.' };
      project.phase = 'released';
      project.criticalScore = projection.critical;
      project.audienceScore = clamp(projection.critical + 4, 0, 100);
      project.openingWeekendGross = projection.openingHigh;
      project.weeklyGrossHistory = [projection.openingHigh];
      project.finalBoxOffice = projection.openingHigh;
      project.releaseWeeksRemaining = this.estimateReleaseRunWeeks(project);
      project.releaseResolved = false;
      project.projectedROI = projection.roi;
      this.pendingReleaseReveals.push(project.id);
      this.releaseTalent(project.id);
      return { success: true, message: `${project.title} released. Opening weekend posted.` };
    }

    return { success: false, message: 'Project is already released.' };
  }

  acceptDistributionOffer(projectId: string, offerId: string): { success: boolean; message: string } {
    const project = this.activeProjects.find((item) => item.id === projectId);
    if (!project || project.phase !== 'distribution') {
      return { success: false, message: 'Project is not in distribution phase.' };
    }
    const offer = this.distributionOffers.find((item) => item.id === offerId && item.projectId === projectId);
    if (!offer) return { success: false, message: 'Offer not found.' };

    project.releaseWindow = offer.releaseWindow;
    project.distributionPartner = offer.partner;
    project.studioRevenueShare = offer.revenueShareToStudio;
    if (!project.releaseWeek) {
      project.releaseWeek = this.currentWeek + 4;
    }
    project.marketingBudget += offer.pAndACommitment;
    project.hypeScore = clamp(project.hypeScore + 6, 0, 100);
    this.cash += offer.minimumGuarantee;
    this.distributionOffers = this.distributionOffers.filter((item) => item.projectId !== projectId);
    return { success: true, message: `Accepted ${offer.partner} offer.` };
  }

  counterDistributionOffer(projectId: string, offerId: string): { success: boolean; message: string } {
    const offer = this.distributionOffers.find((item) => item.id === offerId && item.projectId === projectId);
    if (!offer) return { success: false, message: 'Offer not found.' };
    const successChance = clamp(0.53 + this.studioHeat / 220, 0.25, 0.9);
    if (this.negotiationRng() > successChance) {
      return { success: false, message: `${offer.partner} declined the counter.` };
    }

    offer.minimumGuarantee *= 1.1;
    offer.revenueShareToStudio = clamp(offer.revenueShareToStudio + 0.025, 0.45, 0.7);
    return { success: true, message: `${offer.partner} improved terms after counter.` };
  }

  walkAwayDistribution(projectId: string): { success: boolean; message: string } {
    const project = this.activeProjects.find((item) => item.id === projectId);
    if (!project || project.phase !== 'distribution') {
      return { success: false, message: 'Project is not in distribution phase.' };
    }
    const removed = this.distributionOffers.filter((item) => item.projectId === projectId).length;
    this.distributionOffers = this.distributionOffers.filter((item) => item.projectId !== projectId);
    this.studioHeat = clamp(this.studioHeat - 2, 0, 100);
    return { success: true, message: `Walked away from ${removed} offer(s). Studio heat -2.` };
  }

  resolveCrisis(crisisId: string, optionId: string): void {
    const crisis = this.pendingCrises.find((item) => item.id === crisisId);
    if (!crisis) return;
    const option = crisis.options.find((item) => item.id === optionId);
    if (!option) return;

    const project = this.activeProjects.find((item) => item.id === crisis.projectId);
    if (project) {
      if (crisis.kind === 'talentPoached') {
        this.resolveTalentPoachCrisis(project, option);
        this.pendingCrises = this.pendingCrises.filter((item) => item.id !== crisisId);
        return;
      }
      if (crisis.kind === 'releaseConflict') {
        if (typeof option.releaseWeekShift === 'number' && project.releaseWeek) {
          project.releaseWeek = clamp(project.releaseWeek + option.releaseWeekShift, this.currentWeek + 1, this.currentWeek + 52);
        }
        project.hypeScore = clamp(project.hypeScore + option.hypeDelta, 0, 100);
        this.cash += option.cashDelta;
        this.pendingCrises = this.pendingCrises.filter((item) => item.id !== crisisId);
        return;
      }
      project.scheduledWeeksRemaining = Math.max(0, project.scheduledWeeksRemaining + option.scheduleDelta);
      project.hypeScore = clamp(project.hypeScore + option.hypeDelta, 0, 100);
      project.budget.actualSpend += Math.max(0, -option.cashDelta);
      project.productionStatus = 'onTrack';
    }
    this.cash += option.cashDelta;
    this.pendingCrises = this.pendingCrises.filter((item) => item.id !== crisisId);
  }

  resolveDecision(decisionId: string, optionId: string): void {
    const decision = this.decisionQueue.find((item) => item.id === decisionId);
    if (!decision) return;
    const option = decision.options.find((item) => item.id === optionId);
    if (!option) return;

    const project = this.getDecisionTargetProject(decision);
    if (project) {
      project.scriptQuality = clamp(project.scriptQuality + option.scriptQualityDelta, 0, 10);
      project.hypeScore = clamp(project.hypeScore + option.hypeDelta, 0, 100);
      if (typeof option.scheduleDelta === 'number') {
        project.scheduledWeeksRemaining = Math.max(0, project.scheduledWeeksRemaining + option.scheduleDelta);
      }
      if (typeof option.marketingDelta === 'number') {
        project.marketingBudget = Math.max(0, project.marketingBudget + option.marketingDelta);
      }
      if (typeof option.overrunRiskDelta === 'number') {
        project.budget.overrunRisk = clamp(project.budget.overrunRisk + option.overrunRiskDelta, 0.05, 0.75);
      }
    }

    this.cash += option.cashDelta;
    this.studioHeat = clamp(this.studioHeat + (option.studioHeatDelta ?? 0), 0, 100);
    this.applyStoryFlagMutations(option.setFlag, option.clearFlag);
    if (decision.arcId) {
      this.applyArcMutation(decision.arcId, option);
    }
    this.decisionQueue = this.decisionQueue.filter((item) => item.id !== decisionId);
  }

  endWeek(): WeekSummary {
    if (!this.canEndWeek) {
      throw new Error('Resolve all crises before ending the week.');
    }

    const cashBefore = this.cash;
    const events: string[] = [];

    const burn = this.applyWeeklyBurn();
    if (burn > 0) {
      events.push(`Production burn applied: -$${Math.round(burn / 1000)}K`);
    }

    this.applyHypeDecay();
    this.updateTalentAvailability();
    this.tickDecisionExpiry(events);
    this.tickScriptMarketExpiry(events);
    this.tickDistributionWindows(events);
    this.rollForCrises(events);
    this.processRivalTalentAcquisitions(events);
    this.processPlayerNegotiations(events);
    this.generateEventDecisions(events);
    this.tickReleasedFilms(events);
    this.tickRivalHeat(events);
    this.processRivalCalendarMoves(events);
    this.processRivalSignatureMoves(events);
    this.projectOutcomes();

    this.currentWeek += 1;

    const summary: WeekSummary = {
      week: this.currentWeek,
      cashDelta: this.cash - cashBefore,
      events: events.length > 0 ? events : ['Stable week. No major surprises.'],
      hasPendingCrises: this.pendingCrises.length > 0,
      decisionQueueCount: this.decisionQueue.length,
    };
    this.lastWeekSummary = summary;
    return summary;
  }

  getProjectedForProject(projectId: string): {
    critical: number;
    openingLow: number;
    openingHigh: number;
    roi: number;
  } | null {
    const project = this.activeProjects.find((item) => item.id === projectId);
    if (!project) return null;

    const director = this.talentPool.find((item) => item.id === project.directorId);
    const lead = this.talentPool.find((item) => project.castIds.includes(item.id) && item.role === 'leadActor');
    const critical = projectedCriticalScore({
      scriptQuality: project.scriptQuality,
      directorCraft: director?.craftScore ?? 6,
      leadActorCraft: lead?.craftScore ?? 6,
      productionSpend: project.budget.actualSpend,
      conceptStrength: project.conceptStrength,
      editorialCutChoice: 5,
      crisisPenalty: project.productionStatus === 'inCrisis' ? 8 : 0,
      chemistryPenalty: 0,
    });

    const opening = projectedOpeningWeekendRange({
      genre: project.genre,
      hypeScore: project.hypeScore,
      starPower: lead?.starPower ?? 5.5,
      marketingBudget: project.marketingBudget,
      totalBudget: project.budget.ceiling,
    });
    const pressure = this.calendarPressureMultiplier(project.releaseWeek ?? this.currentWeek + 4, project.genre);
    const openingLow = opening.low * pressure;
    const openingHigh = opening.high * pressure;
    const openingMid = opening.midpoint * pressure;

    const roi = projectedROI({
      openingWeekend: openingMid,
      criticalScore: critical,
      audienceScore: clamp(critical + 4, 0, 100),
      genre: project.genre,
      totalCost: project.budget.ceiling + project.marketingBudget,
    });

    return { critical, openingLow, openingHigh, roi };
  }

  private applyWeeklyBurn(): number {
    let total = 0;
    for (const project of this.activeProjects) {
      if (project.phase === 'released') continue;
      const burn = project.budget.ceiling * phaseBurnMultiplier(project.phase);
      total += burn;
      project.budget.actualSpend += burn;
      project.scheduledWeeksRemaining = Math.max(0, project.scheduledWeeksRemaining - 1);
      project.productionStatus = project.budget.actualSpend > project.budget.ceiling ? 'atRisk' : project.productionStatus === 'inCrisis' ? 'inCrisis' : 'onTrack';
    }
    this.cash -= total;
    return total;
  }

  private applyHypeDecay(): void {
    for (const project of this.activeProjects) {
      project.hypeScore = clamp(project.hypeScore - 2, 0, 100);
    }
  }

  private tickDecisionExpiry(events: string[]): void {
    for (const item of this.decisionQueue) {
      item.weeksUntilExpiry -= 1;
    }
    const expired = this.decisionQueue.filter((item) => item.weeksUntilExpiry < 0);
    if (expired.length > 0) {
      this.decisionQueue = this.decisionQueue.filter((item) => item.weeksUntilExpiry >= 0);
      events.push(`${expired.length} decision item(s) expired.`);
      this.studioHeat = clamp(this.studioHeat - expired.length, 0, 100);
    }
  }

  private tickScriptMarketExpiry(events: string[]): void {
    for (const item of this.scriptMarket) {
      item.expiresInWeeks -= 1;
    }
    const expired = this.scriptMarket.filter((item) => item.expiresInWeeks < 0);
    if (expired.length > 0) {
      this.scriptMarket = this.scriptMarket.filter((item) => item.expiresInWeeks >= 0);
      events.push(`${expired.length} script offer(s) expired from market.`);
    }
  }

  private rollForCrises(events: string[]): void {
    const generated: CrisisEvent[] = [];
    for (const project of this.activeProjects) {
      if (!['preProduction', 'production', 'postProduction'].includes(project.phase)) continue;
      const riskBoost = project.budget.overrunRisk * 0.2;
      const baseThreshold =
        project.phase === 'production' ? 0.16 : project.phase === 'postProduction' ? 0.1 : 0.08;
      const rollThreshold = baseThreshold + riskBoost;
      if (this.crisisRng() > rollThreshold) continue;

      const crisis = this.buildOperationalCrisis(project);
      generated.push(crisis);
      project.productionStatus = 'inCrisis';
    }

    if (generated.length > 0) {
      this.pendingCrises.push(...generated);
      events.push(`${generated.length} crisis event(s) triggered.`);
    }
  }

  private generateEventDecisions(events: string[]): void {
    if (this.decisionQueue.length >= 4) return;

    const nextEvent = this.pickWeightedEvent();
    if (!nextEvent) return;

    const project = this.chooseProjectForEvent(nextEvent);
    if (nextEvent.scope === 'project' && !project) return;
    const decision = nextEvent.buildDecision({
      idFactory: id,
      projectId: project?.id ?? null,
      projectTitle: project?.title ?? null,
      currentWeek: this.currentWeek,
    });
    decision.category ??= nextEvent.category;
    decision.sourceEventId ??= nextEvent.id;
    this.decisionQueue.push(decision);
    this.lastEventWeek.set(nextEvent.id, this.currentWeek);
    this.recentDecisionCategories.unshift(nextEvent.category);
    this.recentDecisionCategories = this.recentDecisionCategories.slice(0, 5);
    events.push(`New event: ${nextEvent.title}.`);
  }

  private pickWeightedEvent(): EventTemplate | null {
    const queuedTitles = new Set(this.decisionQueue.map((item) => item.title));
    const weighted = this.eventDeck
      .filter((event) => {
        if (this.currentWeek < event.minWeek) return false;
        if (queuedTitles.has(event.decisionTitle)) return false;
        if (event.requiresFlag && !this.hasStoryFlag(event.requiresFlag)) return false;
        if (event.blocksFlag && this.hasStoryFlag(event.blocksFlag)) return false;
        if (event.requiresArc && !this.matchesArcRequirement(event.requiresArc)) return false;
        if (event.blocksArc && this.matchesArcRequirement(event.blocksArc)) return false;
        const lastWeek = this.lastEventWeek.get(event.id);
        if (lastWeek !== undefined && this.currentWeek - lastWeek < event.cooldownWeeks) return false;
        return true;
      })
      .map((event) => ({ event, weight: this.eventWeight(event) }))
      .filter((entry) => entry.weight > 0);

    if (weighted.length === 0) return null;

    const total = weighted.reduce((sum, item) => sum + item.weight, 0);
    let roll = this.eventRng() * total;
    for (const entry of weighted) {
      roll -= entry.weight;
      if (roll <= 0) return entry.event;
    }
    return weighted[weighted.length - 1].event;
  }

  private eventWeight(event: EventTemplate): number {
    let weight = event.baseWeight;
    const candidates = this.getEventProjectCandidates(event);
    if (event.scope === 'project' && candidates.length === 0) return 0;

    if (event.scope === 'project') {
      weight += Math.min(1.3, candidates.length * 0.32);
    }

    if (event.category === 'finance' && this.cash < 25_000_000) {
      weight += 0.45;
    }
    if (event.category === 'marketing' && this.studioHeat < 25) {
      weight += 0.35;
    }
    if (event.category === 'operations' && this.pendingCrises.length > 0) {
      weight *= 0.75;
    }

    const arcId = this.getEventArcId(event);
    if (arcId) {
      weight += this.getArcPressureFromRivals(arcId);
    }

    if (this.recentDecisionCategories[0] === event.category) {
      weight *= 0.7;
    }
    if (this.recentDecisionCategories[0] === event.category && this.recentDecisionCategories[1] === event.category) {
      weight *= 0.55;
    }

    return weight;
  }

  private getEventArcId(event: EventTemplate): string | null {
    return event.requiresArc?.id ?? event.blocksArc?.id ?? null;
  }

  private getArcPressureFromRivals(arcId: string): number {
    let pressure = 0;
    for (const rival of this.rivals) {
      const profile = this.getRivalBehaviorProfile(rival);
      pressure += profile.arcPressure[arcId] ?? 0;
    }
    return clamp(pressure / Math.max(1, this.rivals.length), 0, 0.7);
  }

  private getEventProjectCandidates(event: EventTemplate): MovieProject[] {
    if (event.scope !== 'project') return [];
    if (!event.targetPhases || event.targetPhases.length === 0) {
      return this.activeProjects.filter((project) => project.phase !== 'released');
    }
    return this.activeProjects.filter((project) => event.targetPhases?.includes(project.phase));
  }

  private chooseProjectForEvent(event: EventTemplate): MovieProject | null {
    const candidates = this.getEventProjectCandidates(event);
    if (candidates.length === 0) return null;
    const ranked = [...candidates].sort((a, b) => b.hypeScore - a.hypeScore);
    const selectionPool = ranked.slice(0, Math.min(3, ranked.length));
    const index = Math.floor(this.eventRng() * selectionPool.length);
    return selectionPool[index] ?? selectionPool[0] ?? null;
  }

  private hasStoryFlag(flag: string): boolean {
    return (this.storyFlags[flag] ?? 0) > 0;
  }

  private matchesArcRequirement(input: {
    id: string;
    minStage?: number;
    maxStage?: number;
    status?: 'active' | 'resolved' | 'failed';
  }): boolean {
    const arc = this.storyArcs[input.id];
    if (!arc) return false;
    if (input.status && arc.status !== input.status) return false;
    if (typeof input.minStage === 'number' && arc.stage < input.minStage) return false;
    if (typeof input.maxStage === 'number' && arc.stage > input.maxStage) return false;
    return true;
  }

  private ensureArcState(arcId: string): StoryArcState {
    if (!this.storyArcs[arcId]) {
      this.storyArcs[arcId] = {
        stage: 0,
        status: 'active',
        lastUpdatedWeek: this.currentWeek,
      };
    }
    return this.storyArcs[arcId];
  }

  private applyArcMutation(arcId: string, option: DecisionItem['options'][number]): void {
    const arc = this.ensureArcState(arcId);
    if (typeof option.setArcStage === 'number') {
      arc.stage = Math.max(0, option.setArcStage);
    }
    if (typeof option.advanceArcBy === 'number') {
      arc.stage = Math.max(0, arc.stage + option.advanceArcBy);
    }
    if (option.resolveArc) {
      arc.status = 'resolved';
    } else if (option.failArc) {
      arc.status = 'failed';
    } else {
      arc.status = 'active';
    }
    arc.lastUpdatedWeek = this.currentWeek;
  }

  private applyStoryFlagMutations(setFlag?: string, clearFlag?: string): void {
    if (setFlag) {
      this.storyFlags[setFlag] = (this.storyFlags[setFlag] ?? 0) + 1;
    }
    if (clearFlag) {
      delete this.storyFlags[clearFlag];
    }
  }

  private getDecisionTargetProject(decision: DecisionItem): MovieProject | null {
    if (decision.projectId) {
      return this.activeProjects.find((item) => item.id === decision.projectId) ?? null;
    }
    const ranked = this.activeProjects
      .filter((project) => project.phase !== 'released')
      .sort((a, b) => b.hypeScore - a.hypeScore);
    return ranked[0] ?? this.activeProjects[0] ?? null;
  }

  private buildOperationalCrisis(project: MovieProject): CrisisEvent {
    const phaseTemplates: {
      title: string;
      body: string;
      severity: CrisisEvent['severity'];
      options: CrisisEvent['options'];
    }[] =
      project.phase === 'preProduction'
        ? [
            {
              title: 'Location Permit Reversal',
              body: 'Primary location permits were rescinded. Prep schedule is at risk.',
              severity: 'orange',
              options: [
                {
                  id: id('c-opt'),
                  label: 'Pay Fast-Track Permit Counsel',
                  preview: '-$260K now, keep prep moving.',
                  cashDelta: -260_000,
                  scheduleDelta: 0,
                  hypeDelta: 0,
                },
                {
                  id: id('c-opt'),
                  label: 'Re-scout Alternate Locations',
                  preview: 'Lower spend, but schedule slips one week.',
                  cashDelta: -80_000,
                  scheduleDelta: 1,
                  hypeDelta: -1,
                },
              ],
            },
            {
              title: 'Department Head Walkout Threat',
              body: 'A key department requests contract revisions before lock.',
              severity: 'orange',
              options: [
                {
                  id: id('c-opt'),
                  label: 'Approve Contract Bump',
                  preview: '-$220K now, no delay.',
                  cashDelta: -220_000,
                  scheduleDelta: 0,
                  hypeDelta: 0,
                },
                {
                  id: id('c-opt'),
                  label: 'Re-negotiate Through Delay',
                  preview: 'Save cash but lose one prep week and confidence.',
                  cashDelta: -40_000,
                  scheduleDelta: 1,
                  hypeDelta: -2,
                },
              ],
            },
          ]
        : project.phase === 'postProduction'
          ? [
              {
                title: 'VFX Vendor Capacity Crunch',
                body: 'Your primary vendor lost capacity to a tentpole competitor.',
                severity: 'orange',
                options: [
                  {
                    id: id('c-opt'),
                    label: 'Pay For Priority Lane',
                    preview: '-$300K now, lock delivery date.',
                    cashDelta: -300_000,
                    scheduleDelta: 0,
                    hypeDelta: 0,
                  },
                  {
                    id: id('c-opt'),
                    label: 'Delay Final Deliverables',
                    preview: 'Smaller immediate cost, but post slips by one week.',
                    cashDelta: -70_000,
                    scheduleDelta: 1,
                    hypeDelta: -2,
                  },
                ],
              },
              {
                title: 'Score Recording Overrun',
                body: 'Orchestral sessions are exceeding booked stage time.',
                severity: 'yellow',
                options: [
                  {
                    id: id('c-opt'),
                    label: 'Extend Sessions',
                    preview: '-$180K now, preserve score quality.',
                    cashDelta: -180_000,
                    scheduleDelta: 0,
                    hypeDelta: 1,
                  },
                  {
                    id: id('c-opt'),
                    label: 'Scale Back Arrangement',
                    preview: 'Save cash, but lose some polish and buzz.',
                    cashDelta: -40_000,
                    scheduleDelta: 0,
                    hypeDelta: -2,
                  },
                ],
              },
            ]
          : [
              {
                title: 'Lead Actor Scheduling Conflict',
                body: 'A hard conflict puts next week shooting at risk.',
                severity: project.productionStatus === 'atRisk' ? 'red' : 'orange',
                options: [
                  {
                    id: id('c-opt'),
                    label: 'Pay Overtime to Keep Schedule',
                    preview: '-$450K now, no schedule slip.',
                    cashDelta: -450_000,
                    scheduleDelta: 0,
                    hypeDelta: 0,
                  },
                  {
                    id: id('c-opt'),
                    label: 'Delay One Week',
                    preview: 'Save cash, but schedule slips and press chatter starts.',
                    cashDelta: -50_000,
                    scheduleDelta: 1,
                    hypeDelta: -3,
                  },
                ],
              },
              {
                title: 'Set Build Failure',
                body: 'A key practical set failed safety checks before principal photography.',
                severity: 'orange',
                options: [
                  {
                    id: id('c-opt'),
                    label: 'Rebuild Immediately',
                    preview: '-$380K now, schedule protected.',
                    cashDelta: -380_000,
                    scheduleDelta: 0,
                    hypeDelta: 0,
                  },
                  {
                    id: id('c-opt'),
                    label: 'Rewrite Around Set',
                    preview: 'Save cash, but lose one week and some excitement.',
                    cashDelta: -90_000,
                    scheduleDelta: 1,
                    hypeDelta: -2,
                  },
                ],
              },
              {
                title: 'Second Unit Incident',
                body: 'A second unit incident pauses action coverage for safety review.',
                severity: 'red',
                options: [
                  {
                    id: id('c-opt'),
                    label: 'Bring In Replacement Unit',
                    preview: '-$520K now to hold momentum.',
                    cashDelta: -520_000,
                    scheduleDelta: 0,
                    hypeDelta: -1,
                  },
                  {
                    id: id('c-opt'),
                    label: 'Hold For Safety Reset',
                    preview: 'Lower immediate spend, but lose two shooting weeks.',
                    cashDelta: -120_000,
                    scheduleDelta: 2,
                    hypeDelta: -3,
                  },
                ],
              },
            ];

    const selected = phaseTemplates[Math.floor(this.crisisRng() * phaseTemplates.length)] ?? phaseTemplates[0];
    return {
      id: id('crisis'),
      projectId: project.id,
      kind: 'production',
      title: selected.title,
      severity: selected.severity,
      body: selected.body,
      options: selected.options,
    };
  }

  private projectOutcomes(): void {
    for (const project of this.activeProjects) {
      const projection = this.getProjectedForProject(project.id);
      if (!projection) continue;
      project.projectedROI = projection.roi;
    }
  }

  private tickReleasedFilms(events: string[]): void {
    for (const project of this.activeProjects) {
      if (project.phase !== 'released') continue;
      if (project.releaseResolved) continue;
      if (!project.finalBoxOffice || !project.openingWeekendGross) continue;

      if (project.releaseWeeksRemaining > 0) {
        const decayFactor = 0.62 + project.releaseWeeksRemaining * 0.015;
        const lastWeek =
          project.weeklyGrossHistory[project.weeklyGrossHistory.length - 1] ?? project.openingWeekendGross;
        const weekly = Math.max(250_000, lastWeek * decayFactor);
        project.weeklyGrossHistory.push(weekly);
        project.finalBoxOffice += weekly;
        project.releaseWeeksRemaining -= 1;
      }

      if (project.releaseWeeksRemaining <= 0) {
        const totalCost = project.budget.ceiling + project.marketingBudget;
        const netRevenue = project.finalBoxOffice * project.studioRevenueShare;
        project.projectedROI = netRevenue / Math.max(1, totalCost);
        const heatDelta = heatDeltaFromRelease({
          currentHeat: this.studioHeat,
          criticalScore: project.criticalScore ?? 50,
          roi: project.projectedROI,
          awardsNominations: 0,
          awardsWins: 0,
          controversyPenalty: 0,
        });
        this.studioHeat = clamp(this.studioHeat + heatDelta, 0, 100);
        project.releaseResolved = true;
        events.push(
          `${project.title} completed theatrical run. Heat ${heatDelta >= 0 ? '+' : ''}${heatDelta.toFixed(0)}.`
        );
      }
    }
  }

  private estimateReleaseRunWeeks(project: MovieProject): number {
    const quality = ((project.criticalScore ?? 50) + (project.audienceScore ?? 50)) / 2;
    if (quality >= 85) return 8;
    if (quality >= 70) return 6;
    if (quality >= 55) return 5;
    return 4;
  }

  private tickRivalHeat(events: string[]): void {
    for (const rival of this.rivals) {
      const baseVolatility = this.rivalRng() * 10 - 5;
      const personalityBias = this.rivalHeatBias(rival.personality);
      const delta = clamp(baseVolatility + personalityBias, -12, 14);
      if (Math.abs(delta) < 3) continue;

      rival.studioHeat = clamp(rival.studioHeat + delta, 0, 100);
      const item: IndustryNewsItem = {
        id: id('news'),
        week: this.currentWeek + 1,
        studioName: rival.name,
        headline: this.rivalNewsHeadline(rival.name, delta),
        heatDelta: delta,
      };
      this.industryNewsLog.unshift(item);
      events.push(item.headline);
    }
    this.industryNewsLog = this.industryNewsLog.slice(0, 60);
  }

  private processRivalTalentAcquisitions(events: string[]): void {
    for (const rival of this.rivals) {
      const profile = this.getRivalBehaviorProfile(rival);
      if (this.rivalRng() > profile.talentPoachChance) continue;
      const candidates = this.talentPool.filter((talent) =>
        talent.availability === 'available' || talent.availability === 'inNegotiation'
      );
      if (candidates.length === 0) continue;

      const picked = this.pickTalentForRival(rival, candidates);
      if (!picked) continue;

      const unavailableUntil = this.currentWeek + 12 + Math.floor(this.rivalRng() * 18);
      picked.availability = 'unavailable';
      picked.unavailableUntilWeek = unavailableUntil;
      picked.attachedProjectId = null;
      if (!rival.lockedTalentIds.includes(picked.id)) {
        rival.lockedTalentIds.push(picked.id);
      }

      if (this.playerNegotiations.some((item) => item.talentId === picked.id)) {
        const negotiation = this.playerNegotiations.find((item) => item.talentId === picked.id);
        if (negotiation) {
          this.pendingCrises.push({
            id: id('crisis'),
            projectId: negotiation.projectId,
            kind: 'talentPoached',
            title: `${picked.name} just closed with ${rival.name}`,
            severity: 'red',
            body: 'Counter-offer now at a premium or walk away.',
            options: [
              {
                id: id('c-opt'),
                label: 'Counter Offer (25% premium)',
                preview: 'Higher cost, chance to reclaim attachment.',
                cashDelta: 0,
                scheduleDelta: 0,
                hypeDelta: 1,
                kind: 'talentCounter',
                talentId: picked.id,
                rivalStudioId: rival.id,
                premiumMultiplier: 1.25,
              },
              {
                id: id('c-opt'),
                label: 'Walk Away',
                preview: 'Save cash, lose momentum and relationship.',
                cashDelta: 0,
                scheduleDelta: 0,
                hypeDelta: -2,
                kind: 'talentWalk',
                talentId: picked.id,
                rivalStudioId: rival.id,
              },
            ],
          });
          events.push(`${rival.name} poached ${picked.name}. Counter-offer decision required.`);
        }
      } else {
        events.push(`${rival.name} attached ${picked.name}. Available again around week ${unavailableUntil}.`);
      }
    }
  }

  private processPlayerNegotiations(events: string[]): void {
    const resolved: string[] = [];
    for (const negotiation of this.playerNegotiations) {
      if (this.currentWeek - negotiation.openedWeek < 1) continue;
      const talent = this.talentPool.find((item) => item.id === negotiation.talentId);
      const project = this.activeProjects.find((item) => item.id === negotiation.projectId);
      if (!talent || !project) {
        resolved.push(negotiation.talentId);
        continue;
      }
      if (talent.availability !== 'inNegotiation') {
        resolved.push(negotiation.talentId);
        continue;
      }

      const difficulty = AGENT_DIFFICULTY[talent.agentTier] + talent.egoLevel * 0.04;
      const chance = clamp(
        0.7 + this.studioHeat / 220 + talent.studioRelationship * 0.15 - difficulty * 0.2,
        0.15,
        0.95
      );
      if (this.negotiationRng() <= chance) {
        this.finalizeTalentAttachment(project, talent);
        events.push(`${talent.name} accepted terms with ${this.studioName}.`);
      } else {
        talent.availability = 'available';
        events.push(`${talent.name} declined final terms.`);
      }
      resolved.push(negotiation.talentId);
    }
    if (resolved.length > 0) {
      this.playerNegotiations = this.playerNegotiations.filter((item) => !resolved.includes(item.talentId));
    }
  }

  private processRivalCalendarMoves(events: string[]): void {
    const playerDistribution = this.activeProjects.filter(
      (project) => project.phase === 'distribution' && project.releaseWeek !== null
    );
    for (const rival of this.rivals) {
      const profile = this.getRivalBehaviorProfile(rival);
      if (this.rivalRng() > profile.calendarMoveChance) continue;

      const target = playerDistribution[Math.floor(this.rivalRng() * Math.max(1, playerDistribution.length))];
      const forceConflict = !!target && this.rivalRng() < profile.conflictPush;
      const week = forceConflict && target.releaseWeek ? target.releaseWeek : this.currentWeek + 2 + Math.floor(this.rivalRng() * 14);
      const genre: MovieGenre = (['action', 'drama', 'comedy', 'horror', 'thriller', 'sciFi', 'animation', 'documentary'] as MovieGenre[])[
        Math.floor(this.rivalRng() * 8)
      ];

      const film: RivalFilm = {
        id: id('r-film'),
        title: `${rival.name.split(' ')[0]} Untitled ${this.currentWeek}`,
        genre,
        releaseWeek: week,
        releaseWindow: 'wideTheatrical',
        estimatedBudget: (20_000_000 + this.rivalRng() * 120_000_000) * profile.budgetScale,
        hypeScore: clamp((35 + this.rivalRng() * 45) * profile.hypeScale, 20, 98),
        finalGross: null,
        criticalScore: null,
      };

      rival.upcomingReleases.unshift(film);
      rival.upcomingReleases = rival.upcomingReleases
        .filter((item) => item.releaseWeek >= this.currentWeek - 1)
        .slice(0, 10);
      events.push(`${rival.name} scheduled ${film.title} for week ${film.releaseWeek}.`);

      if (target && target.releaseWeek && Math.abs(target.releaseWeek - film.releaseWeek) <= 0) {
        this.pendingCrises.push({
          id: id('crisis'),
          projectId: target.id,
          kind: 'releaseConflict',
          title: `${rival.name} moved into your release window`,
          severity: 'orange',
          body: `Projected opening is under pressure in week ${target.releaseWeek}.`,
          options: [
            {
              id: id('c-opt'),
              label: 'Hold Position',
              preview: 'Keep date and absorb competitive pressure.',
              cashDelta: 0,
              scheduleDelta: 0,
              hypeDelta: 0,
              releaseWeekShift: 0,
              kind: 'releaseHold',
            },
            {
              id: id('c-opt'),
              label: 'Shift 1 Week Earlier',
              preview: 'Move early to avoid overlap.',
              cashDelta: -120_000,
              scheduleDelta: 0,
              hypeDelta: -1,
              releaseWeekShift: -1,
              kind: 'releaseShift',
            },
            {
              id: id('c-opt'),
              label: 'Delay 4 Weeks',
              preview: 'Wait for cleaner window; costs additional carry.',
              cashDelta: -250_000,
              scheduleDelta: 0,
              hypeDelta: 1,
              releaseWeekShift: 4,
              kind: 'releaseShift',
            },
          ],
        });
      }
    }
  }

  private processRivalSignatureMoves(events: string[]): void {
    for (const rival of this.rivals) {
      const profile = this.getRivalBehaviorProfile(rival);
      if (this.rivalRng() > profile.signatureMoveChance) continue;

      if (rival.personality === 'blockbusterFactory') {
        const target = this.activeProjects.find((project) => project.phase === 'distribution' && project.releaseWeek !== null);
        if (target?.releaseWeek) {
          rival.upcomingReleases.unshift({
            id: id('r-film'),
            title: `${rival.name.split(' ')[0]} Event Tentpole`,
            genre: 'action',
            releaseWeek: target.releaseWeek,
            releaseWindow: 'wideTheatrical',
            estimatedBudget: 170_000_000 + this.rivalRng() * 80_000_000,
            hypeScore: 80 + this.rivalRng() * 15,
            finalGross: null,
            criticalScore: null,
          });
          const hadFlag = this.hasStoryFlag('rival_tentpole_threat');
          this.storyFlags.rival_tentpole_threat = (this.storyFlags.rival_tentpole_threat ?? 0) + 1;
          if (!hadFlag) {
            this.queueRivalCounterplayDecision('rival_tentpole_threat', rival.name, target.id);
          }
          events.push(`${rival.name} dropped a four-quadrant tentpole into your weekend corridor.`);
        }
        continue;
      }

      if (rival.personality === 'prestigeHunter') {
        this.studioHeat = clamp(this.studioHeat - 1.5, 0, 100);
        const hadFlag = this.hasStoryFlag('awards_headwind');
        this.storyFlags.awards_headwind = (this.storyFlags.awards_headwind ?? 0) + 1;
        if (!hadFlag) {
          this.queueRivalCounterplayDecision('awards_headwind', rival.name);
        }
        events.push(`${rival.name} dominated guild chatter this week. Awards headwind intensified.`);
        continue;
      }

      if (rival.personality === 'genreSpecialist') {
        const targetTalent = this.talentPool
          .filter((talent) => talent.availability === 'available' && talent.role !== 'director')
          .sort((a, b) => b.craftScore - a.craftScore)[0];
        if (targetTalent) {
          targetTalent.availability = 'unavailable';
          targetTalent.unavailableUntilWeek = this.currentWeek + 6;
          if (!rival.lockedTalentIds.includes(targetTalent.id)) {
            rival.lockedTalentIds.push(targetTalent.id);
          }
          const hadFlag = this.hasStoryFlag('rival_talent_lock');
          this.storyFlags.rival_talent_lock = (this.storyFlags.rival_talent_lock ?? 0) + 1;
          if (!hadFlag) {
            this.queueRivalCounterplayDecision('rival_talent_lock', rival.name);
          }
          events.push(`${rival.name} locked ${targetTalent.name} into a niche franchise hold.`);
        }
        continue;
      }

      if (rival.personality === 'streamingFirst') {
        const project = this.activeProjects.find((item) => item.phase === 'distribution');
        if (project) {
          this.distributionOffers.push({
            id: id('deal'),
            projectId: project.id,
            partner: `${rival.name} Stream+`,
            releaseWindow: 'streamingExclusive',
            minimumGuarantee: project.budget.ceiling * 0.4,
            pAndACommitment: project.budget.ceiling * 0.05,
            revenueShareToStudio: 0.66,
            projectedOpeningOverride: 0.72,
          });
          const hadFlag = this.hasStoryFlag('streaming_pressure');
          this.storyFlags.streaming_pressure = (this.storyFlags.streaming_pressure ?? 0) + 1;
          if (!hadFlag) {
            this.queueRivalCounterplayDecision('streaming_pressure', rival.name, project.id);
          }
          events.push(`${rival.name} floated an aggressive streaming pre-buy into your distribution stack.`);
        }
        continue;
      }

      if (rival.personality === 'scrappyUpstart') {
        const targetProject = this.activeProjects.find((project) => project.phase === 'distribution' || project.phase === 'released');
        if (targetProject) {
          targetProject.hypeScore = clamp(targetProject.hypeScore - 2, 0, 100);
          const hadFlag = this.hasStoryFlag('guerrilla_pressure');
          this.storyFlags.guerrilla_pressure = (this.storyFlags.guerrilla_pressure ?? 0) + 1;
          if (!hadFlag) {
            this.queueRivalCounterplayDecision('guerrilla_pressure', rival.name, targetProject.id);
          }
          events.push(`${rival.name} ran a guerrilla social blitz that clipped hype on ${targetProject.title}.`);
        }
      }
    }
  }

  private queueRivalCounterplayDecision(flag: string, rivalName: string, projectId?: string): void {
    if (this.decisionQueue.length >= 5) return;
    const targetProject = projectId ? this.activeProjects.find((item) => item.id === projectId) : null;

    if (flag === 'rival_tentpole_threat') {
      const title = `Counterplay: ${rivalName} Tentpole Threat`;
      if (this.decisionQueue.some((item) => item.title === title)) return;
      this.decisionQueue.push({
        id: id('decision'),
        projectId: targetProject?.id ?? null,
        category: 'marketing',
        title,
        body: 'A major rival crowded your release corridor. Choose how to defend opening week share.',
        weeksUntilExpiry: 1,
        options: [
          {
            id: id('opt'),
            label: 'Authorize Competitive Blitz',
            preview: 'Spend to defend awareness and trailer share.',
            cashDelta: -260_000,
            scriptQualityDelta: 0,
            hypeDelta: 3,
            studioHeatDelta: 1,
            clearFlag: 'rival_tentpole_threat',
          },
          {
            id: id('opt'),
            label: 'Shift Date One Week',
            preview: 'Reduce collision risk with moderate transition cost.',
            cashDelta: -120_000,
            scriptQualityDelta: 0,
            hypeDelta: -1,
            clearFlag: 'rival_tentpole_threat',
          },
        ],
      });
      return;
    }

    if (flag === 'awards_headwind') {
      const title = `Counterplay: ${rivalName} Awards Surge`;
      if (this.decisionQueue.some((item) => item.title === title)) return;
      this.decisionQueue.push({
        id: id('decision'),
        projectId: null,
        category: 'marketing',
        title,
        body: 'Awards conversation shifted away from your slate. Decide whether to contest the narrative.',
        weeksUntilExpiry: 1,
        options: [
          {
            id: id('opt'),
            label: 'Launch Guild Counter-Campaign',
            preview: 'Spend to recover influence with voters and press.',
            cashDelta: -180_000,
            scriptQualityDelta: 0,
            hypeDelta: 1,
            studioHeatDelta: 2,
            clearFlag: 'awards_headwind',
          },
          {
            id: id('opt'),
            label: 'Conserve Budget',
            preview: 'Protect cash but accept a temporary prestige dip.',
            cashDelta: 0,
            scriptQualityDelta: 0,
            hypeDelta: -1,
            studioHeatDelta: -1,
            clearFlag: 'awards_headwind',
          },
        ],
      });
      return;
    }

    if (flag === 'rival_talent_lock') {
      const title = `Counterplay: ${rivalName} Talent Lock`;
      if (this.decisionQueue.some((item) => item.title === title)) return;
      this.decisionQueue.push({
        id: id('decision'),
        projectId: null,
        category: 'talent',
        title,
        body: 'Rival package deals are squeezing your talent access. Choose your labor strategy.',
        weeksUntilExpiry: 1,
        options: [
          {
            id: id('opt'),
            label: 'Fund Retention Incentives',
            preview: 'Spend to improve relationship strength across reps.',
            cashDelta: -220_000,
            scriptQualityDelta: 0,
            hypeDelta: 1,
            studioHeatDelta: 1,
            clearFlag: 'rival_talent_lock',
          },
          {
            id: id('opt'),
            label: 'Scout Emerging Talent',
            preview: 'Smaller spend, slightly slower impact, broader optionality.',
            cashDelta: -80_000,
            scriptQualityDelta: 0,
            hypeDelta: 1,
            clearFlag: 'rival_talent_lock',
          },
        ],
      });
      return;
    }

    if (flag === 'streaming_pressure') {
      const title = `Counterplay: ${rivalName} Streaming Pressure`;
      if (this.decisionQueue.some((item) => item.title === title)) return;
      this.decisionQueue.push({
        id: id('decision'),
        projectId: targetProject?.id ?? null,
        category: 'finance',
        title,
        body: 'Aggressive streaming terms are distorting your release leverage.',
        weeksUntilExpiry: 1,
        options: [
          {
            id: id('opt'),
            label: 'Secure Theater Incentive Bundle',
            preview: 'Spend now to protect theatrical leverage.',
            cashDelta: -200_000,
            scriptQualityDelta: 0,
            hypeDelta: 2,
            studioHeatDelta: 1,
            clearFlag: 'streaming_pressure',
          },
          {
            id: id('opt'),
            label: 'Take Hybrid Safety Deal',
            preview: 'Accept immediate cash and de-risk near-term window.',
            cashDelta: 150_000,
            scriptQualityDelta: 0,
            hypeDelta: -1,
            clearFlag: 'streaming_pressure',
          },
        ],
      });
      return;
    }

    if (flag === 'guerrilla_pressure') {
      const title = `Counterplay: ${rivalName} Guerrilla Blitz`;
      if (this.decisionQueue.some((item) => item.title === title)) return;
      this.decisionQueue.push({
        id: id('decision'),
        projectId: targetProject?.id ?? null,
        category: 'marketing',
        title,
        body: 'A rival social blitz is pulling mindshare away from your campaign.',
        weeksUntilExpiry: 1,
        options: [
          {
            id: id('opt'),
            label: 'Run Community Counter-Blitz',
            preview: 'Low cost and quick response to regain attention.',
            cashDelta: -90_000,
            scriptQualityDelta: 0,
            hypeDelta: 2,
            clearFlag: 'guerrilla_pressure',
          },
          {
            id: id('opt'),
            label: 'Ignore The Noise',
            preview: 'No spend, but campaign momentum softens.',
            cashDelta: 0,
            scriptQualityDelta: 0,
            hypeDelta: -1,
            clearFlag: 'guerrilla_pressure',
          },
        ],
      });
    }
  }

  private calendarPressureMultiplier(week: number, genre: MovieGenre): number {
    let pressure = 1;
    const rivalFilms = this.rivals
      .flatMap((rival) => rival.upcomingReleases)
      .filter((film) => Math.abs(film.releaseWeek - week) <= 1);

    for (const rivalFilm of rivalFilms) {
      const budgetPenalty = rivalFilm.estimatedBudget > 100_000_000 ? 0.12 : 0.05;
      const genreOverlap = rivalFilm.genre === genre ? 0.08 : 0.02;
      pressure -= budgetPenalty + genreOverlap;
    }
    return Math.max(0.45, pressure);
  }

  private pickTalentForRival(rival: RivalStudio, candidates: Talent[]): Talent | null {
    if (candidates.length === 0) return null;
    let sorted = [...candidates];
    if (rival.personality === 'blockbusterFactory') {
      sorted.sort((a, b) => b.starPower - a.starPower);
    } else if (rival.personality === 'prestigeHunter') {
      sorted.sort((a, b) => b.craftScore - a.craftScore);
    } else if (rival.personality === 'genreSpecialist') {
      sorted.sort((a, b) => b.egoLevel - a.egoLevel);
    } else {
      sorted.sort(() => this.rivalRng() - 0.5);
    }
    return sorted[0] ?? null;
  }

  private finalizeTalentAttachment(project: MovieProject, talent: Talent): void {
    const retainer = talent.salary.base * 0.08;
    if (this.cash < retainer) {
      talent.availability = 'available';
      return;
    }
    this.cash -= retainer;
    talent.availability = 'attached';
    talent.unavailableUntilWeek = null;
    talent.attachedProjectId = project.id;
    if (talent.role === 'director') {
      project.directorId = talent.id;
    } else if (talent.role === 'leadActor' || talent.role === 'supportingActor') {
      if (!project.castIds.includes(talent.id)) {
        project.castIds.push(talent.id);
      }
    }
    project.hypeScore = clamp(project.hypeScore + talent.starPower * 0.8, 0, 100);
  }

  private resolveTalentPoachCrisis(project: MovieProject, option: CrisisEvent['options'][number]): void {
    const talent = this.talentPool.find((item) => item.id === option.talentId);
    if (!talent) return;
    const rival = this.rivals.find((item) => item.id === option.rivalStudioId);

    if (option.kind === 'talentCounter') {
      const premium = option.premiumMultiplier ?? 1.25;
      const cost = talent.salary.base * 0.2 * premium;
      const chance = clamp(0.55 + this.studioHeat / 210 + talent.studioRelationship * 0.2, 0.15, 0.95);
      if (this.cash >= cost && this.negotiationRng() <= chance) {
        this.cash -= cost;
        if (rival) {
          rival.lockedTalentIds = rival.lockedTalentIds.filter((idValue) => idValue !== talent.id);
        }
        this.finalizeTalentAttachment(project, talent);
      }
    }

    if (option.kind === 'talentWalk') {
      project.hypeScore = clamp(project.hypeScore - 2, 0, 100);
    }

    this.playerNegotiations = this.playerNegotiations.filter((item) => item.talentId !== talent.id);
  }

  private updateTalentAvailability(): void {
    for (const talent of this.talentPool) {
      if (talent.availability !== 'unavailable') continue;
      if (!talent.unavailableUntilWeek) continue;
      if (this.currentWeek < talent.unavailableUntilWeek) continue;
      talent.availability = 'available';
      talent.unavailableUntilWeek = null;
      for (const rival of this.rivals) {
        rival.lockedTalentIds = rival.lockedTalentIds.filter((idValue) => idValue !== talent.id);
      }
    }
  }

  private rivalHeatBias(personality: RivalStudio['personality']): number {
    switch (personality) {
      case 'blockbusterFactory':
        return 0.8;
      case 'prestigeHunter':
        return 0.5;
      case 'genreSpecialist':
        return 0.2;
      case 'streamingFirst':
        return -0.2;
      case 'scrappyUpstart':
        return 0;
      default:
        return 0;
    }
  }

  private getRivalBehaviorProfile(rival: RivalStudio): {
    arcPressure: Record<string, number>;
    talentPoachChance: number;
    calendarMoveChance: number;
    conflictPush: number;
    signatureMoveChance: number;
    budgetScale: number;
    hypeScale: number;
  } {
    switch (rival.personality) {
      case 'blockbusterFactory':
        return {
          arcPressure: {
            'exhibitor-war': 0.6,
            'franchise-pivot': 0.5,
            'leak-piracy': 0.2,
          },
          talentPoachChance: 0.32,
          calendarMoveChance: 0.4,
          conflictPush: 0.5,
          signatureMoveChance: 0.22,
          budgetScale: 1.4,
          hypeScale: 1.25,
        };
      case 'prestigeHunter':
        return {
          arcPressure: {
            'awards-circuit': 0.6,
            'financier-control': 0.2,
            'talent-meltdown': 0.2,
          },
          talentPoachChance: 0.28,
          calendarMoveChance: 0.24,
          conflictPush: 0.2,
          signatureMoveChance: 0.2,
          budgetScale: 0.9,
          hypeScale: 1.05,
        };
      case 'genreSpecialist':
        return {
          arcPressure: {
            'talent-meltdown': 0.45,
            'leak-piracy': 0.25,
          },
          talentPoachChance: 0.38,
          calendarMoveChance: 0.3,
          conflictPush: 0.28,
          signatureMoveChance: 0.18,
          budgetScale: 1.05,
          hypeScale: 1.1,
        };
      case 'streamingFirst':
        return {
          arcPressure: {
            'exhibitor-war': 0.3,
            'financier-control': 0.35,
            'franchise-pivot': 0.2,
          },
          talentPoachChance: 0.24,
          calendarMoveChance: 0.18,
          conflictPush: 0.18,
          signatureMoveChance: 0.24,
          budgetScale: 0.85,
          hypeScale: 0.95,
        };
      case 'scrappyUpstart':
        return {
          arcPressure: {
            'talent-meltdown': 0.3,
            'leak-piracy': 0.3,
            'financier-control': 0.25,
          },
          talentPoachChance: 0.3,
          calendarMoveChance: 0.26,
          conflictPush: 0.3,
          signatureMoveChance: 0.2,
          budgetScale: 0.8,
          hypeScale: 1.15,
        };
      default:
        return {
          arcPressure: {},
          talentPoachChance: 0.3,
          calendarMoveChance: 0.28,
          conflictPush: 0.3,
          signatureMoveChance: 0.15,
          budgetScale: 1,
          hypeScale: 1,
        };
    }
  }

  private rivalNewsHeadline(name: string, delta: number): string {
    if (delta >= 8) return `${name} lands a breakout hit. Heat +${delta.toFixed(0)}.`;
    if (delta >= 3) return `${name} posts a solid industry week. Heat +${delta.toFixed(0)}.`;
    if (delta <= -8) return `${name} stumbles on a costly miss. Heat ${delta.toFixed(0)}.`;
    return `${name} slips in the market conversation. Heat ${delta.toFixed(0)}.`;
  }

  private tickDistributionWindows(events: string[]): void {
    for (const project of this.activeProjects) {
      if (project.phase !== 'distribution') continue;
      if (project.releaseWindow) continue;
      if (this.getOffersForProject(project.id).length === 0) {
        this.generateDistributionOffers(project.id);
        events.push(`New distribution offers received for ${project.title}.`);
      }
    }
  }

  private generateDistributionOffers(projectId: string): void {
    const project = this.activeProjects.find((item) => item.id === projectId);
    if (!project) return;
    this.distributionOffers = this.distributionOffers.filter((item) => item.projectId !== projectId);

    const base = project.budget.ceiling * 0.2;
    const hypeFactor = 1 + project.hypeScore / 200;
    const offers: DistributionOffer[] = [
      {
        id: id('deal'),
        projectId,
        partner: 'Aster Peak Pictures',
        releaseWindow: 'wideTheatrical',
        minimumGuarantee: base * 1.2 * hypeFactor,
        pAndACommitment: project.budget.ceiling * 0.12,
        revenueShareToStudio: 0.54,
        projectedOpeningOverride: 1.15,
      },
      {
        id: id('deal'),
        projectId,
        partner: 'Northstream',
        releaseWindow: 'streamingExclusive',
        minimumGuarantee: base * 1.55,
        pAndACommitment: project.budget.ceiling * 0.06,
        revenueShareToStudio: 0.62,
        projectedOpeningOverride: 0.8,
      },
      {
        id: id('deal'),
        projectId,
        partner: 'Constellation Media',
        releaseWindow: 'hybridWindow',
        minimumGuarantee: base * 1.32,
        pAndACommitment: project.budget.ceiling * 0.1,
        revenueShareToStudio: 0.58,
        projectedOpeningOverride: 1.03,
      },
    ];
    this.distributionOffers.push(...offers);
  }

  private releaseTalent(projectId: string): void {
    for (const talent of this.talentPool) {
      if (talent.attachedProjectId === projectId) {
        talent.attachedProjectId = null;
        talent.availability = 'available';
      }
    }
  }
}
