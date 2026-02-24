import {
  heatDeltaFromRelease,
  projectedCriticalScore,
  projectedOpeningWeekendRange,
  projectedROI,
} from './formulas';
import {
  adjustTalentNegotiationForManager,
  getNegotiationChanceForManager,
  getNegotiationSnapshotForManager,
  getQuickCloseChanceForManager,
  negotiateAndAttachTalentForManager,
  processPlayerNegotiationsForManager,
  startTalentNegotiationForManager,
  type NegotiationSnapshot,
} from './studio-manager.negotiation';
import {
  applyArcMutationForManager,
  applyStoryFlagMutationsForManager,
  buildOperationalCrisisForManager,
  chooseProjectForEventForManager,
  ensureArcStateForManager,
  eventWeightForManager,
  generateEventDecisionsForManager,
  getArcPressureFromRivalsForManager,
  getDecisionTargetProjectForManager,
  getEventArcIdForManager,
  getEventProjectCandidatesForManager,
  hasStoryFlagForManager,
  matchesArcRequirementForManager,
  pickWeightedEventForManager,
  refillScriptMarketForManager,
  rollForCrisesForManager,
  tickDecisionExpiryForManager,
  tickScriptMarketExpiryForManager,
} from './studio-manager.events';
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
  NegotiationAction,
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

interface ArcOutcomeModifiers {
  talentLeverage: number;
  distributionLeverage: number;
  burnMultiplier: number;
  hypeDecayStep: number;
  releaseHeatMomentum: number;
  categoryBias: Partial<Record<DecisionCategory, number>>;
}

interface NegotiationTerms {
  salaryMultiplier: number;
  backendPoints: number;
  perksBudget: number;
}

