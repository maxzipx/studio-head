import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { StudioManager } from '@/src/domain/studio-manager';
import { loadManagerFromStorage, saveManagerToStorage } from '@/src/state/persistence';

interface GameContextValue {
  manager: StudioManager;
  tick: number;
  lastMessage: string | null;
  endWeek: () => void;
  resolveCrisis: (crisisId: string, optionId: string) => void;
  resolveDecision: (decisionId: string, optionId: string) => void;
  runOptionalAction: () => void;
  acquireScript: (scriptId: string) => void;
  passScript: (scriptId: string) => void;
  renameStudio: (name: string) => void;
  attachTalent: (projectId: string, talentId: string) => void;
  startNegotiation: (projectId: string, talentId: string) => void;
  advancePhase: (projectId: string) => void;
  setReleaseWeek: (projectId: string, releaseWeek: number) => void;
  acceptOffer: (projectId: string, offerId: string) => void;
  counterOffer: (projectId: string, offerId: string) => void;
  walkAwayOffer: (projectId: string) => void;
  dismissReleaseReveal: (projectId: string) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const managerRef = useRef<StudioManager | null>(null);
  const hasSaveFailureRef = useRef(false);
  const [tick, setTick] = useState(0);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  if (!managerRef.current) {
    managerRef.current = new StudioManager();
    void loadManagerFromStorage().then((loaded) => {
      if (!loaded) return;
      managerRef.current = loaded;
      setTick((value) => value + 1);
    });
  }
  const manager = managerRef.current;

  const saveAndTick = useCallback(
    (message?: string) => {
      if (message) setLastMessage(message);
      void saveManagerToStorage(manager)
        .then(() => {
          hasSaveFailureRef.current = false;
        })
        .catch(() => {
          if (hasSaveFailureRef.current) return;
          hasSaveFailureRef.current = true;
          setLastMessage('Autosave failed: local storage is full. Gameplay continues, but progress may not persist.');
        });
      setTick((value) => value + 1);
    },
    [manager]
  );

  const value = useMemo(
    () => ({
      manager,
      tick,
      lastMessage,
      endWeek: () => {
        manager.endWeek();
        saveAndTick('Week advanced.');
      },
      resolveCrisis: (crisisId: string, optionId: string) => {
        manager.resolveCrisis(crisisId, optionId);
        saveAndTick('Crisis resolved.');
      },
      resolveDecision: (decisionId: string, optionId: string) => {
        manager.resolveDecision(decisionId, optionId);
        saveAndTick('Decision committed.');
      },
      runOptionalAction: () => {
        manager.runOptionalAction();
        saveAndTick('Optional action executed.');
      },
      acquireScript: (scriptId: string) => {
        const result = manager.acquireScript(scriptId);
        saveAndTick(result.message);
      },
      passScript: (scriptId: string) => {
        manager.passScript(scriptId);
        saveAndTick('Script passed.');
      },
      renameStudio: (name: string) => {
        const result = manager.setStudioName(name);
        saveAndTick(result.message);
      },
      attachTalent: (projectId: string, talentId: string) => {
        const result = manager.negotiateAndAttachTalent(projectId, talentId);
        saveAndTick(result.message);
      },
      startNegotiation: (projectId: string, talentId: string) => {
        const result = manager.startTalentNegotiation(projectId, talentId);
        saveAndTick(result.message);
      },
      advancePhase: (projectId: string) => {
        const result = manager.advanceProjectPhase(projectId);
        saveAndTick(result.message);
      },
      setReleaseWeek: (projectId: string, releaseWeek: number) => {
        const result = manager.setProjectReleaseWeek(projectId, releaseWeek);
        saveAndTick(result.message);
      },
      acceptOffer: (projectId: string, offerId: string) => {
        const result = manager.acceptDistributionOffer(projectId, offerId);
        saveAndTick(result.message);
      },
      counterOffer: (projectId: string, offerId: string) => {
        const result = manager.counterDistributionOffer(projectId, offerId);
        saveAndTick(result.message);
      },
      walkAwayOffer: (projectId: string) => {
        const result = manager.walkAwayDistribution(projectId);
        saveAndTick(result.message);
      },
      dismissReleaseReveal: (projectId: string) => {
        manager.dismissReleaseReveal(projectId);
        saveAndTick();
      },
    }),
    [lastMessage, manager, saveAndTick, tick]
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
