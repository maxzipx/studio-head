import type { StudioManager } from '../studio-manager';
import type { TutorialState } from '../types';

export class TutorialService {
  constructor(private readonly manager: StudioManager) {}

  isTutorialEligible(): boolean {
    return !this.manager.needsFoundingSetup && !this.manager.tutorialCompleted && !this.manager.tutorialDismissed;
  }

  hasCreatedFirstProject(): boolean {
    return this.manager.activeProjects.length > 0 || this.manager.releaseReports.length > 0;
  }

  beginTutorialIfEligible(): { success: boolean; message: string } {
    if (!this.isTutorialEligible()) {
      return { success: false, message: 'Tutorial is not eligible for this run.' };
    }

    if (this.manager.tutorialState === 'none' || this.manager.tutorialState === 'complete') {
      this.manager.tutorialState = 'hqIntro';
    }

    return { success: true, message: 'HQ tutorial active.' };
  }

  advanceTutorial(nextState?: TutorialState): { success: boolean; message: string } {
    if (this.manager.tutorialDismissed || this.manager.tutorialCompleted || this.manager.tutorialState === 'complete') {
      return { success: false, message: 'Tutorial already complete.' };
    }

    if (!this.isTutorialEligible()) {
      return { success: false, message: 'Tutorial is not available yet.' };
    }

    const sequence: TutorialState[] = ['hqIntro', 'strategy', 'firstProject', 'marketing', 'talent', 'risk', 'complete'];
    const currentIndex = sequence.indexOf(this.manager.tutorialState);
    if (currentIndex === -1) {
      this.manager.tutorialState = 'hqIntro';
      return { success: true, message: 'Tutorial restarted from HQ.' };
    }

    const targetState = nextState ?? sequence[currentIndex + 1] ?? 'complete';
    if (!sequence.includes(targetState)) {
      return { success: false, message: 'Invalid tutorial step.' };
    }

    const targetIndex = sequence.indexOf(targetState);
    if (targetIndex > currentIndex + 1) {
      return { success: false, message: 'Tutorial step is out of sequence.' };
    }
    if (targetIndex <= currentIndex) {
      return { success: false, message: 'Tutorial step already reached.' };
    }


    if (targetState === 'complete') {
      this.manager.tutorialState = 'complete';
      this.manager.tutorialCompleted = true;
      this.manager.tutorialDismissed = false;
      return { success: true, message: 'Tutorial complete. HQ fully unlocked.' };
    }

    this.manager.tutorialState = targetState;
    return { success: true, message: 'Tutorial step advanced.' };
  }

  dismissTutorial(): { success: boolean; message: string } {
    if (!this.isTutorialEligible() || this.manager.tutorialState === 'none' || this.manager.tutorialState === 'complete') {
      return { success: false, message: 'Tutorial is not currently active.' };
    }
    this.manager.tutorialDismissed = true;
    this.manager.tutorialCompleted = false;
    this.manager.tutorialState = 'complete';
    return { success: true, message: 'Tutorial dismissed.' };
  }

  restartTutorial(): { success: boolean; message: string } {
    if (this.manager.needsFoundingSetup) {
      return { success: false, message: 'Complete founding setup before replaying the tutorial.' };
    }

    this.manager.tutorialDismissed = false;
    this.manager.tutorialCompleted = false;
    this.manager.tutorialState = 'hqIntro';
    return { success: true, message: 'Tutorial restarted.' };
  }
}
