import {
  ACTION_BALANCE,
  BANKRUPTCY_RULES,
  MEMORY_RULES,
  PROJECT_BALANCE,
  SESSION_RULES,
  STUDIO_STARTING,
  STUDIO_TIER_REQUIREMENTS,
  TURN_RULES,
} from './balance-constants';
import { createId } from './id';
import {
  reputationDeltasFromRelease,
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
import {
  acceptDistributionOfferForManager,
  advanceProjectPhaseForManager,
  counterDistributionOfferForManager,
  estimateReleaseRunWeeksForManager,
  generateDistributionOffersForManager,
  setProjectReleaseWeekForManager,
  tickDistributionWindowsForManager,
  walkAwayDistributionForManager,
} from './studio-manager.lifecycle';
import {
  checkRivalReleaseResponsesForManager,
  getRivalBehaviorProfileForManager,
  pickTalentForRivalForManager,
  processRivalCalendarMovesForManager,
  processRivalSignatureMovesForManager,
  processRivalTalentAcquisitionsForManager,
  queueRivalCounterplayDecisionForManager,
  rivalHeatBiasForManager,
  rivalNewsHeadlineForManager,
  tickRivalHeatForManager,
} from './studio-manager.rivals';
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
  RivalStudio,
  ScriptPitch,
  StoryArcState,
  StudioReputation,
  StudioTier,
  Talent,
  TalentInteractionKind,
  TalentRole,
  TalentTrustLevel,
  WeekSummary,
} from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function phaseBurnMultiplier(phase: MovieProject['phase']): number {
  return PROJECT_BALANCE.PHASE_BURN_MULTIPLIER[phase];
}

