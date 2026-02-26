import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { StudioManager } from '@/src/domain/studio-manager';
import { loadManagerFromStorage, saveManagerToStorage } from '@/src/state/persistence';
import { buildGameActions } from '@/src/state/game-actions';
import type { GameContextValue } from '@/src/state/game-types';

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
      ...buildGameActions({ manager, runWhenHydrated, saveAndTick }),
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
