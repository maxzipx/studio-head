import {
  ACTION_BALANCE,
  AWARDS_RULES,
  BANKRUPTCY_RULES,
  FESTIVAL_RULES,
  MEMORY_RULES,
  PROJECT_BALANCE,
  SESSION_RULES,
  STUDIO_STARTING,
  STUDIO_TIER_REQUIREMENTS,
  TURN_RULES,
} from './balance-constants';
import { createId } from './id';
import {
  awardsNominationProbability,
  awardsSeasonScore,
  awardsWinProbability,
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
import {
  getFranchiseProjectionModifiersForManager,
  getSequelCandidatesForManager,
  getSequelEligibilityForManager,
  markFranchiseReleaseForManager,
  removeProjectFromFranchiseForManager,
  setFranchiseStrategyForManager,
  startSequelForManager,
} from './studio-manager.franchise';
import { getEventDeck } from './event-deck';
import {
  createOpeningDecisions,
  createSeedProjects,
  createSeedRivals,
  createSeedScriptMarket,
  createSeedTalentPool,
} from './seeds';
import { STUDIO_TIER_LABELS } from './types';
import type {
  AwardsSeasonRecord,
  ChronicleEntry,
  CrisisEvent,
  DecisionCategory,
  DecisionItem,
  DistributionOffer,
  EventTemplate,
  FranchiseTrack,
  FranchiseProjectionModifiers,
  FranchiseStrategy,
  GenreCycleState,
  IndustryNewsItem,
  MovieGenre,
  MovieProject,
  NegotiationAction,
  PlayerNegotiation,
  RivalInteractionKind,
  RivalStudio,
  ScriptPitch,
  SequelCandidate,
  SequelEligibility,
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

const MOVIE_GENRES: MovieGenre[] = ['action', 'drama', 'comedy', 'horror', 'thriller', 'sciFi', 'animation', 'documentary'];

function createInitialGenreCycles(): Record<MovieGenre, GenreCycleState> {
  return {
    action: { demand: 1.02, momentum: 0.004 },
    drama: { demand: 0.98, momentum: 0.002 },
    comedy: { demand: 1, momentum: 0.001 },
    horror: { demand: 1.04, momentum: 0.003 },
    thriller: { demand: 1.01, momentum: 0.002 },
    sciFi: { demand: 1.03, momentum: 0.003 },
    animation: { demand: 0.99, momentum: 0.001 },
    documentary: { demand: 0.95, momentum: 0.001 },
  };
}

const AGENT_DIFFICULTY: Record<Talent['agentTier'], number> = {
  independent: 1,
  uta: 1.2,
  wme: 1.3,
  caa: 1.4,
};

const ARC_LABELS: Record<string, string> = {
  'financier-control': 'Investor Pressure',
  'leak-piracy': 'Leak Fallout',
  'awards-circuit': 'Awards Run',
  'talent-meltdown': 'Volatile Star Cycle',
  'exhibitor-war': 'Theater Access Battle',
  'franchise-pivot': 'Universe Gamble',
  'streaming-pivot': 'Streaming Crossroads',
  'passion-project': "The Director's Vision",
};

const TIER_RANK: Record<StudioTier, number> = {
  indieStudio: 0,
  establishedIndie: 1,
  midTier: 2,
  majorStudio: 3,
  globalPowerhouse: 4,
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
  franchises: FranchiseTrack[] = [];
  talentPool: Talent[] = createSeedTalentPool();
  scriptMarket: ScriptPitch[] = createSeedScriptMarket();
  rivals: RivalStudio[] = createSeedRivals();
  industryNewsLog: IndustryNewsItem[] = [];
  playerNegotiations: PlayerNegotiation[] = [];
  storyFlags: Record<string, number> = {};
  storyArcs: Record<string, StoryArcState> = {};
  recentDecisionCategories: DecisionCategory[] = [];
  lastWeekSummary: WeekSummary | null = null;
  awardsHistory: AwardsSeasonRecord[] = [];
  awardsSeasonsProcessed: number[] = [];
  genreCycles: Record<MovieGenre, GenreCycleState> = createInitialGenreCycles();
  studioChronicle: ChronicleEntry[] = [];

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
    if (this.isBankrupt) {
      this.cash = Math.max(BANKRUPTCY_RULES.GAME_OVER_CASH_THRESHOLD, this.cash);
    }
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

  private getRivalMemory(rival: RivalStudio): RivalStudio['memory'] {
    if (!rival.memory) {
      const baseHostility =
        rival.personality === 'blockbusterFactory' ? 58 : rival.personality === 'scrappyUpstart' ? 55 : 50;
      const baseRespect =
        rival.personality === 'prestigeHunter' ? 60 : rival.personality === 'genreSpecialist' ? 56 : 52;
      rival.memory = {
        hostility: baseHostility,
        respect: baseRespect,
        retaliationBias: 50,
        cooperationBias: 45,
        interactionHistory: [],
      };
    }
    if (!Array.isArray(rival.memory.interactionHistory)) {
      rival.memory.interactionHistory = [];
    }
    return rival.memory;
  }

  getRivalStance(rival: RivalStudio): 'hostile' | 'competitive' | 'neutral' | 'respectful' {
    const memory = this.getRivalMemory(rival);
    const score = memory.hostility - memory.respect;
    if (score >= 20) return 'hostile';
    if (score >= 8) return 'competitive';
    if (score <= -12) return 'respectful';
    return 'neutral';
  }

  recordRivalInteraction(
    rival: RivalStudio,
    input: {
      kind: RivalInteractionKind;
      hostilityDelta: number;
      respectDelta: number;
      note: string;
      projectId?: string | null;
    }
  ): void {
    const memory = this.getRivalMemory(rival);
    memory.hostility = clamp(Math.round(memory.hostility + input.hostilityDelta), 0, 100);
    memory.respect = clamp(Math.round(memory.respect + input.respectDelta), 0, 100);
    memory.retaliationBias = clamp(Math.round(memory.retaliationBias + input.hostilityDelta * 0.6), 0, 100);
    memory.cooperationBias = clamp(Math.round(memory.cooperationBias + input.respectDelta * 0.6), 0, 100);
    memory.interactionHistory.push({
      week: this.currentWeek,
      kind: input.kind,
      hostilityDelta: Math.round(input.hostilityDelta),
      respectDelta: Math.round(input.respectDelta),
      note: input.note,
      projectId: input.projectId ?? null,
    });
    if (memory.interactionHistory.length > MEMORY_RULES.RIVAL_INTERACTION_HISTORY_MAX) {
      memory.interactionHistory = memory.interactionHistory.slice(-MEMORY_RULES.RIVAL_INTERACTION_HISTORY_MAX);
    }
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

  getGenreDemandMultiplier(genre: MovieGenre): number {
    return this.genreCycles[genre]?.demand ?? 1;
  }

  getGenreCycleSnapshot(): { genre: MovieGenre; demand: number; momentum: number }[] {
    return MOVIE_GENRES.map((genre) => ({
      genre,
      demand: this.getGenreDemandMultiplier(genre),
      momentum: this.genreCycles[genre]?.momentum ?? 0,
    })).sort((a, b) => b.demand - a.demand);
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
      seasonalMultiplier: this.getGenreDemandMultiplier(script.genre),
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

  runFestivalSubmission(projectId: string): { success: boolean; message: string } {
    const project = this.activeProjects.find((item) => item.id === projectId);
    if (!project) return { success: false, message: 'Project not found.' };
    if (project.phase !== 'postProduction' && project.phase !== 'distribution') {
      return { success: false, message: 'Festival submissions are only available in post-production or distribution.' };
    }
    if (project.festivalStatus === 'submitted' && project.festivalResolutionWeek && this.currentWeek < project.festivalResolutionWeek) {
      return { success: false, message: `${project.title} already has a pending festival submission.` };
    }
    if (project.festivalStatus === 'selected' || project.festivalStatus === 'buzzed') {
      return { success: false, message: `${project.title} already has a completed festival run.` };
    }
    if (this.cash < FESTIVAL_RULES.SUBMISSION_COST) {
      return { success: false, message: `Insufficient cash for festival submission ($${Math.round(FESTIVAL_RULES.SUBMISSION_COST / 1000)}K needed).` };
    }

    const targetFestival = this.pickFestivalTarget(project);
    this.adjustCash(-FESTIVAL_RULES.SUBMISSION_COST);
    project.festivalStatus = 'submitted';
    project.festivalTarget = targetFestival;
    project.festivalSubmissionWeek = this.currentWeek;
    project.festivalResolutionWeek = this.currentWeek + FESTIVAL_RULES.RESOLUTION_WEEKS;
    project.hypeScore = clamp(project.hypeScore + 1, 0, 100);
    this.evaluateBankruptcy();

    return {
      success: true,
      message: `${project.title} submitted to ${targetFestival}. Results expected around week ${project.festivalResolutionWeek}.`,
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
    removeProjectFromFranchiseForManager(this, projectId);
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

  getSequelEligibility(projectId: string): SequelEligibility | null {
    return getSequelEligibilityForManager(this, projectId);
  }

  getSequelCandidates(): SequelCandidate[] {
    return getSequelCandidatesForManager(this);
  }

  startSequel(projectId: string): { success: boolean; message: string; projectId?: string } {
    return startSequelForManager(this, projectId);
  }

  setFranchiseStrategy(
    projectId: string,
    strategy: Exclude<FranchiseStrategy, 'none'>
  ): { success: boolean; message: string } {
    return setFranchiseStrategyForManager(this, projectId, strategy);
  }

  getFranchiseProjectionModifiers(projectId: string): FranchiseProjectionModifiers | null {
    const project = this.activeProjects.find((item) => item.id === projectId);
    if (!project) return null;
    return getFranchiseProjectionModifiersForManager(this, project);
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
      awardsNominations: 0,
      awardsWins: 0,
      festivalStatus: 'none',
      festivalTarget: null,
      festivalSubmissionWeek: null,
      festivalResolutionWeek: null,
      festivalBuzz: 0,
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
      franchiseId: null,
      franchiseEpisode: null,
      sequelToProjectId: null,
      franchiseCarryoverHype: 0,
      franchiseStrategy: 'none',
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
      if (option.resolveArc || option.failArc) {
        this.addChronicleEntry({
          week: this.currentWeek,
          type: 'arcResolution',
          headline: `${ARC_LABELS[decision.arcId] ?? decision.arcId} — ${option.resolveArc ? 'resolved' : 'failed'}`,
          detail: `"${option.label}"`,
          impact: option.resolveArc ? 'positive' : 'negative',
        });
      }
    }
    this.applyRivalDecisionMemory(decision, option);
    this.decisionQueue = this.decisionQueue.filter((item) => item.id !== decisionId);
  }

  endWeek(): WeekSummary {
    if (!this.canEndWeek) {
      throw new Error('Resolve all crises before ending the week.');
    }

    const cashBefore = this.cash;
    const tierBefore = this.studioTier;
    const events: string[] = [];

    const burn = this.applyWeeklyBurn();
    if (burn > 0) {
      events.push(`Production burn applied: -$${Math.round(burn / 1000)}K`);
    }

    this.applyHypeDecay();
    this.tickGenreCycles(events);
    this.resolveFestivalCircuit(events);
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
    this.applyRivalMemoryReversion();
    this.projectOutcomes();

    this.currentWeek += 1;
    this.processAnnualAwards(events);

    if (this.cash < BANKRUPTCY_RULES.LOW_CASH_WARNING_THRESHOLD) {
      this.consecutiveLowCashWeeks += 1;
    } else {
      this.consecutiveLowCashWeeks = 0;
    }

    if (!this.firstSessionComplete && this.currentWeek > SESSION_RULES.FIRST_SESSION_COMPLETE_WEEK) {
      this.firstSessionComplete = true;
    }
    if (this.studioTier !== tierBefore) {
      const movedUp = TIER_RANK[this.studioTier] > TIER_RANK[tierBefore];
      this.addChronicleEntry({
        week: this.currentWeek,
        type: 'tierAdvance',
        headline: `${movedUp ? 'Promoted to' : 'Dropped to'} ${STUDIO_TIER_LABELS[this.studioTier]}`,
        impact: movedUp ? 'positive' : 'negative',
      });
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
    const franchiseModifiers = getFranchiseProjectionModifiersForManager(this, project);
    const baseCritical = projectedCriticalScore({
      scriptQuality: project.scriptQuality,
      directorCraft: director?.craftScore ?? 6,
      leadActorCraft: lead?.craftScore ?? 6,
      productionSpend: project.budget.actualSpend,
      conceptStrength: project.conceptStrength,
      editorialCutChoice: project.editorialScore,
      crisisPenalty: project.productionStatus === 'inCrisis' ? 8 : 0,
      chemistryPenalty: 0,
    });
    const critical = clamp(baseCritical + franchiseModifiers.criticalDelta, 0, 100);

    const opening = projectedOpeningWeekendRange({
      genre: project.genre,
      hypeScore: project.hypeScore,
      starPower: lead?.starPower ?? 5.5,
      marketingBudget: project.marketingBudget,
      totalBudget: project.budget.ceiling,
      seasonalMultiplier: this.getGenreDemandMultiplier(project.genre),
    });
    const pressure = this.calendarPressureMultiplier(releaseWeek, project.genre);
    const combinedOpeningMultiplier = pressure * franchiseModifiers.openingMultiplier;
    const openingLow = opening.low * combinedOpeningMultiplier;
    const openingHigh = opening.high * combinedOpeningMultiplier;
    const openingMid = opening.midpoint * combinedOpeningMultiplier;
    const audienceProjection = clamp(critical + 4 + franchiseModifiers.audienceDelta, 0, 100);

    const roi = projectedROI({
      openingWeekend: openingMid,
      criticalScore: critical,
      audienceScore: audienceProjection,
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

  private addChronicleEntry(entry: Omit<ChronicleEntry, 'id'>): void {
    this.studioChronicle.unshift({ id: createId('chron'), ...entry });
    this.studioChronicle = this.studioChronicle.slice(0, 100);
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
        markFranchiseReleaseForManager(this, project.id);
        events.push(
          `${project.title} completed theatrical run. Critics ${criticsDelta >= 0 ? '+' : ''}${criticsDelta.toFixed(0)}, Audience ${audienceDelta >= 0 ? '+' : ''}${audienceDelta.toFixed(0)}.`
        );
        const roiValue = project.projectedROI;
        const grossM = project.finalBoxOffice ? (project.finalBoxOffice / 1_000_000).toFixed(1) : '?';
        this.addChronicleEntry({
          week: this.currentWeek,
          type: 'filmRelease',
          headline: `${project.title} closed at $${grossM}M domestic`,
          detail: `ROI ${roiValue.toFixed(1)}x · Score ${project.criticalScore ?? '?'}`,
          projectTitle: project.title,
          impact: roiValue >= 2.0 ? 'positive' : roiValue < 1.0 ? 'negative' : 'neutral',
        });
        this.checkRivalReleaseResponses(project, events);
      }
    }
  }

  private processAnnualAwards(events: string[]): void {
    if (
      this.currentWeek < AWARDS_RULES.AWARDS_WEEK_IN_SEASON ||
      (this.currentWeek - AWARDS_RULES.AWARDS_WEEK_IN_SEASON) % AWARDS_RULES.SEASON_LENGTH_WEEKS !== 0
    ) {
      return;
    }
    const seasonYear = Math.floor((this.currentWeek - 1) / AWARDS_RULES.SEASON_LENGTH_WEEKS) + 1;
    if (this.awardsSeasonsProcessed.includes(seasonYear)) return;

    const eligibilityStartWeek = this.currentWeek - AWARDS_RULES.ELIGIBILITY_WINDOW_WEEKS;
    const eligibleProjects = this.activeProjects.filter((project) => {
      if (project.phase !== 'released' || !project.releaseResolved) return false;
      const releaseWeek = project.releaseWeek ?? 0;
      if (releaseWeek < eligibilityStartWeek || releaseWeek > this.currentWeek) return false;
      return Number.isFinite(project.criticalScore ?? NaN);
    });

    if (eligibleProjects.length === 0) {
      this.awardsSeasonsProcessed.push(seasonYear);
      events.push(`Awards season year ${seasonYear}: no eligible player releases this cycle.`);
      return;
    }

    const awardsArc = this.storyArcs['awards-circuit'];
    const baseCampaignBoost = this.hasStoryFlag('awards_campaign') ? 8 : 0;
    const baselineFestivalBoost = this.hasStoryFlag('festival_selected') ? 4 : 0;
    const arcBoost =
      awardsArc?.status === 'resolved' ? 6 : awardsArc?.status === 'failed' ? -5 : (awardsArc?.stage ?? 0) * 1.5;

    const results = eligibleProjects.map((project) => {
      const projectFestivalBoost =
        project.festivalStatus === 'buzzed'
          ? 8 + project.festivalBuzz * 0.08
          : project.festivalStatus === 'selected'
            ? 4 + project.festivalBuzz * 0.05
            : project.festivalStatus === 'snubbed'
              ? -2
              : baselineFestivalBoost;
      const score = awardsSeasonScore({
        criticalScore: project.criticalScore ?? 50,
        scriptQuality: project.scriptQuality,
        conceptStrength: project.conceptStrength,
        prestige: project.prestige,
        controversy: project.controversy,
        campaignBoost: baseCampaignBoost + arcBoost,
        festivalBoost: projectFestivalBoost,
        studioCriticsReputation: this.reputation.critics,
      });
      const nominationProbability = awardsNominationProbability(score);
      const nominationRolls = clamp(1 + Math.floor(score / 28), 1, 4);
      let nominations = 0;
      for (let i = 0; i < nominationRolls; i += 1) {
        if (this.rivalRng() <= nominationProbability) nominations += 1;
      }
      if (nominations === 0 && score >= 82 && this.rivalRng() < 0.35) {
        nominations = 1;
      }
      let wins = 0;
      if (nominations > 0) {
        const winProbability = awardsWinProbability({
          score,
          nominations,
          controversy: project.controversy,
        });
        if (this.rivalRng() <= winProbability) wins += 1;
        if (nominations >= 3 && this.rivalRng() <= winProbability * 0.35) wins += 1;
      }
      project.awardsNominations += nominations;
      project.awardsWins += wins;
      return {
        projectId: project.id,
        title: project.title,
        nominations,
        wins,
        score,
      };
    });

    results.sort((a, b) => b.score - a.score);
    const totalNominations = results.reduce((sum, item) => sum + item.nominations, 0);
    const totalWins = results.reduce((sum, item) => sum + item.wins, 0);
    const winner = results.find((item) => item.wins > 0) ?? results[0];

    let criticsDelta = totalNominations * 1.4 + totalWins * 5;
    let talentDelta = totalNominations * 0.9 + totalWins * 2.2;
    let distributorDelta = totalNominations * 0.5 + totalWins * 1.8;
    let audienceDelta = totalWins * 1.4;
    if (totalNominations === 0) {
      criticsDelta -= 1;
      talentDelta -= 1;
    }
    this.adjustReputation(Math.round(criticsDelta), 'critics');
    this.adjustReputation(Math.round(talentDelta), 'talent');
    this.adjustReputation(Math.round(distributorDelta), 'distributor');
    this.adjustReputation(Math.round(audienceDelta), 'audience');

    const prestigeRival = this.rivals.find((rival) => rival.personality === 'prestigeHunter');
    if (prestigeRival) {
      this.recordRivalInteraction(prestigeRival, {
        kind: 'prestigePressure',
        hostilityDelta: totalWins > 0 ? 2 : 1,
        respectDelta: totalWins > 0 ? 3 : 1,
        note:
          totalWins > 0
            ? `You converted awards momentum with ${winner.title}.`
            : 'You stayed in awards contention without major wins.',
        projectId: winner.projectId,
      });
    }

    const headline =
      totalWins > 0
        ? `Awards season year ${seasonYear}: ${winner.title} led with ${winner.wins} win(s) and ${winner.nominations} nomination(s).`
        : `Awards season year ${seasonYear}: ${winner.title} led nominations (${winner.nominations}) but no major wins landed.`;
    this.awardsHistory.unshift({
      seasonYear,
      week: this.currentWeek,
      showName: 'Global Film Honors',
      results,
      headline,
    });
    this.awardsHistory = this.awardsHistory.slice(0, 24);
    this.awardsSeasonsProcessed.push(seasonYear);
    this.awardsSeasonsProcessed = this.awardsSeasonsProcessed.slice(-20);
    if (totalNominations > 0 || totalWins > 0) {
      this.addChronicleEntry({
        week: this.currentWeek,
        type: 'awardsOutcome',
        headline,
        impact: totalWins > 0 ? 'positive' : 'neutral',
      });
    }
    events.push(
      `${headline} Reputation: Critics ${Math.round(criticsDelta) >= 0 ? '+' : ''}${Math.round(criticsDelta)}, Talent ${Math.round(talentDelta) >= 0 ? '+' : ''}${Math.round(talentDelta)}.`
    );
  }

  private tickGenreCycles(events: string[]): void {
    for (const genre of MOVIE_GENRES) {
      const state = this.genreCycles[genre] ?? { demand: 1, momentum: 0 };
      const drift = (this.eventRng() - 0.5) * 0.014;
      state.demand = clamp(state.demand + state.momentum + drift, 0.72, 1.35);
      state.momentum = clamp(state.momentum * 0.88 + (this.eventRng() - 0.5) * 0.008, -0.05, 0.05);
      this.genreCycles[genre] = state;
    }

    if (this.currentWeek % 9 === 0) {
      const genre = MOVIE_GENRES[Math.floor(this.eventRng() * MOVIE_GENRES.length)];
      const momentumShift = (this.eventRng() > 0.5 ? 1 : -1) * (0.01 + this.eventRng() * 0.015);
      this.genreCycles[genre].momentum = clamp(this.genreCycles[genre].momentum + momentumShift, -0.05, 0.05);
    }

    if (this.currentWeek % 12 === 0) {
      const snapshot = this.getGenreCycleSnapshot();
      const hottest = snapshot[0];
      const coolest = snapshot[snapshot.length - 1];
      if (hottest && coolest && hottest.genre !== coolest.genre) {
        events.push(
          `Genre cycle shift: ${hottest.genre} heating (${Math.round((hottest.demand - 1) * 100)}%), ${coolest.genre} cooling (${Math.round((coolest.demand - 1) * 100)}%).`
        );
      }
    }
  }

  private resolveFestivalCircuit(events: string[]): void {
    for (const project of this.activeProjects) {
      if (project.festivalStatus !== 'submitted') continue;
      if (!project.festivalResolutionWeek || this.currentWeek < project.festivalResolutionWeek) continue;

      const projection = this.getProjectedForProject(project.id);
      const criticalAnchor = project.criticalScore ?? projection?.critical ?? 55;
      const cycleBoost = (this.getGenreDemandMultiplier(project.genre) - 1) * 12;
      const score = clamp(
        criticalAnchor * 0.48 +
          project.scriptQuality * 2.8 +
          project.prestige * 0.2 +
          project.originality * 0.18 +
          project.festivalBuzz * 0.12 +
          cycleBoost -
          project.controversy * 0.15,
        0,
        100
      );
      const selectionChance = clamp(0.16 + score / 132, 0.08, 0.9);
      const selected = this.eventRng() <= selectionChance;

      if (selected) {
        const buzzChance = clamp(0.15 + score / 170, 0.05, 0.78);
        const buzzed = this.eventRng() <= buzzChance;
        const nextStatus: MovieProject['festivalStatus'] = buzzed ? 'buzzed' : 'selected';
        const buzzGain = buzzed ? 12 + Math.round(this.eventRng() * 6) : 6 + Math.round(this.eventRng() * 4);
        project.festivalStatus = nextStatus;
        project.festivalBuzz = clamp(project.festivalBuzz + buzzGain, 0, FESTIVAL_RULES.MAX_BUZZ);
        project.hypeScore = clamp(project.hypeScore + (buzzed ? 6 : 3), 0, 100);
        this.adjustReputation(buzzed ? 4 : 2, 'critics');
        this.adjustReputation(buzzed ? 2 : 1, 'audience');
        this.storyFlags.festival_selected = (this.storyFlags.festival_selected ?? 0) + 1;
        if (buzzed) {
          this.storyFlags.awards_campaign = (this.storyFlags.awards_campaign ?? 0) + 1;
        }
        const prestigeRival = this.rivals.find((rival) => rival.personality === 'prestigeHunter');
        if (prestigeRival) {
          this.recordRivalInteraction(prestigeRival, {
            kind: 'prestigePressure',
            hostilityDelta: buzzed ? 3 : 2,
            respectDelta: 2,
            note: `${project.title} generated ${buzzed ? 'major' : 'solid'} festival traction at ${project.festivalTarget ?? 'festival circuit'}.`,
            projectId: project.id,
          });
        }
        this.addChronicleEntry({
          week: this.currentWeek,
          type: 'festivalOutcome',
          headline: `${project.title} ${buzzed ? 'broke out' : 'screened'} at ${project.festivalTarget ?? 'festival circuit'}`,
          projectTitle: project.title,
          impact: buzzed ? 'positive' : 'neutral',
        });
        events.push(
          `${project.title} ${buzzed ? 'broke out' : 'landed'} at ${project.festivalTarget ?? 'festival circuit'} (${nextStatus}). Critics ${buzzed ? '+4' : '+2'}.`
        );
      } else {
        project.festivalStatus = 'snubbed';
        project.festivalBuzz = Math.max(0, project.festivalBuzz - 2);
        project.hypeScore = clamp(project.hypeScore - 2, 0, 100);
        this.adjustReputation(-1, 'critics');
        events.push(`${project.title} was passed over at ${project.festivalTarget ?? 'festival circuit'}. Critics -1.`);
      }

      project.festivalResolutionWeek = null;
    }
  }

  private pickFestivalTarget(project: MovieProject): string {
    const prestigeBias = project.prestige + project.scriptQuality * 4 + project.originality * 0.18;
    if (prestigeBias >= 78) return 'Cannes';
    if (project.genre === 'documentary' || project.genre === 'drama') return 'Sundance';
    return 'Toronto';
  }

  private applyRivalDecisionMemory(decision: DecisionItem, option: DecisionItem['options'][number]): void {
    if (!decision.title.startsWith('Counterplay:')) return;
    const rival = this.rivals.find((item) => decision.title.includes(item.name));
    if (!rival) return;

    const kind: RivalInteractionKind = decision.title.includes('Awards')
      ? 'prestigePressure'
      : decision.title.includes('Streaming') || decision.title.includes('Output Deal')
        ? 'streamingPressure'
        : decision.title.includes('Guerrilla')
          ? 'guerrillaPressure'
          : decision.title.includes('Tentpole')
            ? 'releaseCollision'
            : 'counterplayEscalation';

    if (option.cashDelta < 0 || option.hypeDelta > 0) {
      this.recordRivalInteraction(rival, {
        kind,
        hostilityDelta: 3,
        respectDelta: 1,
        note: `Escalated counterplay response: ${option.label}.`,
        projectId: decision.projectId,
      });
      return;
    }

    if (option.label.toLowerCase().includes('accept')) {
      this.recordRivalInteraction(rival, {
        kind,
        hostilityDelta: -2,
        respectDelta: -1,
        note: `Accepted rival pressure option: ${option.label}.`,
        projectId: decision.projectId,
      });
      return;
    }

    this.recordRivalInteraction(rival, {
      kind,
      hostilityDelta: -1,
      respectDelta: 0,
      note: `Lower-intensity response selected: ${option.label}.`,
      projectId: decision.projectId,
    });
  }

  private applyRivalMemoryReversion(): void {
    for (const rival of this.rivals) {
      const memory = this.getRivalMemory(rival);
      memory.hostility = clamp(memory.hostility + (50 - memory.hostility) * 0.035, 0, 100);
      memory.respect = clamp(memory.respect + (50 - memory.respect) * 0.028, 0, 100);
      memory.retaliationBias = clamp(memory.retaliationBias + (50 - memory.retaliationBias) * 0.03, 0, 100);
      memory.cooperationBias = clamp(memory.cooperationBias + (45 - memory.cooperationBias) * 0.03, 0, 100);
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
