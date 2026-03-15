import type { StudioManager } from '../studio-manager';
import type { DecisionItem, MovieProject, RivalInteractionKind, RivalStudio, Talent } from '../types';
import { MEMORY_RULES } from '../balance-constants';
import { clamp } from '../utils';
import {
  checkRivalReleaseResponsesForManager,
  getRivalBehaviorProfileForManager,
  processRivalCalendarMovesForManager,
  processRivalSignatureCrisesForManager,
  processRivalSignatureMovesForManager,
  processRivalTalentAcquisitionsForManager,
  queueRivalCounterplayDecisionForManager,
  rivalHeatBiasForManager,
  rivalNewsHeadlineForManager,
  tickRivalHeatForManager,
} from '../studio-manager.rivals';
import { pickTalentForRivalForManager } from '../studio-manager.rivals.selectors';

export class RivalAiService {
  constructor(private readonly manager: StudioManager) {}

  tickRivalHeat(events: string[]): void {
    tickRivalHeatForManager(this.manager, events);
  }

  processRivalTalentAcquisitions(events: string[]): void {
    processRivalTalentAcquisitionsForManager(this.manager, events);
  }

  processRivalCalendarMoves(events: string[]): void {
    processRivalCalendarMovesForManager(this.manager, events);
  }

  processRivalSignatureMoves(events: string[]): void {
    processRivalSignatureMovesForManager(this.manager, events);
  }

  processRivalSignatureCrises(events: string[]): void {
    processRivalSignatureCrisesForManager(this.manager, events);
  }

  checkRivalReleaseResponses(releasedProject: MovieProject, events: string[]): void {
    checkRivalReleaseResponsesForManager(this.manager, releasedProject, events);
  }

  queueRivalCounterplayDecision(flag: string, rivalName: string, projectId?: string): void {
    queueRivalCounterplayDecisionForManager(this.manager, flag, rivalName, projectId);
  }

  pickTalentForRival(rival: RivalStudio, candidates: Talent[]): Talent | null {
    return pickTalentForRivalForManager(this.manager, rival, candidates);
  }

  rivalHeatBias(personality: RivalStudio['personality']): number {
    return rivalHeatBiasForManager(this.manager, personality);
  }

  getRivalBehaviorProfile(rival: RivalStudio): ReturnType<typeof getRivalBehaviorProfileForManager> {
    return getRivalBehaviorProfileForManager(this.manager, rival);
  }

  rivalNewsHeadline(name: string, delta: number): string {
    return rivalNewsHeadlineForManager(this.manager, name, delta);
  }

  getRivalMemory(rival: RivalStudio): RivalStudio['memory'] {
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

  getRivalStance(rival: RivalStudio): 'friendly' | 'warm' | 'neutral' | 'competitor' | 'rival' {
    const memory = this.getRivalMemory(rival);
    const score = memory.hostility - memory.respect;
    if (score >= 26) return 'rival';
    if (score >= 10) return 'competitor';
    if (score <= -22) return 'friendly';
    if (score <= -8) return 'warm';
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
      week: this.manager.currentWeek,
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

  applyRivalDecisionMemory(decision: DecisionItem, option: DecisionItem['options'][number]): void {
    if (!decision.title.startsWith('Counterplay:')) return;
    const rival = this.manager.rivals.find((item) => new RegExp(`\\b${item.name}\\b`, 'i').test(decision.title));
    if (!rival) return;

    const kind: RivalInteractionKind = decision.title.includes('Awards')
      ? 'prestigePressure'
      : decision.title.includes('Platform')
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

  applyRivalMemoryReversion(): void {
    for (const rival of this.manager.rivals) {
      const memory = this.getRivalMemory(rival);
      memory.hostility = clamp(Math.round(memory.hostility + (50 - memory.hostility) * 0.035), 0, 100);
      memory.respect = clamp(Math.round(memory.respect + (50 - memory.respect) * 0.028), 0, 100);
      memory.retaliationBias = clamp(Math.round(memory.retaliationBias + (50 - memory.retaliationBias) * 0.03), 0, 100);
      memory.cooperationBias = clamp(Math.round(memory.cooperationBias + (45 - memory.cooperationBias) * 0.03), 0, 100);
    }
  }
}
