import {
  GENRE_CYCLE_RULES,
} from '../balance-constants';
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
} from '../studio-manager.events';
import {
  GENRE_SHOCK_LIBRARY,
  MOVIE_GENRES,
  type ArcOutcomeModifiers,
} from '../studio-manager.constants';
import { clamp } from '../utils';
import { computeArcOutcomeModifiers } from '../modifier-service';
import { getGenreCycleSnapshotForStudio, getGenreDemandMultiplierForStudio } from '../studio-selectors';
import type {
  CrisisEvent,
  DecisionItem,
  EventTemplate,
  MovieGenre,
  MovieProject,
  StoryArcState,
} from '../types';
import type { StudioManager } from '../studio-manager';

export class EventService {
  constructor(private readonly manager: StudioManager) {}

  // ── Genre Cycles ──────────────────────────────────────────────

  getGenreDemandMultiplier(genre: MovieGenre): number {
    return getGenreDemandMultiplierForStudio(this.manager, genre);
  }

  getGenreCycleSnapshot(): {
    genre: MovieGenre;
    demand: number;
    momentum: number;
    shockLabel: string | null;
    shockDirection: 'surge' | 'slump' | null;
    shockWeeksRemaining: number;
  }[] {
    return getGenreCycleSnapshotForStudio(this.manager);
  }

  tickGenreCycles(events: string[]): void {
    for (const genre of MOVIE_GENRES) {
      const state = this.manager.genreCycles[genre] ?? { demand: 1, momentum: 0 };
      const hasShock = !!state.shockUntilWeek && this.manager.currentWeek <= state.shockUntilWeek;
      const shockDirection = state.shockDirection === 'slump' ? -1 : 1;
      const shockStrength = hasShock ? (state.shockStrength ?? 0) * shockDirection : 0;
      const drift = (this.manager.eventRng() - 0.5) * GENRE_CYCLE_RULES.DRIFT_RANGE;

      state.demand = clamp(
        state.demand + state.momentum + drift + shockStrength * 0.55,
        GENRE_CYCLE_RULES.DEMAND_MIN,
        GENRE_CYCLE_RULES.DEMAND_MAX
      );
      state.momentum = clamp(
        state.momentum * 0.88 + (this.manager.eventRng() - 0.5) * GENRE_CYCLE_RULES.MOMENTUM_DRIFT_RANGE + shockStrength * 0.2,
        GENRE_CYCLE_RULES.MOMENTUM_MIN,
        GENRE_CYCLE_RULES.MOMENTUM_MAX
      );

      if (state.shockUntilWeek && this.manager.currentWeek > state.shockUntilWeek) {
        state.shockLabel = null;
        state.shockDirection = null;
        state.shockStrength = null;
        state.shockUntilWeek = null;
      }

      this.manager.genreCycles[genre] = state;
    }

    if (this.manager.currentWeek % 9 === 0) {
      const genre = MOVIE_GENRES[Math.floor(this.manager.eventRng() * MOVIE_GENRES.length)];
      const momentumShift = (this.manager.eventRng() > 0.5 ? 1 : -1) * (0.01 + this.manager.eventRng() * 0.015);
      this.manager.genreCycles[genre].momentum = clamp(
        this.manager.genreCycles[genre].momentum + momentumShift,
        GENRE_CYCLE_RULES.MOMENTUM_MIN,
        GENRE_CYCLE_RULES.MOMENTUM_MAX
      );
    }

    if (this.manager.currentWeek % GENRE_CYCLE_RULES.SHOCK_CHECK_INTERVAL_WEEKS === 0) {
      this.triggerGenreShock(events);
    }

    if (this.manager.currentWeek % 12 === 0) {
      const snapshot = this.getGenreCycleSnapshot();
      const hottest = snapshot[0];
      const coolest = snapshot[snapshot.length - 1];
      if (hottest && coolest && hottest.genre !== coolest.genre) {
        events.push(
          `Genre cycle shift: ${hottest.genre} is heating up while ${coolest.genre} is cooling off.`
        );
      }
    }
  }

  private triggerGenreShock(events: string[]): void {
    const ranked = this.getGenreCycleSnapshot().filter((entry) => {
      const state = this.manager.genreCycles[entry.genre];
      return !state?.shockUntilWeek || this.manager.currentWeek > state.shockUntilWeek;
    });
    if (ranked.length === 0) return;

    const topBand = ranked.slice(0, Math.max(2, Math.ceil(ranked.length / 3)));
    const bottomBand = ranked.slice(-Math.max(2, Math.ceil(ranked.length / 3)));
    const slumpFirst = this.manager.eventRng() < 0.58;
    const sourceBand = slumpFirst ? topBand : bottomBand;
    const picked = sourceBand[Math.floor(this.manager.eventRng() * sourceBand.length)] ?? ranked[0];
    if (!picked) return;

    const direction: 'surge' | 'slump' = slumpFirst ? 'slump' : 'surge';
    const duration =
      GENRE_CYCLE_RULES.SHOCK_DURATION_MIN +
      Math.floor(
        this.manager.eventRng() * (GENRE_CYCLE_RULES.SHOCK_DURATION_MAX - GENRE_CYCLE_RULES.SHOCK_DURATION_MIN + 1)
      );
    const strength =
      GENRE_CYCLE_RULES.SHOCK_INTENSITY_MIN +
      this.manager.eventRng() * (GENRE_CYCLE_RULES.SHOCK_INTENSITY_MAX - GENRE_CYCLE_RULES.SHOCK_INTENSITY_MIN);
    const labelPool = GENRE_SHOCK_LIBRARY[picked.genre][direction];
    const label = labelPool[Math.floor(this.manager.eventRng() * labelPool.length)] ?? `${picked.genre} market shift`;
    const state = this.manager.genreCycles[picked.genre] ?? { demand: 1, momentum: 0 };

    state.shockLabel = label;
    state.shockDirection = direction;
    state.shockStrength = strength;
    state.shockUntilWeek = this.manager.currentWeek + duration;
    this.manager.genreCycles[picked.genre] = state;

    events.push(
      `Genre shock: ${picked.genre} ${direction === 'surge' ? 'surge' : 'slump'} (${label}) over roughly ${duration} weeks.`
    );
  }

