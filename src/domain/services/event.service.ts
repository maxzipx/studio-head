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
  clamp,
  GENRE_SHOCK_LIBRARY,
  MOVIE_GENRES,
  type ArcOutcomeModifiers,
} from '../studio-manager.constants';
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
    return this.manager.genreCycles[genre]?.demand ?? 1;
  }

  getGenreCycleSnapshot(): {
    genre: MovieGenre;
    demand: number;
    momentum: number;
    shockLabel: string | null;
    shockDirection: 'surge' | 'slump' | null;
    shockWeeksRemaining: number;
  }[] {
    return MOVIE_GENRES.map((genre) => ({
      genre,
      demand: this.getGenreDemandMultiplier(genre),
      momentum: this.manager.genreCycles[genre]?.momentum ?? 0,
      shockLabel: this.manager.genreCycles[genre]?.shockLabel ?? null,
      shockDirection: this.manager.genreCycles[genre]?.shockDirection ?? null,
      shockWeeksRemaining: Math.max(0, (this.manager.genreCycles[genre]?.shockUntilWeek ?? this.manager.currentWeek) - this.manager.currentWeek),
    })).sort((a, b) => b.demand - a.demand);
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
    const modifiers: ArcOutcomeModifiers = {
      talentLeverage: 0,
      distributionLeverage: 0,
      burnMultiplier: 1,
      hypeDecayStep: 2,
      releaseHeatMomentum: 0,
      categoryBias: {},
    };

    for (const [arcId, arc] of Object.entries(this.manager.storyArcs)) {
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

    modifiers.distributionLeverage += this.manager.specializationProfile.distributionLeverage;
    modifiers.distributionLeverage += this.manager.departmentLevels.distribution * 0.015;
    modifiers.distributionLeverage += this.manager.executiveNetworkLevel * 0.01;
    modifiers.talentLeverage += this.manager.executiveNetworkLevel * 0.012;
    if (this.manager.studioSpecialization === 'blockbuster') {
      modifiers.hypeDecayStep = Math.max(0.8, modifiers.hypeDecayStep - 0.2);
    } else if (this.manager.studioSpecialization === 'prestige') {
      modifiers.releaseHeatMomentum += 0.6;
    }

    modifiers.burnMultiplier = clamp(modifiers.burnMultiplier, 0.85, 1.2);
    modifiers.distributionLeverage = clamp(modifiers.distributionLeverage, -0.12, 0.12);
    modifiers.talentLeverage = clamp(modifiers.talentLeverage, -0.2, 0.2);
    modifiers.hypeDecayStep = clamp(modifiers.hypeDecayStep, 0.8, 3.2);
    modifiers.releaseHeatMomentum = clamp(modifiers.releaseHeatMomentum, -3, 3);
    return modifiers;
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
