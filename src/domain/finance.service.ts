import { BANKRUPTCY_RULES } from './balance-constants';

export interface FinanceManagerAdapter {
    cash: number;
    lifetimeRevenue: number;
    lifetimeExpenses: number;
    lifetimeProfit: number;
    isBankrupt: boolean;
    bankruptcyReason: string | null;
    currentWeek: number;
}

export function adjustCashForManager(manager: FinanceManagerAdapter, delta: number): void {
    if (!Number.isFinite(delta) || delta === 0) return;

    if (delta > 0) manager.lifetimeRevenue += Math.round(delta);
    if (delta < 0) manager.lifetimeExpenses += Math.round(Math.abs(delta));

    manager.lifetimeProfit = manager.lifetimeRevenue - manager.lifetimeExpenses;
    manager.cash = Math.round(manager.cash + delta);

    if (manager.isBankrupt) {
        manager.cash = Math.max(BANKRUPTCY_RULES.GAME_OVER_CASH_THRESHOLD, manager.cash);
    }
}

export function evaluateBankruptcyForManager(manager: FinanceManagerAdapter, events?: string[]): void {
    if (manager.isBankrupt) return;
    if (manager.cash > BANKRUPTCY_RULES.GAME_OVER_CASH_THRESHOLD) return;

    manager.isBankrupt = true;
    const roundedCash = Math.round(manager.cash);
    manager.cash = Math.max(BANKRUPTCY_RULES.GAME_OVER_CASH_THRESHOLD, roundedCash);
    manager.bankruptcyReason = `Bankruptcy declared at week ${manager.currentWeek} with cash $${roundedCash.toLocaleString()}.`;

    if (events) {
        events.push('Bankruptcy declared. The studio has run out of operating cash.');
    }
}