function initialBudgetForGenre(genre: MovieGenre): number {
  return PROJECT_BALANCE.INITIAL_BUDGET_BY_GENRE[genre];
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
  cash: number = STUDIO_STARTING.CASH;
  reputation: StudioReputation = {
    critics: STUDIO_STARTING.REPUTATION_PILLAR,
    talent: STUDIO_STARTING.REPUTATION_PILLAR,
    distributor: STUDIO_STARTING.REPUTATION_PILLAR,
    audience: STUDIO_STARTING.REPUTATION_PILLAR,
  };
  isBankrupt = false;
  bankruptcyReason: string | null = null;
  consecutiveLowCashWeeks = 0;
  firstSessionComplete = false;
  currentWeek = 1;
  turnLengthWeeks: 1 | 2 = TURN_RULES.MIN_WEEKS;
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

  get studioHeat(): number {
    return Math.round(
      (this.reputation.critics + this.reputation.talent + this.reputation.distributor + this.reputation.audience) / 4
    );
  }

  get studioTier(): StudioTier {
    const heat = this.studioHeat;
    const releasedCount = this.activeProjects.filter((p) => p.phase === 'released').length;
    if (
      heat >= STUDIO_TIER_REQUIREMENTS.globalPowerhouse.heat &&
      releasedCount >= STUDIO_TIER_REQUIREMENTS.globalPowerhouse.releasedFilms
    ) {
      return 'globalPowerhouse';
    }
    if (heat >= STUDIO_TIER_REQUIREMENTS.majorStudio.heat && releasedCount >= STUDIO_TIER_REQUIREMENTS.majorStudio.releasedFilms) {
      return 'majorStudio';
    }
    if (heat >= STUDIO_TIER_REQUIREMENTS.midTier.heat && releasedCount >= STUDIO_TIER_REQUIREMENTS.midTier.releasedFilms) {
      return 'midTier';
    }
    if (
      heat >= STUDIO_TIER_REQUIREMENTS.establishedIndie.heat &&
      releasedCount >= STUDIO_TIER_REQUIREMENTS.establishedIndie.releasedFilms
    ) {
      return 'establishedIndie';
    }
    return 'indieStudio';
  }

  get legacyScore(): number {
    const releasedCount = this.activeProjects.filter((p) => p.phase === 'released').length;
    const cashScore = clamp(this.cash / 50_000_000 * 20, 0, 20);
    const filmScore = Math.min(releasedCount * 4, 30);
    return clamp(Math.round(this.studioHeat * 0.5 + cashScore + filmScore), 0, 100);
  }

  adjustReputation(delta: number, pillar: keyof StudioReputation | 'all' = 'all'): void {
    if (pillar === 'all') {
      this.reputation.critics = clamp(this.reputation.critics + delta, 0, 100);
      this.reputation.talent = clamp(this.reputation.talent + delta, 0, 100);
      this.reputation.distributor = clamp(this.reputation.distributor + delta, 0, 100);
      this.reputation.audience = clamp(this.reputation.audience + delta, 0, 100);
    } else {
      this.reputation[pillar] = clamp(this.reputation[pillar] + delta, 0, 100);
    }
  }

  adjustCash(delta: number): void {
    if (!Number.isFinite(delta) || delta === 0) return;
    this.cash = Math.round(this.cash + delta);
  }

  private getTalentMemory(talent: Talent): Talent['relationshipMemory'] {
    if (!talent.relationshipMemory) {
      const trust = Math.round(Math.min(100, Math.max(0, 35 + talent.studioRelationship * 45)));
      const loyalty = Math.round(Math.min(100, Math.max(0, 30 + talent.studioRelationship * 40)));
      talent.relationshipMemory = {
        trust,
        loyalty,
        interactionHistory: [],
      };
    }
    if (!Array.isArray(talent.relationshipMemory.interactionHistory)) {
      talent.relationshipMemory.interactionHistory = [];
    }
    return talent.relationshipMemory;
  }

  private syncLegacyRelationship(talent: Talent): void {
    const memory = this.getTalentMemory(talent);
    talent.studioRelationship = clamp((memory.trust * 0.62 + memory.loyalty * 0.38) / 100, 0, 1);
  }

  getTalentTrustLevel(talent: Talent): TalentTrustLevel {
    const trust = this.getTalentMemory(talent).trust;
    if (trust < 25) return 'hostile';
    if (trust < 45) return 'wary';
    if (trust < 65) return 'neutral';
    if (trust < 82) return 'aligned';
    return 'loyal';
  }

  recordTalentInteraction(
    talent: Talent,
    input: {
      kind: TalentInteractionKind;
      trustDelta: number;
      loyaltyDelta: number;
      note: string;
      projectId?: string | null;
    }
  ): void {
    const memory = this.getTalentMemory(talent);
    memory.trust = clamp(Math.round(memory.trust + input.trustDelta), 0, 100);
    memory.loyalty = clamp(Math.round(memory.loyalty + input.loyaltyDelta), 0, 100);
    memory.interactionHistory.push({
      week: this.currentWeek,
      kind: input.kind,
      trustDelta: Math.round(input.trustDelta),
      loyaltyDelta: Math.round(input.loyaltyDelta),
      note: input.note,
      projectId: input.projectId ?? null,
    });
    if (memory.interactionHistory.length > MEMORY_RULES.TALENT_INTERACTION_HISTORY_MAX) {
      memory.interactionHistory = memory.interactionHistory.slice(-MEMORY_RULES.TALENT_INTERACTION_HISTORY_MAX);
    }
    this.syncLegacyRelationship(talent);
  }

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
    this.bindOpeningDecisionToLeadProject();
  }

  get canEndWeek(): boolean {
    return this.pendingCrises.length === 0;
  }

  setTurnLengthWeeks(weeks: number): { success: boolean; message: string } {
    const normalized = Math.round(weeks);
    if (normalized !== TURN_RULES.MIN_WEEKS && normalized !== TURN_RULES.MAX_WEEKS) {
      return { success: false, message: `Turn length must be ${TURN_RULES.MIN_WEEKS} or ${TURN_RULES.MAX_WEEKS} weeks.` };
    }
    this.turnLengthWeeks = normalized;
    return { success: true, message: `Turn length set to ${normalized} week${normalized === 1 ? '' : 's'}.` };
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
      .sort((a, b) => {
        if (a.marketingBudget === b.marketingBudget) return b.hypeScore - a.hypeScore;
        return a.marketingBudget - b.marketingBudget;
      })[0];
    if (!project) return { success: false, message: 'No active project available for optional action.' };
    if (this.cash < ACTION_BALANCE.OPTIONAL_ACTION_COST) {
      return { success: false, message: 'Insufficient cash for optional campaign action.' };
    }

    project.hypeScore = clamp(project.hypeScore + ACTION_BALANCE.OPTIONAL_ACTION_HYPE_BOOST, 0, 100);
    project.marketingBudget += ACTION_BALANCE.OPTIONAL_ACTION_MARKETING_BOOST;
    this.adjustCash(-ACTION_BALANCE.OPTIONAL_ACTION_COST);
    this.evaluateBankruptcy();
    return {
      success: true,
      message: `Optional campaign executed on ${project.title}. Hype +${ACTION_BALANCE.OPTIONAL_ACTION_HYPE_BOOST} and marketing +$180K.`,
    };
  }

  runMarketingPushOnProject(projectId: string): { success: boolean; message: string } {
    const project = this.activeProjects.find((item) => item.id === projectId);
    if (!project) return { success: false, message: 'Project not found.' };
    if (project.phase === 'distribution' || project.phase === 'released') {
      return { success: false, message: 'Marketing push not available after distribution begins.' };
    }
    if (this.cash < ACTION_BALANCE.OPTIONAL_ACTION_COST) return { success: false, message: 'Insufficient cash for marketing push ($180K needed).' };
    project.hypeScore = clamp(project.hypeScore + ACTION_BALANCE.OPTIONAL_ACTION_HYPE_BOOST, 0, 100);
    project.marketingBudget += ACTION_BALANCE.OPTIONAL_ACTION_MARKETING_BOOST;
    this.adjustCash(-ACTION_BALANCE.OPTIONAL_ACTION_COST);
    this.evaluateBankruptcy();
    return { success: true, message: `Marketing push on ${project.title}. Hype +5, marketing +$180K.` };
  }

  runScriptDevelopmentSprint(projectId: string): { success: boolean; message: string } {
    const project = this.activeProjects.find((item) => item.id === projectId);
    if (!project) return { success: false, message: 'Project not found.' };
    if (project.phase !== 'development') {
      return { success: false, message: 'Script sprint is only available during development.' };
    }
    if (project.scriptQuality >= ACTION_BALANCE.SCRIPT_SPRINT_MAX_QUALITY) {
      return { success: false, message: `${project.title} is already at max sprint quality (8.5).` };
    }
    if (this.cash < ACTION_BALANCE.SCRIPT_SPRINT_COST) return { success: false, message: 'Insufficient cash for script sprint ($100K needed).' };
    this.adjustCash(-ACTION_BALANCE.SCRIPT_SPRINT_COST);
    project.scriptQuality = clamp(
      project.scriptQuality + ACTION_BALANCE.SCRIPT_SPRINT_QUALITY_BOOST,
      0,
      ACTION_BALANCE.SCRIPT_SPRINT_MAX_QUALITY
    );
    this.evaluateBankruptcy();
    return {
      success: true,
      message: `Script sprint on ${project.title}. Script quality now ${project.scriptQuality.toFixed(1)}.`,
    };
  }

  runPostProductionPolishPass(projectId: string): { success: boolean; message: string } {
    const project = this.activeProjects.find((item) => item.id === projectId);
    if (!project) return { success: false, message: 'Project not found.' };
    if (project.phase !== 'postProduction') {
      return { success: false, message: 'Polish pass is only available during post-production.' };
    }
    if (
      (project.postPolishPasses ?? 0) >= ACTION_BALANCE.POLISH_PASS_MAX_USES ||
      project.editorialScore >= ACTION_BALANCE.POLISH_PASS_MAX_EDITORIAL
    ) {
      return { success: false, message: `${project.title} has no polish passes remaining.` };
    }
    if (this.cash < ACTION_BALANCE.POLISH_PASS_COST) return { success: false, message: 'Insufficient cash for polish pass ($120K needed).' };
    this.adjustCash(-ACTION_BALANCE.POLISH_PASS_COST);
    project.postPolishPasses = Math.min(ACTION_BALANCE.POLISH_PASS_MAX_USES, (project.postPolishPasses ?? 0) + 1);
    project.editorialScore = clamp(
      project.editorialScore + ACTION_BALANCE.POLISH_PASS_EDITORIAL_BOOST,
      0,
      ACTION_BALANCE.POLISH_PASS_MAX_EDITORIAL
    );
    this.evaluateBankruptcy();
    return {
      success: true,
      message: `Polish pass on ${project.title}. Editorial score now ${project.editorialScore.toFixed(1)}.`,
    };
  }

  abandonProject(projectId: string): { success: boolean; message: string } {
    const project = this.activeProjects.find((item) => item.id === projectId);
    if (!project) return { success: false, message: 'Project not found.' };
    if (project.phase === 'released') return { success: false, message: 'Released projects cannot be abandoned.' };
    const writeDown = Math.round(project.budget.actualSpend * 0.2);
    this.adjustCash(-writeDown);
    this.adjustReputation(-4, 'talent');
    this.evaluateBankruptcy();
    this.releaseTalent(projectId, 'abandoned');
    this.activeProjects = this.activeProjects.filter((item) => item.id !== projectId);
    this.distributionOffers = this.distributionOffers.filter((item) => item.projectId !== projectId);
    this.pendingCrises = this.pendingCrises.filter((item) => item.projectId !== projectId);
    this.decisionQueue = this.decisionQueue.filter((item) => item.projectId !== projectId);
    return {
      success: true,
      message: `${project.title} abandoned. $${Math.round(writeDown / 1000)}K write-down charged. Talent rep -4.`,
    };
  }

  startTalentNegotiation(projectId: string, talentId: string): { success: boolean; message: string } {
    return startTalentNegotiationForManager(this, projectId, talentId);
  }

  setProjectReleaseWeek(projectId: string, releaseWeek: number): { success: boolean; message: string } {
    return setProjectReleaseWeekForManager(this, projectId, releaseWeek);
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

    this.adjustCash(-pitch.askingPrice);
    this.scriptMarket = this.scriptMarket.filter((item) => item.id !== scriptId);

    const ceiling = initialBudgetForGenre(pitch.genre);
    const project: MovieProject = {
      id: createId('project'),
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
      editorialScore: 5,
      postPolishPasses: 0,
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
      prestige: clamp(
        Math.round(pitch.scriptQuality * 7 + (pitch.genre === 'drama' || pitch.genre === 'documentary' ? 18 : 0)),
        0, 100
      ),
      commercialAppeal: clamp(
        Math.round(
          (pitch.genre === 'action' ? 68 : pitch.genre === 'sciFi' ? 62 : pitch.genre === 'animation' ? 60
            : pitch.genre === 'drama' ? 32 : pitch.genre === 'documentary' ? 18 : 48) +
          pitch.conceptStrength * 3
        ), 0, 100
      ),
      originality: clamp(Math.round(pitch.conceptStrength * 8 + 10), 0, 100),
      controversy: pitch.genre === 'horror' ? 35 : pitch.genre === 'thriller' ? 28 : pitch.genre === 'action' ? 22 : 15,
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
    return advanceProjectPhaseForManager(this, projectId);
  }

  acceptDistributionOffer(projectId: string, offerId: string): { success: boolean; message: string } {
    return acceptDistributionOfferForManager(this, projectId, offerId);
  }

  counterDistributionOffer(projectId: string, offerId: string): { success: boolean; message: string } {
    return counterDistributionOfferForManager(this, projectId, offerId);
  }

  walkAwayDistribution(projectId: string): { success: boolean; message: string } {
    return walkAwayDistributionForManager(this, projectId);
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
        this.adjustCash(option.cashDelta);
        this.pendingCrises = this.pendingCrises.filter((item) => item.id !== crisisId);
        return;
      }
      project.scheduledWeeksRemaining = Math.max(0, project.scheduledWeeksRemaining + option.scheduleDelta);
      project.hypeScore = clamp(project.hypeScore + option.hypeDelta, 0, 100);
      project.budget.actualSpend += Math.max(0, -option.cashDelta);
      project.productionStatus = 'onTrack';
    }
    this.adjustCash(option.cashDelta);
    this.evaluateBankruptcy();
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

    this.adjustCash(option.cashDelta);
    if (option.studioHeatDelta) this.adjustReputation(option.studioHeatDelta, 'all');
    if (option.criticsDelta) this.adjustReputation(option.criticsDelta, 'critics');
    if (option.talentRepDelta) this.adjustReputation(option.talentRepDelta, 'talent');
    if (option.distributorRepDelta) this.adjustReputation(option.distributorRepDelta, 'distributor');
    if (option.audienceDelta) this.adjustReputation(option.audienceDelta, 'audience');
    this.evaluateBankruptcy();
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

    if (this.cash < BANKRUPTCY_RULES.LOW_CASH_WARNING_THRESHOLD) {
      this.consecutiveLowCashWeeks += 1;
    } else {
      this.consecutiveLowCashWeeks = 0;
    }

    if (!this.firstSessionComplete && this.currentWeek > SESSION_RULES.FIRST_SESSION_COMPLETE_WEEK) {
      this.firstSessionComplete = true;
    }
    this.evaluateBankruptcy(events);

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

  endTurn(): WeekSummary {
    if (!this.canEndWeek) {
      throw new Error('Resolve all crises before ending the week.');
    }

    const targetWeeks = this.turnLengthWeeks;
    const cashBefore = this.cash;
    const combinedEvents: string[] = [];

    for (let step = 0; step < targetWeeks; step += 1) {
      if (!this.canEndWeek) {
        combinedEvents.push('Turn paused: resolve crisis before advancing further.');
        break;
      }
      const weekly = this.endWeek();
      combinedEvents.push(...weekly.events);
    }

    const summary: WeekSummary = {
      week: this.currentWeek,
      cashDelta: this.cash - cashBefore,
      events: combinedEvents.length > 0 ? combinedEvents : ['Stable week. No major surprises.'],
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
      editorialCutChoice: project.editorialScore,
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
    this.adjustCash(-total);
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
        const repDeltas = reputationDeltasFromRelease({
          criticalScore: project.criticalScore ?? 50,
          roi: project.projectedROI,
          awardsNominations: 0,
          awardsWins: 0,
          controversyPenalty: project.controversy ?? 0,
        });
        const criticsDelta = repDeltas.critics + modifiers.releaseHeatMomentum;
        const audienceDelta = repDeltas.audience + modifiers.releaseHeatMomentum;
        this.adjustReputation(criticsDelta, 'critics');
        this.adjustReputation(audienceDelta, 'audience');
        project.releaseResolved = true;
        events.push(
          `${project.title} completed theatrical run. Critics ${criticsDelta >= 0 ? '+' : ''}${criticsDelta.toFixed(0)}, Audience ${audienceDelta >= 0 ? '+' : ''}${audienceDelta.toFixed(0)}.`
        );
        this.checkRivalReleaseResponses(project, events);
      }
    }
  }

  private estimateReleaseRunWeeks(project: MovieProject): number {
    return estimateReleaseRunWeeksForManager(this, project);
  }

  private tickRivalHeat(events: string[]): void {
    tickRivalHeatForManager(this, events);
  }

  private processRivalTalentAcquisitions(events: string[]): void {
    processRivalTalentAcquisitionsForManager(this, events);
  }

  private processPlayerNegotiations(events: string[]): void {
    processPlayerNegotiationsForManager(this, events);
  }

  private processRivalCalendarMoves(events: string[]): void {
    processRivalCalendarMovesForManager(this, events);
  }

  private processRivalSignatureMoves(events: string[]): void {
    processRivalSignatureMovesForManager(this, events);
  }

  private checkRivalReleaseResponses(project: MovieProject, events: string[]): void {
    checkRivalReleaseResponsesForManager(this, project, events);
  }

  private queueRivalCounterplayDecision(flag: string, rivalName: string, projectId?: string): void {
    queueRivalCounterplayDecisionForManager(this, flag, rivalName, projectId);
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
    return pickTalentForRivalForManager(this, rival, candidates);
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
    const memory = this.getTalentMemory(talent);
    this.syncLegacyRelationship(talent);
    const trustBoost = (memory.trust - 50) / 260;
    const loyaltyBoost = (memory.loyalty - 50) / 320;
    const relationshipBoost = clamp((talent.studioRelationship - 0.5) * 0.16 + trustBoost + loyaltyBoost, -0.16, 0.2);
    const heatBoost = clamp((this.reputation.talent - 10) / 260, -0.08, 0.16);
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
      this.recordTalentInteraction(talent, {
        kind: 'dealStalled',
        trustDelta: -5,
        loyaltyDelta: -4,
        note: `Deal memo for ${project.title} failed due to insufficient retainer cash.`,
        projectId: project.id,
      });
      return false;
    }
    this.adjustCash(-retainer);
    project.budget.actualSpend += retainer * 0.35;
    const backendPoints = normalizedTerms.backendPoints;
    project.studioRevenueShare = clamp(project.studioRevenueShare - backendPoints * 0.004, 0.35, 0.8);
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
    this.recordTalentInteraction(talent, {
      kind: 'dealSigned',
      trustDelta: 5,
      loyaltyDelta: 6,
      note: `Signed onto ${project.title}.`,
      projectId: project.id,
    });
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
      const chance = clamp(0.55 + this.reputation.talent / 210 + talent.studioRelationship * 0.2, 0.15, 0.95);
      if (this.cash >= cost + retainer && this.negotiationRng() <= chance) {
        this.adjustCash(-cost);
        if (rival) {
          rival.lockedTalentIds = rival.lockedTalentIds.filter((idValue) => idValue !== talent.id);
        }
        this.finalizeTalentAttachment(project, talent);
        this.recordTalentInteraction(talent, {
          kind: 'counterPoachWon',
          trustDelta: 4,
          loyaltyDelta: 7,
          note: `Countered rival pressure and re-secured ${talent.name} for ${project.title}.`,
          projectId: project.id,
        });
      } else {
        this.recordTalentInteraction(talent, {
          kind: 'counterPoachLost',
          trustDelta: -4,
          loyaltyDelta: -6,
          note: `Counter-offer failed while trying to secure ${project.title}.`,
          projectId: project.id,
        });
      }
    }

    if (option.kind === 'talentWalk') {
      project.hypeScore = clamp(project.hypeScore - 2, 0, 100);
      this.recordTalentInteraction(talent, {
        kind: 'counterPoachLost',
        trustDelta: -2,
        loyaltyDelta: -3,
        note: `Let poach pressure stand on ${project.title}.`,
        projectId: project.id,
      });
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
    return rivalHeatBiasForManager(this, personality);
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
    return getRivalBehaviorProfileForManager(this, rival);
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
    return rivalNewsHeadlineForManager(this, name, delta);
  }

  private tickDistributionWindows(events: string[]): void {
    tickDistributionWindowsForManager(this, events);
  }

  private generateDistributionOffers(projectId: string): void {
    generateDistributionOffersForManager(this, projectId);
  }

  private releaseTalent(projectId: string, context: 'released' | 'abandoned' = 'released'): void {
    const project = this.activeProjects.find((item) => item.id === projectId);
    for (const talent of this.talentPool) {
      if (talent.attachedProjectId === projectId) {
        talent.attachedProjectId = null;
        talent.availability = 'available';
        if (context === 'abandoned') {
          this.recordTalentInteraction(talent, {
            kind: 'projectAbandoned',
            trustDelta: -9,
            loyaltyDelta: -11,
            note: `Studio abandoned ${project?.title ?? 'an attached project'}.`,
            projectId,
          });
        } else {
          this.recordTalentInteraction(talent, {
            kind: 'projectReleased',
            trustDelta: 2,
            loyaltyDelta: 3,
            note: `${project?.title ?? 'Project'} moved into release.`,
            projectId,
          });
        }
      }
    }
  }

  private bindOpeningDecisionToLeadProject(): void {
    const openingDecision = this.decisionQueue.find((item) => item.title.startsWith('First Call: Script Doctor'));
    if (!openingDecision || openingDecision.projectId) return;
    const leadProject =
      this.activeProjects.find((project) => project.title === 'Night Ledger') ??
      this.activeProjects.find((project) => project.phase !== 'released');
    if (!leadProject) return;
    openingDecision.projectId = leadProject.id;
  }

  private evaluateBankruptcy(events?: string[]): void {
    if (this.isBankrupt) return;
    if (this.cash > BANKRUPTCY_RULES.GAME_OVER_CASH_THRESHOLD) return;
    this.isBankrupt = true;
    const roundedCash = Math.round(this.cash);
    this.cash = Math.max(BANKRUPTCY_RULES.GAME_OVER_CASH_THRESHOLD, roundedCash);
    this.bankruptcyReason = `Bankruptcy declared at week ${this.currentWeek} with cash $${roundedCash.toLocaleString()}.`;
    events?.push('Bankruptcy declared. The studio has run out of operating cash.');
  }
}
