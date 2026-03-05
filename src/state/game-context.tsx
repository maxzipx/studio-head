import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useStore } from 'zustand';

import { createGameStore, type GameState } from '@/src/state/game-store';
import type { GameContextValue } from '@/src/state/game-types';

type GameStore = ReturnType<typeof createGameStore>;

const GameContext = createContext<GameStore | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<GameStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = createGameStore();
  }

  useEffect(() => {
    // Only init once on mount
    if (storeRef.current) {
      void storeRef.current.getState()._init();
    }
  }, []);

  return <GameContext.Provider value={storeRef.current}>{children}</GameContext.Provider>;
}

// Global selector wrapper
export function useGameStore<T>(selector: (state: GameState) => T): T {
  const store = useContext(GameContext);
  if (!store) {
    throw new Error('useGameStore must be used within GameProvider');
  }
  // We use the useStore hook from zustand which handles the subscription to the passed store
  return useStore(store, selector);
}

/**
 * @deprecated Use `useGameStore(useShallow(selector))` with a screen-level
 * selector from `view-selectors.ts` instead. This hook spreads the entire
 * store and causes re-renders on every state change regardless of which slice
 * the caller uses. It is kept only for backwards compatibility during the
 * migration and will be removed once all call sites are updated.
 *
 * @example
 * // Before (bad — re-renders on every tick)
 * const { manager, endWeek } = useGame();
 *
 * // After (good — only re-renders when the selected slice changes)
 * import { selectHQView } from '@/src/state/view-selectors';
 * import { useShallow } from 'zustand/react/shallow';
 * const { manager, endWeek } = useGameStore(useShallow(selectHQView));
 */
export function useGame(): GameContextValue {
  return useGameStore((state) => ({
    manager: state.manager,
    tick: state.tick,
    lastMessage: state.lastMessage,
    ...Object.fromEntries(
      Object.entries(state).filter(([key]) => !key.startsWith('_') && key !== 'manager' && key !== 'tick' && key !== 'lastMessage' && key !== 'isHydrated' && key !== 'hasSaveFailure')
    ) as Omit<GameState, 'manager' | 'tick' | 'lastMessage' | 'isHydrated' | 'hasSaveFailure' | '_init' | '_saveAndTick' | '_runWhenHydrated'>
  })) as unknown as GameContextValue; // Cast is fine since GameContextValue matches the spread game state
}
