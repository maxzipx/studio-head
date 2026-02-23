import React, { createContext, useContext, useMemo, useRef, useState } from 'react';

import { StudioManager } from '@/src/domain/studio-manager';

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
  attachTalent: (projectId: string, talentId: string) => void;
  advancePhase: (projectId: string) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const managerRef = useRef<StudioManager | null>(null);
  const [tick, setTick] = useState(0);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  if (!managerRef.current) {
    managerRef.current = new StudioManager();
  }
  const manager = managerRef.current;

  const value = useMemo(
    () => ({
      manager,
      tick,
      lastMessage,
      endWeek: () => {
        manager.endWeek();
        setLastMessage('Week advanced.');
        setTick((value) => value + 1);
      },
      resolveCrisis: (crisisId: string, optionId: string) => {
        manager.resolveCrisis(crisisId, optionId);
        setLastMessage('Crisis resolved.');
        setTick((value) => value + 1);
      },
      resolveDecision: (decisionId: string, optionId: string) => {
        manager.resolveDecision(decisionId, optionId);
        setLastMessage('Decision committed.');
        setTick((value) => value + 1);
      },
      runOptionalAction: () => {
        manager.runOptionalAction();
        setLastMessage('Optional action executed.');
        setTick((value) => value + 1);
      },
      acquireScript: (scriptId: string) => {
        const result = manager.acquireScript(scriptId);
        setLastMessage(result.message);
        setTick((value) => value + 1);
      },
      passScript: (scriptId: string) => {
        manager.passScript(scriptId);
        setLastMessage('Script passed.');
        setTick((value) => value + 1);
      },
      attachTalent: (projectId: string, talentId: string) => {
        const result = manager.negotiateAndAttachTalent(projectId, talentId);
        setLastMessage(result.message);
        setTick((value) => value + 1);
      },
      advancePhase: (projectId: string) => {
        const result = manager.advanceProjectPhase(projectId);
        setLastMessage(result.message);
        setTick((value) => value + 1);
      },
    }),
    [lastMessage, manager, tick]
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
