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
});