interface NegotiationEvaluation {
  chance: number;
  salaryFit: number;
  backendFit: number;
  perksFit: number;
  termsScore: number;
  demand: NegotiationTerms;
}

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

  setStudioName(name: string): { success: boolean; message: string } {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      return { success: false, message: 'Studio name must be at least 2 characters.' };
    }
    const sanitized = trimmed.slice(0, 32);
    this.studioName = sanitized;
    return { success: true, message: `Studio renamed to ${sanitized}.` };
  }

  getAvailableTalentForRole(role: TalentRole): Talent[] {
    return this.talentPool.filter((talent) => talent.role === role && talent.availability === 'available');
  }

  getNegotiationChance(talentId: string, projectId?: string): number | null {
    return getNegotiationChanceForManager(this, talentId, projectId);
  }

  getQuickCloseChance(talentId: string): number | null {
    return getQuickCloseChanceForManager(this, talentId);
  }

  getNegotiationSnapshot(
    projectId: string,
    talentId: string
  ): NegotiationSnapshot | null {
    return getNegotiationSnapshotForManager(this, projectId, talentId);
  }

  adjustTalentNegotiation(
    projectId: string,
    talentId: string,
    action: NegotiationAction
  ): { success: boolean; message: string } {
    return adjustTalentNegotiationForManager(this, projectId, talentId, action);
  }

  evaluateScriptPitch(scriptId: string): {
    score: number;
    recommendation: 'strongBuy' | 'conditional' | 'pass';
    expectedROI: number;
    fitScore: number;
    riskLabel: 'low' | 'medium' | 'high';
  } | null {
    const script = this.scriptMarket.find((item) => item.id === scriptId);
    if (!script) return null;

    const budget = initialBudgetForGenre(script.genre);
    const availableDirectors = this.getAvailableTalentForRole('director');
    const availableLeads = this.getAvailableTalentForRole('leadActor');
    const bestDirector = [...availableDirectors].sort((a, b) => b.craftScore - a.craftScore)[0];
    const bestLead = [...availableLeads].sort((a, b) => b.starPower - a.starPower)[0];
    const bestDirectorFit = bestDirector?.genreFit[script.genre] ?? 0.6;
    const bestLeadFit = bestLead?.genreFit[script.genre] ?? 0.6;
    const fitScore = clamp((bestDirectorFit + bestLeadFit) / 2, 0, 1);

    const critical = projectedCriticalScore({
      scriptQuality: script.scriptQuality,
      directorCraft: bestDirector?.craftScore ?? 6,
      leadActorCraft: bestLead?.craftScore ?? 6,
      productionSpend: budget * 0.8,
      conceptStrength: script.conceptStrength,
      editorialCutChoice: 5,
      crisisPenalty: 0,
      chemistryPenalty: 0,
    });
    const opening = projectedOpeningWeekendRange({
      genre: script.genre,
      hypeScore: 12,
      starPower: bestLead?.starPower ?? 5.5,
      marketingBudget: budget * 0.12,
      totalBudget: budget,
    });
    const expectedROI = projectedROI({
      openingWeekend: opening.midpoint,
      criticalScore: critical,
      audienceScore: clamp(critical + 4, 0, 100),
      genre: script.genre,
      totalCost: budget * 1.12,
    });

    const affordability = script.askingPrice / Math.max(1, this.cash);
    const score = clamp(
      (critical / 100) * 40 + clamp(expectedROI / 2.4, 0, 1) * 35 + fitScore * 20 + (1 - clamp(affordability, 0, 1)) * 5,
      0,
      100
    );
    const recommendation = score >= 70 ? 'strongBuy' : score >= 55 ? 'conditional' : 'pass';
    const riskLabel = affordability > 0.15 || expectedROI < 1 ? 'high' : affordability > 0.08 || expectedROI < 1.4 ? 'medium' : 'low';

    return {
      score,
      recommendation,
      expectedROI,
      fitScore,
      riskLabel,
    };
  }

  getIndustryHeatLeaderboard(): { name: string; heat: number; isPlayer: boolean }[] {
    const rows = [
      { name: this.studioName, heat: this.studioHeat, isPlayer: true },
      ...this.rivals.map((rival) => ({ name: rival.name, heat: rival.studioHeat, isPlayer: false })),
    ];
    return rows.sort((a, b) => b.heat - a.heat);
  }

  runOptionalAction(): { success: boolean; message: string } {
    const project = this.activeProjects
      .filter((item) => item.phase !== 'released')
      .sort((a, b) => b.hypeScore - a.hypeScore)[0];
    if (!project) return { success: false, message: 'No active project available for optional action.' };
    if (this.cash < 180_000) return { success: false, message: 'Insufficient cash for optional campaign action.' };

    project.hypeScore = clamp(project.hypeScore + 5, 0, 100);
    project.marketingBudget += 180_000;
    this.cash -= 180_000;
    return {
      success: true,
      message: `Optional campaign executed on ${project.title}. Hype +5 and marketing +$180K.`,
    };
  }

  runMarketingPushOnProject(projectId: string): { success: boolean; message: string } {
    const project = this.activeProjects.find((item) => item.id === projectId);
    if (!project) return { success: false, message: 'Project not found.' };
    if (project.phase === 'distribution' || project.phase === 'released') {
      return { success: false, message: 'Marketing push not available after distribution begins.' };
    }
    if (this.cash < 180_000) return { success: false, message: 'Insufficient cash for marketing push ($180K needed).' };
    project.hypeScore = clamp(project.hypeScore + 5, 0, 100);
    project.marketingBudget += 180_000;
    this.cash -= 180_000;
    return { success: true, message: `Marketing push on ${project.title}. Hype +5, marketing +$180K.` };
  }

  abandonProject(projectId: string): { success: boolean; message: string } {
    const project = this.activeProjects.find((item) => item.id === projectId);
    if (!project) return { success: false, message: 'Project not found.' };
    if (project.phase === 'released') return { success: false, message: 'Released projects cannot be abandoned.' };
    const writeDown = Math.round(project.budget.actualSpend * 0.2);
    this.cash -= writeDown;
    this.studioHeat = clamp(this.studioHeat - 4, 0, 100);
    this.releaseTalent(projectId);
    this.activeProjects = this.activeProjects.filter((item) => item.id !== projectId);
    this.distributionOffers = this.distributionOffers.filter((item) => item.projectId !== projectId);
    this.pendingCrises = this.pendingCrises.filter((item) => item.projectId !== projectId);
    this.decisionQueue = this.decisionQueue.filter((item) => item.projectId !== projectId);
    return {
      success: true,
      message: `${project.title} abandoned. $${Math.round(writeDown / 1000)}K write-down charged. Studio heat -4.`,
    };
  }

  startTalentNegotiation(projectId: string, talentId: string): { success: boolean; message: string } {
    return startTalentNegotiationForManager(this, projectId, talentId);
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
    return negotiateAndAttachTalentForManager(this, projectId, talentId);
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
      if (project.releaseWeek && this.currentWeek < project.releaseWeek) {
        return { success: false, message: `${project.title} is scheduled for week ${project.releaseWeek}. End Week to reach release.` };
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
    const attempts = offer.counterAttempts ?? 0;
    if (attempts >= 1) {
      return { success: false, message: `${offer.partner} will not entertain another counter.` };
    }
    offer.counterAttempts = attempts + 1;
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
    return {
      success: true,
      message: `Walked away from ${removed} offer(s). Studio heat -2. Fresh offers can regenerate next End Week if no window is selected.`,
    };
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

    const project = decision.projectId ? this.getDecisionTargetProject(decision) : null;
    if (project) {
      project.scriptQuality = clamp(project.scriptQuality + option.scriptQualityDelta, 0, 10);
      project.hypeScore = clamp(project.hypeScore + option.hypeDelta, 0, 100);
      if (typeof option.releaseWeekShift === 'number' && project.releaseWeek) {
        project.releaseWeek = clamp(project.releaseWeek + option.releaseWeekShift, this.currentWeek + 1, this.currentWeek + 52);
      }
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
    this.refillScriptMarket(events);
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
    return this.buildProjection(project, project.releaseWeek ?? this.currentWeek + 4);
  }

  getProjectedForProjectAtWeek(
    projectId: string,
    releaseWeek: number
  ): {
    critical: number;
    openingLow: number;
    openingHigh: number;
    roi: number;
  } | null {
    const project = this.activeProjects.find((item) => item.id === projectId);
    if (!project) return null;
    const clampedWeek = clamp(Math.round(releaseWeek), this.currentWeek + 1, this.currentWeek + 52);
    return this.buildProjection(project, clampedWeek);
  }

  private buildProjection(
    project: MovieProject,
    releaseWeek: number
  ): {
    critical: number;
    openingLow: number;
    openingHigh: number;
    roi: number;
  } {
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
    const pressure = this.calendarPressureMultiplier(releaseWeek, project.genre);
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

  estimateWeeklyBurn(): number {
    const modifiers = this.getArcOutcomeModifiers();
    return this.activeProjects.reduce((sum, project) => {
      if (project.phase === 'released') return sum;
      return sum + this.projectedBurnForProject(project, modifiers.burnMultiplier);
    }, 0);
  }

  private projectedBurnForProject(project: MovieProject, burnMultiplier: number): number {
    return project.budget.ceiling * phaseBurnMultiplier(project.phase) * burnMultiplier;
  }

  private applyWeeklyBurn(): number {
    const modifiers = this.getArcOutcomeModifiers();
    let total = 0;
    for (const project of this.activeProjects) {
      if (project.phase === 'released') continue;
      const burn = this.projectedBurnForProject(project, modifiers.burnMultiplier);
      total += burn;
      project.budget.actualSpend += burn;
      project.scheduledWeeksRemaining = Math.max(0, project.scheduledWeeksRemaining - 1);
      project.productionStatus = project.budget.actualSpend > project.budget.ceiling ? 'atRisk' : project.productionStatus === 'inCrisis' ? 'inCrisis' : 'onTrack';
    }
    this.cash -= total;
    return total;
  }

  private applyHypeDecay(): void {
    const modifiers = this.getArcOutcomeModifiers();
    const step = clamp(modifiers.hypeDecayStep, 0.8, 3.2);
    for (const project of this.activeProjects) {
      project.hypeScore = clamp(project.hypeScore - step, 0, 100);
    }
  }

  private tickDecisionExpiry(events: string[]): void {
    tickDecisionExpiryForManager(this, events);
  }

  private tickScriptMarketExpiry(events: string[]): void {
    tickScriptMarketExpiryForManager(this, events);
  }

  private refillScriptMarket(events: string[]): void {
    refillScriptMarketForManager(this, events);
  }

  private rollForCrises(events: string[]): void {
    rollForCrisesForManager(this, events);
  }

  private generateEventDecisions(events: string[]): void {
    generateEventDecisionsForManager(this, events);
  }

  private pickWeightedEvent(): EventTemplate | null {
    return pickWeightedEventForManager(this);
  }

  private eventWeight(event: EventTemplate): number {
    return eventWeightForManager(this, event);
  }

  private getEventArcId(event: EventTemplate): string | null {
    return getEventArcIdForManager(this, event);
  }

  private getArcPressureFromRivals(arcId: string): number {
    return getArcPressureFromRivalsForManager(this, arcId);
  }

  private getEventProjectCandidates(event: EventTemplate): MovieProject[] {
    return getEventProjectCandidatesForManager(this, event);
  }

  private chooseProjectForEvent(event: EventTemplate): MovieProject | null {
    return chooseProjectForEventForManager(this, event);
  }

  private hasStoryFlag(flag: string): boolean {
    return hasStoryFlagForManager(this, flag);
  }

  private matchesArcRequirement(input: {
    id: string;
    minStage?: number;
    maxStage?: number;
    status?: 'active' | 'resolved' | 'failed';
  }): boolean {
    return matchesArcRequirementForManager(this, input);
  }

  private ensureArcState(arcId: string): StoryArcState {
    return ensureArcStateForManager(this, arcId);
  }

  private applyArcMutation(arcId: string, option: DecisionItem['options'][number]): void {
    applyArcMutationForManager(this, arcId, option);
  }

  private applyStoryFlagMutations(setFlag?: string, clearFlag?: string): void {
    applyStoryFlagMutationsForManager(this, setFlag, clearFlag);
  }

  private getDecisionTargetProject(decision: DecisionItem): MovieProject | null {
    return getDecisionTargetProjectForManager(this, decision);
  }

  private buildOperationalCrisis(project: MovieProject): CrisisEvent {
    return buildOperationalCrisisForManager(this, project);
  }

  private projectOutcomes(): void {
    for (const project of this.activeProjects) {
      const projection = this.getProjectedForProject(project.id);
      if (!projection) continue;
      project.projectedROI = projection.roi;
    }
  }

  private tickReleasedFilms(events: string[]): void {
    const modifiers = this.getArcOutcomeModifiers();
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
        const adjustedHeatDelta = heatDelta + modifiers.releaseHeatMomentum;
        this.studioHeat = clamp(this.studioHeat + adjustedHeatDelta, 0, 100);
        project.releaseResolved = true;
        events.push(
          `${project.title} completed theatrical run. Heat ${adjustedHeatDelta >= 0 ? '+' : ''}${adjustedHeatDelta.toFixed(0)}.`
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
          const project = this.activeProjects.find((item) => item.id === negotiation.projectId);
          const projectTitle = project?.title ?? 'your project';
          this.pendingCrises.push({
            id: id('crisis'),
            projectId: negotiation.projectId,
            kind: 'talentPoached',
            title: `${picked.name} just closed with ${rival.name} (${projectTitle})`,
            severity: 'red',
            body: `${projectTitle} lost a key attachment. Counter-offer now at a premium or walk away.`,
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
          events.push(`${rival.name} poached ${picked.name} from ${projectTitle}. Counter-offer decision required.`);
        }
      } else {
        events.push(`${rival.name} attached ${picked.name}. Available again around week ${unavailableUntil}.`);
      }
    }
  }

  private processPlayerNegotiations(events: string[]): void {
    processPlayerNegotiationsForManager(this, events);
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
      title: `${target.title}: ${rival.name} moved into your release window`,
          severity: 'orange',
          body: `${target.title} is under opening pressure in week ${target.releaseWeek}.`,
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
            counterAttempts: 0,
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
        onExpireClearFlag: 'rival_tentpole_threat',
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
            releaseWeekShift: -1,
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
        onExpireClearFlag: 'awards_headwind',
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
        onExpireClearFlag: 'rival_talent_lock',
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
        onExpireClearFlag: 'streaming_pressure',
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
        onExpireClearFlag: 'guerrilla_pressure',
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

  private findNegotiation(talentId: string, projectId?: string): PlayerNegotiation | null {
    const match = this.playerNegotiations.find(
      (item) => item.talentId === talentId && (projectId ? item.projectId === projectId : true)
    );
    return match ?? null;
  }

  private defaultNegotiationTerms(talent: Talent): NegotiationTerms {
    return {
      salaryMultiplier: 1,
      backendPoints: talent.salary.backendPoints,
      perksBudget: talent.salary.perksCost,
    };
  }

  private buildQuickCloseTerms(talent: Talent): NegotiationTerms {
    return {
      salaryMultiplier: 1.06,
      backendPoints: talent.salary.backendPoints + 0.6,
      perksBudget: talent.salary.perksCost * 1.15,
    };
  }

  private readNegotiationTerms(negotiation: PlayerNegotiation, talent: Talent): NegotiationTerms {
    const defaults = this.defaultNegotiationTerms(talent);
    return {
      salaryMultiplier: clamp(negotiation.offerSalaryMultiplier ?? defaults.salaryMultiplier, 0.8, 1.6),
      backendPoints: clamp(negotiation.offerBackendPoints ?? defaults.backendPoints, 0, 12),
      perksBudget: Math.max(0, negotiation.offerPerksBudget ?? defaults.perksBudget),
    };
  }

  private normalizeNegotiation(negotiation: PlayerNegotiation, talent: Talent): PlayerNegotiation {
    const terms = this.readNegotiationTerms(negotiation, talent);
    if (typeof negotiation.rounds !== 'number') negotiation.rounds = 0;
    if (typeof negotiation.holdLineCount !== 'number') negotiation.holdLineCount = 0;
    negotiation.offerSalaryMultiplier = terms.salaryMultiplier;
    negotiation.offerBackendPoints = terms.backendPoints;
    negotiation.offerPerksBudget = terms.perksBudget;
    return negotiation;
  }

  private demandedNegotiationTerms(talent: Talent): NegotiationTerms {
    const agentPush = (AGENT_DIFFICULTY[talent.agentTier] - 1) * 0.18;
    const starPush = Math.max(0, talent.starPower - 5) * 0.045;
    const craftPush = Math.max(0, talent.craftScore - 5) * 0.02;
    return {
      salaryMultiplier: clamp(1 + agentPush + starPush + craftPush, 1, 1.58),
      backendPoints: clamp(talent.salary.backendPoints + starPush * 5 + agentPush * 4 + 0.2, 0.5, 11),
      perksBudget: talent.salary.perksCost * (1 + talent.egoLevel * 0.08 + agentPush),
    };
  }

  private evaluateNegotiation(
    negotiation: PlayerNegotiation,
    talent: Talent,
    baseChance = 0.7
  ): NegotiationEvaluation {
    const terms = this.readNegotiationTerms(negotiation, talent);
    const demand = this.demandedNegotiationTerms(talent);
    const salaryFit = clamp(terms.salaryMultiplier / Math.max(0.01, demand.salaryMultiplier), 0, 1.25);
    const backendFit = clamp(terms.backendPoints / Math.max(0.01, demand.backendPoints), 0, 1.25);
    const perksFit = clamp(terms.perksBudget / Math.max(1, demand.perksBudget), 0, 1.25);
    const termsScore = salaryFit * 0.5 + backendFit * 0.25 + perksFit * 0.25;
    const rounds = negotiation.rounds ?? 0;
    const hardline = negotiation.holdLineCount ?? 0;
    const termsBoost = (termsScore - 0.72) * 0.34;
    const fatiguePenalty = Math.max(0, rounds - 1) * 0.055;
    const hardlinePenalty = hardline * 0.05;
    const chance = clamp(this.talentDealChance(talent, baseChance) + termsBoost - fatiguePenalty - hardlinePenalty, 0.05, 0.97);

    return { chance, salaryFit, backendFit, perksFit, termsScore, demand };
  }

  private negotiationPressurePoint(evaluation: NegotiationEvaluation): 'salary' | 'backend' | 'perks' {
    if (evaluation.salaryFit <= evaluation.backendFit && evaluation.salaryFit <= evaluation.perksFit) return 'salary';
    if (evaluation.backendFit <= evaluation.salaryFit && evaluation.backendFit <= evaluation.perksFit) return 'backend';
    return 'perks';
  }

  private composeNegotiationPreview(
    talentName: string,
    evaluation: NegotiationEvaluation,
    holdLineCount: number
  ): string {
    if (holdLineCount >= 2) {
      return `${talentName}'s reps are signaling standoff risk after repeated hardline rounds.`;
    }
    const pressurePoint = this.negotiationPressurePoint(evaluation);
    if (pressurePoint === 'salary') {
      return `${talentName}'s reps say salary is the primary gap in the package.`;
    }
    if (pressurePoint === 'backend') {
      return `${talentName}'s reps are pushing hardest on backend participation.`;
    }
    return `${talentName}'s reps want stronger perks and support terms.`;
  }

  private composeNegotiationSignal(
    talentName: string,
    evaluation: NegotiationEvaluation,
    accepted: boolean,
    holdLineCount: number
  ): string {
    if (accepted) {
      if (evaluation.salaryFit < 0.95) {
        return `${talentName} accepted, but flagged salary as the thin part of the deal.`;
      }
      if (evaluation.backendFit < 0.9) {
        return `${talentName} accepted, with notes that backend points were below preferred terms.`;
      }
      if (evaluation.perksFit < 0.9) {
        return `${talentName} accepted after prioritizing schedule and perks concessions.`;
      }
      return `${talentName} accepted terms with strong alignment across the package.`;
    }

    if (holdLineCount >= 2) {
      return `${talentName} declined after repeated hardline rounds. Reps called the package static.`;
    }
    if (evaluation.salaryFit < 0.9) {
      return `${talentName} declined: salary floor not met.`;
    }
    if (evaluation.backendFit < 0.85) {
      return `${talentName} declined: backend participation came in light.`;
    }
    if (evaluation.perksFit < 0.8) {
      return `${talentName} declined: package support and perks were below ask.`;
    }
    return `${talentName} declined final terms after mixed signals from reps.`;
  }

  private computeDealMemoCost(talent: Talent, terms: NegotiationTerms): number {
    const salaryRetainer = talent.salary.base * 0.08 * terms.salaryMultiplier;
    const perksHold = terms.perksBudget * 0.2;
    return salaryRetainer + perksHold;
  }

  private computeQuickCloseAttemptFee(talent: Talent, terms: NegotiationTerms): number {
    const memoCost = this.computeDealMemoCost(talent, terms);
    return clamp(memoCost * 0.2, 25_000, 240_000);
  }

  private setNegotiationCooldown(talent: Talent, weeks: number): void {
    talent.availability = 'unavailable';
    talent.unavailableUntilWeek = this.currentWeek + Math.max(1, Math.round(weeks));
    talent.attachedProjectId = null;
  }

  private talentDealChance(talent: Talent, base: number): number {
    const arcLeverage = this.getArcOutcomeModifiers().talentLeverage;
    const relationshipBoost = clamp((talent.studioRelationship - 0.5) * 0.24, -0.12, 0.12);
    const heatBoost = clamp((this.studioHeat - 10) / 260, -0.08, 0.16);
    const reputationPenalty = clamp((talent.starPower - 5) * 0.015 + (talent.craftScore - 5) * 0.01, 0, 0.16);
    const egoPenalty = clamp((talent.egoLevel - 5) * 0.018, -0.04, 0.16);
    const agentPenalty = clamp((AGENT_DIFFICULTY[talent.agentTier] - 1) * 0.2, 0, 0.12);
    return clamp(base + relationshipBoost + heatBoost + arcLeverage - reputationPenalty - egoPenalty - agentPenalty, 0.08, 0.95);
  }

  private finalizeTalentAttachment(project: MovieProject, talent: Talent, terms?: NegotiationTerms): boolean {
    const normalizedTerms = terms ?? this.defaultNegotiationTerms(talent);
    const retainer = this.computeDealMemoCost(talent, normalizedTerms);
    if (this.cash < retainer) {
      talent.availability = 'available';
      return false;
    }
    this.cash -= retainer;
    project.budget.actualSpend += retainer * 0.35;
    const backendPoints = normalizedTerms.backendPoints;
    project.studioRevenueShare = clamp(project.studioRevenueShare - backendPoints * 0.002, 0.35, 0.8);
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
    return true;
  }

  private resolveTalentPoachCrisis(project: MovieProject, option: CrisisEvent['options'][number]): void {
    const talent = this.talentPool.find((item) => item.id === option.talentId);
    if (!talent) return;
    const rival = this.rivals.find((item) => item.id === option.rivalStudioId);

    if (option.kind === 'talentCounter') {
      const premium = option.premiumMultiplier ?? 1.25;
      const cost = talent.salary.base * 0.2 * premium;
      const retainer = this.computeDealMemoCost(talent, this.defaultNegotiationTerms(talent));
      const chance = clamp(0.55 + this.studioHeat / 210 + talent.studioRelationship * 0.2, 0.15, 0.95);
      if (this.cash >= cost + retainer && this.negotiationRng() <= chance) {
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

  private getArcOutcomeModifiers(): ArcOutcomeModifiers {
    const modifiers: ArcOutcomeModifiers = {
      talentLeverage: 0,
      distributionLeverage: 0,
      burnMultiplier: 1,
      hypeDecayStep: 2,
      releaseHeatMomentum: 0,
      categoryBias: {},
    };

    for (const [arcId, arc] of Object.entries(this.storyArcs)) {
      if (arc.status === 'resolved') {
        if (arcId === 'awards-circuit') {
          modifiers.talentLeverage += 0.05;
          modifiers.releaseHeatMomentum += 1;
          modifiers.categoryBias.marketing = (modifiers.categoryBias.marketing ?? 0) + 0.2;
        } else if (arcId === 'exhibitor-war') {
          modifiers.distributionLeverage += 0.05;
          modifiers.categoryBias.finance = (modifiers.categoryBias.finance ?? 0) + 0.12;
        } else if (arcId === 'financier-control') {
          modifiers.distributionLeverage += 0.02;
          modifiers.burnMultiplier *= 0.98;
        } else if (arcId === 'leak-piracy') {
          modifiers.hypeDecayStep -= 0.2;
          modifiers.distributionLeverage += 0.02;
        } else if (arcId === 'talent-meltdown') {
          modifiers.talentLeverage += 0.04;
          modifiers.categoryBias.talent = (modifiers.categoryBias.talent ?? 0) + 0.15;
        } else if (arcId === 'franchise-pivot') {
          modifiers.distributionLeverage += 0.03;
          modifiers.burnMultiplier *= 1.02;
          modifiers.categoryBias.finance = (modifiers.categoryBias.finance ?? 0) + 0.1;
        }
      } else if (arc.status === 'failed') {
        if (arcId === 'awards-circuit') {
          modifiers.talentLeverage -= 0.04;
          modifiers.releaseHeatMomentum -= 1;
        } else if (arcId === 'exhibitor-war') {
          modifiers.distributionLeverage -= 0.05;
          modifiers.hypeDecayStep += 0.2;
        } else if (arcId === 'financier-control') {
          modifiers.burnMultiplier *= 1.04;
          modifiers.talentLeverage -= 0.03;
        } else if (arcId === 'leak-piracy') {
          modifiers.hypeDecayStep += 0.35;
          modifiers.distributionLeverage -= 0.03;
        } else if (arcId === 'talent-meltdown') {
          modifiers.talentLeverage -= 0.08;
          modifiers.categoryBias.talent = (modifiers.categoryBias.talent ?? 0) + 0.08;
        } else if (arcId === 'franchise-pivot') {
          modifiers.burnMultiplier *= 0.99;
          modifiers.distributionLeverage -= 0.02;
        }
      }
    }

    modifiers.burnMultiplier = clamp(modifiers.burnMultiplier, 0.85, 1.2);
    modifiers.distributionLeverage = clamp(modifiers.distributionLeverage, -0.12, 0.12);
    modifiers.talentLeverage = clamp(modifiers.talentLeverage, -0.2, 0.2);
    modifiers.hypeDecayStep = clamp(modifiers.hypeDecayStep, 0.8, 3.2);
    modifiers.releaseHeatMomentum = clamp(modifiers.releaseHeatMomentum, -3, 3);
    return modifiers;
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

    const modifiers = this.getArcOutcomeModifiers();
    const base = project.budget.ceiling * 0.2;
    const hypeFactor = 1 + project.hypeScore / 200;
    const mgMultiplier = 1 + modifiers.distributionLeverage;
    const shareLift = modifiers.distributionLeverage * 0.22;
    const offers: DistributionOffer[] = [
      {
        id: id('deal'),
        projectId,
        partner: 'Aster Peak Pictures',
        releaseWindow: 'wideTheatrical',
        minimumGuarantee: base * 1.2 * hypeFactor * mgMultiplier,
        pAndACommitment: project.budget.ceiling * 0.12,
        revenueShareToStudio: clamp(0.54 + shareLift, 0.45, 0.7),
        projectedOpeningOverride: 1.15,
        counterAttempts: 0,
      },
      {
        id: id('deal'),
        projectId,
        partner: 'Northstream',
        releaseWindow: 'streamingExclusive',
        minimumGuarantee: base * 1.55 * mgMultiplier,
        pAndACommitment: project.budget.ceiling * 0.06,
        revenueShareToStudio: clamp(0.62 + shareLift, 0.45, 0.7),
        projectedOpeningOverride: 0.8,
        counterAttempts: 0,
      },
      {
        id: id('deal'),
        projectId,
        partner: 'Constellation Media',
        releaseWindow: 'hybridWindow',
        minimumGuarantee: base * 1.32 * mgMultiplier,
        pAndACommitment: project.budget.ceiling * 0.1,
        revenueShareToStudio: clamp(0.58 + shareLift, 0.45, 0.7),
        projectedOpeningOverride: 1.03,
        counterAttempts: 0,
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
