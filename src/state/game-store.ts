import { createStore } from 'zustand';
import { StudioManager } from '../domain/studio-manager';
import {
    loadManagerFromStorage,
    saveSerializedManagerToStorage,
    serializeStudioManager
} from './persistence';
import { buildGameActions } from './game-actions';
import type { GameActions } from './game-types';

export interface GameState extends GameActions {
    manager: StudioManager;
    tick: number;
    lastMessage: string | null;
    isHydrated: boolean;
    hasSaveFailure: boolean;

    // Internal actions used by the store itself or directly by GameContext (legacy)
    _init: () => Promise<void>;
    _saveAndTick: (message?: string) => void;
    _runWhenHydrated: (action: () => void, options?: { allowWhenBankrupt?: boolean }) => void;
}

const AUTOSAVE_WARNING = 'Autosave failed: local storage is full. Gameplay continues, but progress may not persist.';

export const createGameStore = () => {
    return createStore<GameState>()((set, get) => {
        const freshTalentSeed = Math.floor(Math.random() * 2_147_483_647);
        const manager = new StudioManager({
            talentSeed: freshTalentSeed,
            startWithSeedProjects: false,
            includeOpeningDecisions: false,
        });
        let queuedSnapshot: ReturnType<typeof serializeStudioManager> | null = null;
        let queuedSaveId = 0;
        let saveWorkerRunning = false;

        const drainSaveQueue = () => {
            if (saveWorkerRunning) return;
            saveWorkerRunning = true;

            void (async () => {
                while (queuedSnapshot) {
                    const snapshot = queuedSnapshot;
                    const snapshotId = queuedSaveId;
                    queuedSnapshot = null;
                    try {
                        await saveSerializedManagerToStorage(snapshot);
                        if (snapshotId === queuedSaveId) {
                            set({ hasSaveFailure: false });
                        }
                    } catch {
                        if (snapshotId === queuedSaveId) {
                            set({ hasSaveFailure: true, lastMessage: AUTOSAVE_WARNING });
                        }
                    }
                }
                saveWorkerRunning = false;
                // If a new snapshot arrived between loop exit and flag reset, restart worker.
                if (queuedSnapshot) {
                    drainSaveQueue();
                }
            })();
        };

        const _saveAndTick = (message?: string, options?: { clearMessage?: boolean }) => {
            const state = get();
            const currentManager = state.manager;
            const bankruptcySuffix = currentManager.isBankrupt
                ? ` Game over: ${currentManager.bankruptcyReason ?? 'Studio is bankrupt.'}`
                : '';

            let nextMessage = options?.clearMessage ? null : state.lastMessage;

            if (message) {
                nextMessage = state.hasSaveFailure
                    ? `${message}${bankruptcySuffix} ${AUTOSAVE_WARNING}`
                    : `${message}${bankruptcySuffix}`;
            } else if (bankruptcySuffix) {
                nextMessage = bankruptcySuffix.trim();
            }

            set({ tick: state.tick + 1, lastMessage: nextMessage });

            queuedSnapshot = serializeStudioManager(currentManager);
            queuedSaveId += 1;
            drainSaveQueue();
        };

        const _runWhenHydrated = (action: () => void, options?: { allowWhenBankrupt?: boolean }) => {
            const state = get();
            if (!state.isHydrated) {
                set({ lastMessage: 'Loading saved game... controls unlock in a moment.' });
                return;
            }
            if (state.manager.isBankrupt && !options?.allowWhenBankrupt) {
                set({ lastMessage: `Game over: ${state.manager.bankruptcyReason ?? 'Studio is bankrupt.'}` });
                return;
            }
            action();
        };

        const _init = async () => {
            try {
                const loaded = await loadManagerFromStorage();
                if (loaded) {
                    // Keep a stable manager instance because actions are bound to it.
                    // Hydrate by copying loaded state into the existing manager.
                    Object.assign(manager, loaded);
                    set({ isHydrated: true, tick: get().tick + 1 });
                } else {
                    set({ isHydrated: true, tick: get().tick + 1 });
                }
            } catch {
                set({
                    isHydrated: true,
                    lastMessage: 'Save load failed. Started a fresh session for now.'
                });
            }
        };

        // Initialize the actions using the helper
        // We bind it dynamically so it always uses the latest run/save helpers
        // Note: buildGameActions expects functions that it can call.
        const actions = buildGameActions({
            manager,
            runWhenHydrated: _runWhenHydrated,
            saveAndTick: _saveAndTick
        });

        return {
            manager,
            tick: 0,
            lastMessage: null,
            isHydrated: false,
            hasSaveFailure: false,
            _init,
            _saveAndTick,
            _runWhenHydrated,
            ...actions,
        };
    });
};
