import { StudioManager } from '../domain/studio-manager';
import { hydrateManagerData } from './persistence';

import type { GameActions } from './game-types';

interface BuildGameActionsInput {
  manager: StudioManager;
  runWhenHydrated: (action: () => void, options?: { allowWhenBankrupt?: boolean }) => void;
  saveAndTick: (message?: string, options?: { clearMessage?: boolean }) => void;
}

export function buildGameActions(input: BuildGameActionsInput): GameActions {
  const { manager, runWhenHydrated, saveAndTick } = input;

  return {
    endWeek: () => {
      runWhenHydrated(() => {
        const startWeek = manager.currentWeek;
        const summary = manager.endTurn();
        const advanced = summary.week - startWeek;
        const paused = summary.hasPendingCrises && advanced < manager.turnLengthWeeks;
        saveAndTick(
          `Turn progressed ${advanced} week${advanced === 1 ? '' : 's'} out of 2.${paused ? ' Paused before the second week by a blocking crisis.' : ''}`,
          { clearMessage: true }
        );
      });
    },
    advanceToNextDecision: () => {
      runWhenHydrated(() => {
        const result = manager.advanceUntilDecision();
        saveAndTick(result.message);
      });
    },
    resolveCrisis: (crisisId: string, optionId: string) => {
      runWhenHydrated(() => {
        const result = manager.resolveCrisis(crisisId, optionId);
        saveAndTick(result.message);
      });
    },
    resolveDecision: (decisionId: string, optionId: string) => {
      runWhenHydrated(() => {
        manager.resolveDecision(decisionId, optionId);
        saveAndTick('Decision committed.');
      });
    },
    dismissDecision: (decisionId: string) => {
      runWhenHydrated(() => {
        manager.dismissDecision(decisionId);
        saveAndTick('Decision dismissed.');
      });
    },
    runOptionalAction: () => {
      runWhenHydrated(() => {
        const result = manager.runOptionalAction();
        saveAndTick(result.message);
      });
    },
    acquireScript: (scriptId: string) => {
      runWhenHydrated(() => {
        const result = manager.acquireScript(scriptId);
        saveAndTick(result.message);
      });
    },
    passScript: (scriptId: string) => {
      runWhenHydrated(() => {
        manager.passScript(scriptId);
        saveAndTick('Script passed.');
      });
    },
    renameStudio: (name: string) => {
      runWhenHydrated(() => {
        const result = manager.operationsService.setStudioName(name);
        saveAndTick(result.message);
      });
    },
    attachTalent: (projectId: string, talentId: string) => {
      runWhenHydrated(() => {
        const result = manager.talentService.negotiateAndAttachTalent(projectId, talentId);
        saveAndTick(result.message);
      });
    },
    startNegotiation: (projectId: string, talentId: string) => {
      runWhenHydrated(() => {
        const result = manager.talentService.startTalentNegotiation(projectId, talentId);
        saveAndTick(result.message);
      });
    },
    startNegotiationRound: (projectId: string, talentId: string, action) => {
      runWhenHydrated(() => {
        const result = manager.talentService.startTalentNegotiationRound(projectId, talentId, action);
        saveAndTick(result.message);
      });
    },
    adjustNegotiation: (projectId: string, talentId: string, action) => {
      runWhenHydrated(() => {
        const result = manager.talentService.adjustTalentNegotiation(projectId, talentId, action);
        saveAndTick(result.message);
      });
    },
    dismissNegotiation: (projectId: string, talentId: string) => {
      runWhenHydrated(() => {
        manager.talentService.dismissTalentNegotiation(projectId, talentId);
        saveAndTick('Negotiation dismissed.');
      });
    },
    advancePhase: (projectId: string) => {
      let phaseResult: { success: boolean; message: string } = { success: false, message: '' };
      runWhenHydrated(() => {
        phaseResult = manager.lifecycleService.advanceProjectPhase(projectId);
        saveAndTick(phaseResult.message);
      });
      return phaseResult;
    },
    setReleaseWeek: (projectId: string, releaseWeek: number) => {
      runWhenHydrated(() => {
        const result = manager.lifecycleService.setProjectReleaseWeek(projectId, releaseWeek);
        saveAndTick(result.message);
      });
    },
    confirmReleaseWeek: (projectId: string) => {
      runWhenHydrated(() => {
        const result = manager.lifecycleService.confirmProjectReleaseWeek(projectId);
        saveAndTick(result.message);
      });
    },
    acceptOffer: (projectId: string, offerId: string) => {
      runWhenHydrated(() => {
        const result = manager.lifecycleService.acceptDistributionOffer(projectId, offerId);
        saveAndTick(result.message);
      });
    },
    counterOffer: (projectId: string, offerId: string) => {
      runWhenHydrated(() => {
        const result = manager.lifecycleService.counterDistributionOffer(projectId, offerId);
        saveAndTick(result.message);
      });
    },
    walkAwayOffer: (projectId: string) => {
      runWhenHydrated(() => {
        const result = manager.lifecycleService.walkAwayDistribution(projectId);
        saveAndTick(result.message);
      });
    },
    dismissReleaseReveal: (projectId: string) => {
      runWhenHydrated(() => {
        manager.dismissReleaseReveal(projectId);
        saveAndTick();
      }, { allowWhenBankrupt: true });
    },
    dismissInboxNotification: (notificationId: string) => {
      runWhenHydrated(() => {
        manager.dismissInboxNotification(notificationId);
        saveAndTick();
      }, { allowWhenBankrupt: true });
    },
    runMarketingPush: (projectId: string) => {
      runWhenHydrated(() => {
        const result = manager.runMarketingPushOnProject(projectId);
        saveAndTick(result.message);
      });
    },
    runFestivalSubmission: (projectId: string) => {
      runWhenHydrated(() => {
        const result = manager.runFestivalSubmission(projectId);
        saveAndTick(result.message);
      });
    },
    runScriptSprint: (projectId: string) => {
      runWhenHydrated(() => {
        const result = manager.runScriptDevelopmentSprint(projectId);
        saveAndTick(result.message);
      });
    },
    runPostPolishPass: (projectId: string) => {
      runWhenHydrated(() => {
        const result = manager.runPostProductionPolishPass(projectId);
        saveAndTick(result.message);
      });
    },
    abandonProject: (projectId: string) => {
      runWhenHydrated(() => {
        const result = manager.abandonProject(projectId);
        saveAndTick(result.message);
      });
    },
    startSequel: (projectId: string) => {
      runWhenHydrated(() => {
        const result = manager.startSequel(projectId);
        saveAndTick(result.message);
      });
    },
    setFranchiseStrategy: (projectId: string, strategy) => {
      runWhenHydrated(() => {
        const result = manager.franchiseService.setFranchiseStrategy(projectId, strategy);
        saveAndTick(result.message);
      });
    },
    runFranchiseBrandReset: (projectId: string) => {
      runWhenHydrated(() => {
        const result = manager.franchiseService.runFranchiseBrandReset(projectId);
        saveAndTick(result.message);
      });
    },
    runFranchiseLegacyCastingCampaign: (projectId: string) => {
      runWhenHydrated(() => {
        const result = manager.franchiseService.runFranchiseLegacyCastingCampaign(projectId);
        saveAndTick(result.message);
      });
    },
    runFranchiseHiatusPlanning: (projectId: string) => {
      runWhenHydrated(() => {
        const result = manager.franchiseService.runFranchiseHiatusPlanning(projectId);
        saveAndTick(result.message);
      });
    },
    runGreenlightReview: (projectId: string, approve: boolean) => {
      runWhenHydrated(() => {
        const result = manager.runGreenlightReview(projectId, approve);
        saveAndTick(result.message);
      });
    },
    runTestScreening: (projectId: string) => {
      runWhenHydrated(() => {
        const result = manager.runTestScreening(projectId);
        saveAndTick(result.message);
      });
    },
    runReshoots: (projectId: string) => {
      runWhenHydrated(() => {
        const result = manager.runReshoots(projectId);
        saveAndTick(result.message);
      });
    },
    runTrackingLeverage: (projectId: string) => {
      runWhenHydrated(() => {
        const result = manager.runTrackingLeverage(projectId);
        saveAndTick(result.message);
      });
    },
    upgradeMarketingTeam: () => {
      runWhenHydrated(() => {
        const result = manager.operationsService.upgradeMarketingTeam();
        saveAndTick(result.message);
      });
    },
    upgradeStudioCapacity: () => {
      runWhenHydrated(() => {
        const result = manager.operationsService.upgradeStudioCapacity();
        saveAndTick(result.message);
      });
    },
    foundAnimationDivision: () => {
      runWhenHydrated(() => {
        const result = manager.operationsService.foundAnimationDivision();
        saveAndTick(result.message);
      });
    },
    acquireIpRights: (ipId: string) => {
      runWhenHydrated(() => {
        const result = manager.ipService.acquireIpRights(ipId);
        saveAndTick(result.message);
      });
    },
    developFromIp: (ipId: string) => {
      runWhenHydrated(() => {
        const result = manager.ipService.developProjectFromIp(ipId);
        saveAndTick(result.message);
      });
    },
    setStudioSpecialization: (focus) => {
      runWhenHydrated(() => {
        const result = manager.operationsService.setStudioSpecialization(focus);
        saveAndTick(result.message);
      });
    },
    completeFoundingSetup: (specialization, foundingProfile) => {
      runWhenHydrated(() => {
        const result = manager.operationsService.completeFoundingSetup({ specialization, foundingProfile });
        saveAndTick(result.message);
      });
    },
    advanceTutorial: () => {
      runWhenHydrated(() => {
        const result = manager.tutorialService.advanceTutorial();
        saveAndTick(result.message);
      }, { allowWhenBankrupt: true });
    },
    dismissTutorial: () => {
      runWhenHydrated(() => {
        const result = manager.tutorialService.dismissTutorial();
        saveAndTick(result.message);
      }, { allowWhenBankrupt: true });
    },
    restartTutorial: () => {
      runWhenHydrated(() => {
        const result = manager.tutorialService.restartTutorial();
        saveAndTick(result.message);
      }, { allowWhenBankrupt: true });
    },
    investDepartment: (track) => {
      runWhenHydrated(() => {
        const result = manager.operationsService.investDepartment(track);
        saveAndTick(result.message);
      });
    },
    signExclusivePartner: (partner: string) => {
      runWhenHydrated(() => {
        const result = manager.operationsService.signExclusiveDistributionPartner(partner);
        saveAndTick(result.message);
      });
    },
    poachExecutiveTeam: () => {
      runWhenHydrated(() => {
        const result = manager.operationsService.poachExecutiveTeam();
        saveAndTick(result.message);
      });
    },
    startNewRun: () => {
      runWhenHydrated(() => {
        const freshTalentSeed = Math.floor(Math.random() * 2_147_483_647);
        const freshManager = new StudioManager({
          talentSeed: freshTalentSeed,
          startWithSeedProjects: false,
          includeOpeningDecisions: false,
        });
        hydrateManagerData(manager, freshManager);
        manager.newlyAcquiredProjectId = null;
        saveAndTick('Started a new run.');
      }, { allowWhenBankrupt: true });
    },
  };
}
