import type { StudioManager } from '../studio-manager';
import type { MovieProject, RivalStudio, Talent } from '../types';
import {
  checkRivalReleaseResponsesForManager,
  getRivalBehaviorProfileForManager,
  processRivalCalendarMovesForManager,
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
}
