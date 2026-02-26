import { StudioManager } from '@/src/domain/studio-manager';

import type { GameActions } from './game-types';

interface BuildGameActionsInput {
  manager: StudioManager;
  runWhenHydrated: (action: () => void, options?: { allowWhenBankrupt?: boolean }) => void;
  saveAndTick: (message?: string) => void;
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
          `Turn advanced ${advanced} week${advanced === 1 ? '' : 's'}.${paused ? ' Paused by a blocking crisis.' : ''}`
        );
      });
    },
    advanceToNextDecision: () => {
      runWhenHydrated(() => {
        const result = manager.advanceUntilDecision();
        saveAndTick(result.message);
      });
    },
    setTurnLength: (weeks: 1 | 2) => {
      runWhenHydrated(() => {
        const result = manager.setTurnLengthWeeks(weeks);
        saveAndTick(result.message);
      });
    },
    resolveCrisis: (crisisId: string, optionId: string) => {
      runWhenHydrated(() => {
        manager.resolveCrisis(crisisId, optionId);
        saveAndTick('Crisis resolved.');
      });
    },
    resolveDecision: (decisionId: string, optionId: string) => {
      runWhenHydrated(() => {
        manager.resolveDecision(decisionId, optionId);
        saveAndTick('Decision committed.');
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
        const result = manager.setStudioName(name);
        saveAndTick(result.message);
      });
    },
    attachTalent: (projectId: string, talentId: string) => {
      runWhenHydrated(() => {
        const result = manager.negotiateAndAttachTalent(projectId, talentId);
        saveAndTick(result.message);
      });
    },
    startNegotiation: (projectId: string, talentId: string) => {
      runWhenHydrated(() => {
        const result = manager.startTalentNegotiation(projectId, talentId);
        saveAndTick(result.message);
      });
    },
    adjustNegotiation: (projectId: string, talentId: string, action) => {
      runWhenHydrated(() => {
        const result = manager.adjustTalentNegotiation(projectId, talentId, action);
        saveAndTick(result.message);
      });
    },
    advancePhase: (projectId: string) => {
      runWhenHydrated(() => {
        const result = manager.advanceProjectPhase(projectId);
        saveAndTick(result.message);
      });
    },
    setReleaseWeek: (projectId: string, releaseWeek: number) => {
      runWhenHydrated(() => {
        const result = manager.setProjectReleaseWeek(projectId, releaseWeek);
        saveAndTick(result.message);
      });
    },
    acceptOffer: (projectId: string, offerId: string) => {
      runWhenHydrated(() => {
        const result = manager.acceptDistributionOffer(projectId, offerId);
        saveAndTick(result.message);
      });
    },
    counterOffer: (projectId: string, offerId: string) => {
      runWhenHydrated(() => {
        const result = manager.counterDistributionOffer(projectId, offerId);
        saveAndTick(result.message);
      });
    },
    walkAwayOffer: (projectId: string) => {
      runWhenHydrated(() => {
        const result = manager.walkAwayDistribution(projectId);
        saveAndTick(result.message);
      });
    },
    dismissReleaseReveal: (projectId: string) => {
      runWhenHydrated(() => {
        manager.dismissReleaseReveal(projectId);
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
        const result = manager.setFranchiseStrategy(projectId, strategy);
        saveAndTick(result.message);
      });
    },
    runFranchiseBrandReset: (projectId: string) => {
      runWhenHydrated(() => {
        const result = manager.runFranchiseBrandReset(projectId);
        saveAndTick(result.message);
      });
    },
    runFranchiseLegacyCastingCampaign: (projectId: string) => {
      runWhenHydrated(() => {
        const result = manager.runFranchiseLegacyCastingCampaign(projectId);
        saveAndTick(result.message);
      });
    },
    runFranchiseHiatusPlanning: (projectId: string) => {
      runWhenHydrated(() => {
        const result = manager.runFranchiseHiatusPlanning(projectId);
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
        const result = manager.upgradeMarketingTeam();
        saveAndTick(result.message);
      });
    },
    upgradeStudioCapacity: () => {
      runWhenHydrated(() => {
        const result = manager.upgradeStudioCapacity();
        saveAndTick(result.message);
      });
    },
    acquireIpRights: (ipId: string) => {
      runWhenHydrated(() => {
        const result = manager.acquireIpRights(ipId);
        saveAndTick(result.message);
      });
    },
    developFromIp: (ipId: string) => {
      runWhenHydrated(() => {
        const result = manager.developProjectFromIp(ipId);
        saveAndTick(result.message);
      });
    },
    setStudioSpecialization: (focus) => {
      runWhenHydrated(() => {
        const result = manager.setStudioSpecialization(focus);
        saveAndTick(result.message);
      });
    },
    investDepartment: (track) => {
      runWhenHydrated(() => {
        const result = manager.investDepartment(track);
        saveAndTick(result.message);
      });
    },
    signExclusivePartner: (partner: string) => {
      runWhenHydrated(() => {
        const result = manager.signExclusiveDistributionPartner(partner);
        saveAndTick(result.message);
      });
    },
    poachExecutiveTeam: () => {
      runWhenHydrated(() => {
        const result = manager.poachExecutiveTeam();
        saveAndTick(result.message);
      });
    },
  };
}
