import {
  heatDeltaFromRelease,
  projectedCriticalScore,
  projectedOpeningWeekendRange,
  projectedROI,
} from './formulas';
import { chooseEventProjectId, getEventDeck } from './event-deck';
import { createOpeningDecisions, createSeedProjects, createSeedScriptMarket, createSeedTalentPool } from './seeds';
import type {
  CrisisEvent,
  DecisionItem,
  EventTemplate,
  MovieGenre,
  MovieProject,
  ScriptPitch,
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
      return 0.006;
    case 'preProduction':
      return 0.009;
    case 'production':
      return 0.018;
    case 'postProduction':
      return 0.01;
    case 'distribution':
      return 0.004;
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
  private readonly eventDeck: EventTemplate[] = getEventDeck();
  private readonly lastEventWeek = new Map<string, number>();

  studioName = 'Project Greenlight';
  cash = 50_000_000;
  studioHeat = 12;
  currentWeek = 1;
  pendingCrises: CrisisEvent[] = [];
  decisionQueue: DecisionItem[] = createOpeningDecisions();
  activeProjects: MovieProject[] = createSeedProjects();
  talentPool: Talent[] = createSeedTalentPool();
  scriptMarket: ScriptPitch[] = createSeedScriptMarket();
  lastWeekSummary: WeekSummary | null = null;

  constructor(input?: { crisisRng?: () => number; eventRng?: () => number; negotiationRng?: () => number }) {
    this.crisisRng = input?.crisisRng ?? Math.random;
    this.eventRng = input?.eventRng ?? Math.random;
    this.negotiationRng = input?.negotiationRng ?? Math.random;
  }

  get canEndWeek(): boolean {
    return this.pendingCrises.length === 0;
  }

  getAvailableTalentForRole(role: TalentRole): Talent[] {
    return this.talentPool.filter((talent) => talent.role === role && talent.availability === 'available');
  }

  runOptionalAction(): void {
    const project = this.activeProjects[0];
    if (!project) return;
    project.hypeScore = clamp(project.hypeScore + 4, 0, 100);
    project.marketingBudget += 250_000;
    this.cash -= 250_000;
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
      projectedROI: 1,
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
    const retainer = talent.salary.base * 0.1;
    if (this.cash < retainer) return { success: false, message: 'Insufficient funds for deal memo retainer.' };
    if (this.negotiationRng() > chance) return { success: false, message: `${talent.name}'s reps declined current terms.` };

    this.cash -= retainer;
    talent.availability = 'attached';
    talent.attachedProjectId = project.id;

    if (talent.role === 'director') {
      project.directorId = talent.id;
    } else if (talent.role === 'leadActor' || talent.role === 'supportingActor') {
      if (!project.castIds.includes(talent.id)) {
        project.castIds.push(talent.id);
      }
    }
    project.hypeScore = clamp(project.hypeScore + talent.starPower * 0.8, 0, 100);
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
      project.releaseWindow = 'wideTheatrical';
      project.scheduledWeeksRemaining = 3;
      return { success: true, message: `${project.title} moved to Distribution.` };
    }

    if (project.phase === 'distribution') {
      if (project.scheduledWeeksRemaining > 0) {
        return { success: false, message: 'Distribution setup is still underway.' };
      }
      const projection = this.getProjectedForProject(project.id);
      if (!projection) return { success: false, message: 'Projection unavailable.' };
      project.phase = 'released';
      project.criticalScore = projection.critical;
      project.audienceScore = clamp(projection.critical + 4, 0, 100);
      project.finalBoxOffice = projection.openingHigh * 3.1;
      project.projectedROI = projection.roi;
      const heatDelta = heatDeltaFromRelease({
        currentHeat: this.studioHeat,
        criticalScore: project.criticalScore,
        roi: project.projectedROI,
        awardsNominations: 0,
        awardsWins: 0,
        controversyPenalty: 0,
      });
      this.studioHeat = clamp(this.studioHeat + heatDelta, 0, 100);
      this.releaseTalent(project.id);
      return { success: true, message: `${project.title} released. Heat change: ${heatDelta >= 0 ? '+' : ''}${heatDelta.toFixed(0)}.` };
    }

    return { success: false, message: 'Project is already released.' };
  }

  resolveCrisis(crisisId: string, optionId: string): void {
    const crisis = this.pendingCrises.find((item) => item.id === crisisId);
    if (!crisis) return;
    const option = crisis.options.find((item) => item.id === optionId);
    if (!option) return;

    const project = this.activeProjects.find((item) => item.id === crisis.projectId);
    if (project) {
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

    if (decision.projectId) {
      const project = this.activeProjects.find((item) => item.id === decision.projectId);
      if (project) {
        project.scriptQuality = clamp(project.scriptQuality + option.scriptQualityDelta, 0, 10);
        project.hypeScore = clamp(project.hypeScore + option.hypeDelta, 0, 100);
      }
    }

    this.cash += option.cashDelta;
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
    this.tickDecisionExpiry(events);
    this.tickScriptMarketExpiry(events);
    this.rollForCrises(events);
    this.generateEventDecisions(events);
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

    const roi = projectedROI({
      openingWeekend: opening.midpoint,
      criticalScore: critical,
      audienceScore: clamp(critical + 4, 0, 100),
      genre: project.genre,
      totalCost: project.budget.ceiling + project.marketingBudget,
    });

    return { critical, openingLow: opening.low, openingHigh: opening.high, roi };
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
      if (project.phase !== 'production') continue;
      const riskBoost = project.budget.overrunRisk * 0.2;
      const rollThreshold = 0.18 + riskBoost;
      if (this.crisisRng() > rollThreshold) continue;

      const crisis: CrisisEvent = {
        id: id('crisis'),
        projectId: project.id,
        title: 'Lead Actor Scheduling Conflict',
        severity: project.productionStatus === 'atRisk' ? 'red' : 'orange',
        body: 'A hard conflict puts next week shooting at risk. Choose how to handle it.',
        options: [
          {
            id: id('c-opt'),
            label: 'Pay Overtime to Keep Schedule',
            preview: '-$600K now, no schedule slip.',
            cashDelta: -600_000,
            scheduleDelta: 0,
            hypeDelta: 0,
          },
          {
            id: id('c-opt'),
            label: 'Delay One Week',
            preview: 'Save cash, but schedule slips and press chatter starts.',
            cashDelta: -100_000,
            scheduleDelta: 1,
            hypeDelta: -3,
          },
        ],
      };
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

    const projectId = chooseEventProjectId(this.activeProjects);
    const decision = nextEvent.buildDecision({ idFactory: id, projectId });
    this.decisionQueue.push(decision);
    this.lastEventWeek.set(nextEvent.id, this.currentWeek);
    events.push(`New event: ${nextEvent.title}.`);
  }

  private pickWeightedEvent(): EventTemplate | null {
    const queuedTitles = new Set(this.decisionQueue.map((item) => item.title));
    const weighted = this.eventDeck
      .filter((event) => {
        if (this.currentWeek < event.minWeek) return false;
        if (queuedTitles.has(event.buildDecision({ idFactory: id, projectId: null }).title)) return false;
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
    const hasDevelopment = this.activeProjects.some((project) => project.phase === 'development');
    const hasProduction = this.activeProjects.some((project) => project.phase === 'production');

    if (event.id === 'rewrite-window' && hasDevelopment) weight += 0.9;
    if (event.id === 'trailer-drop' && hasProduction) weight += 0.8;
    if (event.id === 'festival-buzz') weight += this.studioHeat > 30 ? 1 : 0.2;
    return weight;
  }

  private projectOutcomes(): void {
    for (const project of this.activeProjects) {
      const projection = this.getProjectedForProject(project.id);
      if (!projection) continue;
      project.projectedROI = projection.roi;
    }
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
