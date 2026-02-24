import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { StudioManager } from '@/src/domain/studio-manager';
import { loadManagerFromStorage, saveManagerToStorage } from '@/src/state/persistence';

interface GameContextValue {
  manager: StudioManager;
  tick: number;
  lastMessage: string | null;
  endWeek: () => void;
  setTurnLength: (weeks: 1 | 2) => void;
  resolveCrisis: (crisisId: string, optionId: string) => void;
  resolveDecision: (decisionId: string, optionId: string) => void;
  runOptionalAction: () => void;
  acquireScript: (scriptId: string) => void;
  passScript: (scriptId: string) => void;
  renameStudio: (name: string) => void;
  attachTalent: (projectId: string, talentId: string) => void;
  startNegotiation: (projectId: string, talentId: string) => void;
  adjustNegotiation: (
    projectId: string,
    talentId: string,
    action: 'sweetenSalary' | 'sweetenBackend' | 'sweetenPerks' | 'holdFirm'
  ) => void;
  advancePhase: (projectId: string) => void;
  setReleaseWeek: (projectId: string, releaseWeek: number) => void;
  acceptOffer: (projectId: string, offerId: string) => void;
  counterOffer: (projectId: string, offerId: string) => void;
  walkAwayOffer: (projectId: string) => void;
  dismissReleaseReveal: (projectId: string) => void;
  runMarketingPush: (projectId: string) => void;
  runScriptSprint: (projectId: string) => void;
  runPostPolishPass: (projectId: string) => void;
  abandonProject: (projectId: string) => void;
}

const GameContext = createContext<GameContextValue | null>(null);
const AUTOSAVE_WARNING = 'Autosave failed: local storage is full. Gameplay continues, but progress may not persist.';

export function GameProvider({ children }: { children: React.ReactNode }) {
  const managerRef = useRef<StudioManager | null>(null);
  const hasSaveFailureRef = useRef(false);
  const [tick, setTick] = useState(0);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  if (!managerRef.current) {
    managerRef.current = new StudioManager();
    void loadManagerFromStorage().then((loaded) => {
      if (loaded) {
        managerRef.current = loaded;
      }
      setIsHydrated(true);
      setTick((value) => value + 1);
    }).catch(() => {
      setIsHydrated(true);
      setLastMessage('Save load failed. Started a fresh session for now.');
    });
  }
  const manager = managerRef.current;

  const saveAndTick = useCallback(
    (message?: string) => {
      const bankruptcySuffix = manager.isBankrupt
        ? ` Game over: ${manager.bankruptcyReason ?? 'Studio is bankrupt.'}`
        : '';
      if (message) {
        const nextMessage = hasSaveFailureRef.current
          ? `${message}${bankruptcySuffix} ${AUTOSAVE_WARNING}`
          : `${message}${bankruptcySuffix}`;
        setLastMessage(nextMessage);
      } else if (bankruptcySuffix) {
        setLastMessage(bankruptcySuffix.trim());
      }
      void saveManagerToStorage(manager)
        .then(() => {
          hasSaveFailureRef.current = false;
        })
        .catch(() => {
          hasSaveFailureRef.current = true;
          setLastMessage(AUTOSAVE_WARNING);
        });
      setTick((value) => value + 1);
    },
    [manager]
  );

  const runWhenHydrated = useCallback(
    (action: () => void, options?: { allowWhenBankrupt?: boolean }) => {
      if (!isHydrated) {
        setLastMessage('Loading saved game... controls unlock in a moment.');
        return;
      }
      if (manager.isBankrupt && !options?.allowWhenBankrupt) {
        setLastMessage(`Game over: ${manager.bankruptcyReason ?? 'Studio is bankrupt.'}`);
        return;
      }
      action();
    },
    [isHydrated, manager.bankruptcyReason, manager.isBankrupt]
  );

  const value = useMemo(
    () => ({
      manager,
      tick,
      lastMessage,
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
      adjustNegotiation: (
        projectId: string,
        talentId: string,
        action: 'sweetenSalary' | 'sweetenBackend' | 'sweetenPerks' | 'holdFirm'
      ) => {
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
    }),
    [lastMessage, manager, runWhenHydrated, saveAndTick, tick]
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within GameProvider');
  }
  return context;
}