  // ── Script Evaluation ─────────────────────────────────────────

  evaluateScriptPitch(scriptId: string): {
    score: number;
    recommendation: 'strongBuy' | 'conditional' | 'pass';
    qualityScore: number;
    valueScore: number;
    affordabilityScore: number;
    riskLabel: 'low' | 'medium' | 'high';
  } | null {
    const script = this.manager.scriptMarket.find((item) => item.id === scriptId);
    if (!script) return null;

    const affordability = script.askingPrice / Math.max(1, this.manager.cash);
    const qualityScore = clamp(
      ((script.scriptQuality / 10) * 0.62 + (script.conceptStrength / 10) * 0.38) * 100,
      0,
      100
    );
    const affordabilityScore = clamp((1 - affordability / 0.18) * 100, 0, 100);
    const valueScore = clamp(qualityScore * 0.74 + affordabilityScore * 0.26, 0, 100);
    const score = valueScore;
    const recommendation = score >= 70 ? 'strongBuy' : score >= 55 ? 'conditional' : 'pass';
    const riskLabel =
      affordability > 0.15 || qualityScore < 58
        ? 'high'
        : affordability > 0.08 || qualityScore < 70
          ? 'medium'
          : 'low';

    return {
      score,
      recommendation,
      qualityScore,
      valueScore,
      affordabilityScore,
      riskLabel,
    };
  }

  // ── Arc Outcome Modifiers ─────────────────────────────────────

  getArcOutcomeModifiers(): ArcOutcomeModifiers {
    return computeArcOutcomeModifiers(this.manager);
  }

  // ── Event/Decision/Crisis pass-throughs ───────────────────────

  tickDecisionExpiry(events: string[]): void {
    tickDecisionExpiryForManager(this.manager, events);
  }

  tickScriptMarketExpiry(events: string[]): void {
    tickScriptMarketExpiryForManager(this.manager, events);
  }

  refillScriptMarket(events: string[]): void {
    refillScriptMarketForManager(this.manager, events);
  }

  rollForCrises(events: string[]): void {
    rollForCrisesForManager(this.manager, events);
  }

  generateEventDecisions(events: string[]): void {
    generateEventDecisionsForManager(this.manager, events);
  }

  pickWeightedEvent(): EventTemplate | null {
    return pickWeightedEventForManager(this.manager);
  }

  eventWeight(event: EventTemplate): number {
    return eventWeightForManager(this.manager, event);
  }

  getEventArcId(event: EventTemplate): string | null {
    return getEventArcIdForManager(this.manager, event);
  }

  getArcPressureFromRivals(arcId: string): number {
    return getArcPressureFromRivalsForManager(this.manager, arcId);
  }

  getEventProjectCandidates(event: EventTemplate): MovieProject[] {
    return getEventProjectCandidatesForManager(this.manager, event);
  }

  chooseProjectForEvent(event: EventTemplate): MovieProject | null {
    return chooseProjectForEventForManager(this.manager, event);
  }

  hasStoryFlag(flag: string): boolean {
    return hasStoryFlagForManager(this.manager, flag);
  }

  matchesArcRequirement(input: {
    id: string;
    minStage?: number;
    maxStage?: number;
    status?: 'active' | 'resolved' | 'failed';
  }): boolean {
    return matchesArcRequirementForManager(this.manager, input);
  }

  ensureArcState(arcId: string): StoryArcState {
    return ensureArcStateForManager(this.manager, arcId);
  }

  applyArcMutation(arcId: string, option: DecisionItem['options'][number]): void {
    applyArcMutationForManager(this.manager, arcId, option);
  }

  applyStoryFlagMutations(setFlag?: string, clearFlag?: string): void {
    applyStoryFlagMutationsForManager(this.manager, setFlag, clearFlag);
  }

  getDecisionTargetProject(decision: DecisionItem): MovieProject | null {
    return getDecisionTargetProjectForManager(this.manager, decision);
  }

  buildOperationalCrisis(project: MovieProject): CrisisEvent {
    return buildOperationalCrisisForManager(this.manager, project);
  }

  injectCrisis(crisis: CrisisEvent): void {
    this.manager.pendingCrises.push(crisis);
  }

  dismissDecision(decisionId: string): void {
    this.manager.decisionQueue = this.manager.decisionQueue.filter((item) => item.id !== decisionId);
  }
}
