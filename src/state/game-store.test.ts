import { describe, expect, it, vi } from 'vitest';
import { createGameStore } from './game-store';

const { setItemMock, getItemMock } = vi.hoisted(() => ({
  setItemMock: vi.fn(),
  getItemMock: vi.fn(async () => null),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: getItemMock,
    setItem: setItemMock,
  },
}));

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('game store autosave queue', () => {
  it('starts new sessions with an empty slate while keeping script market offers', () => {
    const store = createGameStore();
    const manager = store.getState().manager;

    expect(manager.activeProjects.length).toBe(0);
    expect(manager.scriptMarket.length).toBeGreaterThan(0);
  });

  it('coalesces rapid saves and persists the latest snapshot', async () => {
    const resolvers: (() => void)[] = [];
    const payloads: string[] = [];
    setItemMock.mockImplementation((_key: string, value: string) => {
      payloads.push(value);
      return new Promise<void>((resolve) => {
        resolvers.push(resolve);
      });
    });

    const store = createGameStore();
    const state = store.getState();

    state.manager.cash = 100;
    state._saveAndTick('first');
    state.manager.cash = 200;
    state._saveAndTick('second');
    state.manager.cash = 300;
    state._saveAndTick('third');

    expect(payloads.length).toBe(1);

    resolvers.shift()?.();
    await flushPromises();

    expect(payloads.length).toBe(2);
    const latestEnvelope = JSON.parse(payloads[1] ?? '{}') as { manager?: { cash?: number } };
    expect(latestEnvelope.manager?.cash).toBe(300);

    resolvers.shift()?.();
    await flushPromises();
  });

  it('persists tutorial dismiss and replay actions through saveAndTick', async () => {
    setItemMock.mockResolvedValue(undefined);

    const store = createGameStore();
    store.setState({ isHydrated: true });
    const state = store.getState();

    state.completeFoundingSetup('balanced', 'dataDriven');
    await flushPromises();
    expect(store.getState().manager.tutorialState).toBe('hqIntro');

    state.dismissTutorial();
    await flushPromises();
    expect(store.getState().manager.tutorialDismissed).toBe(true);
    expect(store.getState().manager.tutorialState).toBe('complete');

    state.restartTutorial();
    await flushPromises();

    const latestSave = JSON.parse(setItemMock.mock.calls.at(-1)?.[1] ?? '{}') as {
      manager?: { tutorialState?: string; tutorialCompleted?: boolean; tutorialDismissed?: boolean };
    };

    expect(store.getState().manager.tutorialState).toBe('hqIntro');
    expect(store.getState().manager.tutorialCompleted).toBe(false);
    expect(store.getState().manager.tutorialDismissed).toBe(false);
    expect(latestSave.manager?.tutorialState).toBe('hqIntro');
    expect(latestSave.manager?.tutorialCompleted).toBe(false);
    expect(latestSave.manager?.tutorialDismissed).toBe(false);
  });
});
