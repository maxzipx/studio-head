import { describe, expect, it } from 'vitest';

import { StudioManager } from './studio-manager';
import type { DecisionOption, MovieProject, Talent } from './types';

function seededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function chooseDecisionOption(options: DecisionOption[], cash: number): DecisionOption {
  const scored = options.map((option) => {
    const cashWeight = cash < 4_000_000 ? 2.8 : cash < 10_000_000 ? 1.6 : 0.55;
    const projectedCash = cash + option.cashDelta;
    const survivalPenalty = projectedCash < 1_000_000 ? 12 : projectedCash < 3_000_000 ? 5.5 : 0;
    const score =
      (option.cashDelta / 160_000) * cashWeight +
      option.hypeDelta * 0.6 +
      option.scriptQualityDelta * 0.95 +
      (option.studioHeatDelta ?? 0) * 0.5 +
      (option.criticsDelta ?? 0) * 0.55 +
      (option.talentRepDelta ?? 0) * 0.35 +
      (option.distributorRepDelta ?? 0) * 0.3 +
      (option.audienceDelta ?? 0) * 0.35 +
      ((option.marketingDelta ?? 0) / 220_000) * 0.45 -
      (option.overrunRiskDelta ?? 0) * 3.4 -
      survivalPenalty;
    return { option, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.option ?? options[0];
}

function resolveCrises(manager: StudioManager): void {
  for (const crisis of [...manager.pendingCrises]) {
    const chosen =
      manager.cash < 2_000_000
        ? [...crisis.options].sort((a, b) => b.cashDelta - a.cashDelta)[0]
        : [...crisis.options].sort((a, b) => b.hypeDelta * 0.6 + b.cashDelta / 150_000 - (b.scheduleDelta ?? 0) * 0.2 - (a.hypeDelta * 0.6 + a.cashDelta / 150_000 - (a.scheduleDelta ?? 0) * 0.2))[0];
    if (!chosen) continue;
    manager.resolveCrisis(crisis.id, chosen.id);
  }
}

function resolveDecisions(manager: StudioManager): void {
  for (const decision of [...manager.decisionQueue]) {
    const chosen = chooseDecisionOption(decision.options, manager.cash);
    manager.resolveDecision(decision.id, chosen.id);
  }
}

function pickTalent(manager: StudioManager, role: Talent['role'], genre: MovieProject['genre']): Talent | null {
  const available = manager.talentPool.filter((item) => item.role === role && item.availability === 'available');
  if (available.length === 0) return null;
  const sorted = [...available].sort((a, b) => {
    const aFit = a.genreFit[genre] ?? 0.5;
    const bFit = b.genreFit[genre] ?? 0.5;
    const aValue = aFit * 1.8 + a.craftScore * 0.42 + a.starPower * 0.22 - a.salary.base / 1_100_000;
    const bValue = bFit * 1.8 + b.craftScore * 0.42 + b.starPower * 0.22 - b.salary.base / 1_100_000;
    return bValue - aValue;
  });
  return sorted[0] ?? null;
}

function operateProjects(manager: StudioManager): void {
  for (const negotiation of [...manager.playerNegotiations]) {
    const snapshot = manager.getNegotiationSnapshot(negotiation.projectId, negotiation.talentId);
    if (!snapshot || snapshot.rounds >= 2) continue;
    const action =
      snapshot.pressurePoint === 'salary'
        ? 'sweetenSalary'
        : snapshot.pressurePoint === 'backend'
          ? 'sweetenBackend'
          : 'sweetenPerks';
    manager.adjustTalentNegotiation(negotiation.projectId, negotiation.talentId, action);
  }

  for (const project of [...manager.activeProjects]) {
    if (project.phase === 'released') continue;

    if (project.phase === 'development') {
      const projection = manager.getProjectedForProject(project.id);
      const poorOutlook = projection ? projection.roi < 0.88 && project.scriptQuality < 6.8 : false;
      if (poorOutlook && manager.cash < 6_000_000) {
        manager.abandonProject(project.id);
        continue;
      }

      if (project.scriptQuality < 7.1 && manager.cash > 9_000_000) {
        manager.runScriptDevelopmentSprint(project.id);
      }

      if (!project.directorId) {
        const director = pickTalent(manager, 'director', project.genre);
        if (director) {
          manager.negotiateAndAttachTalent(project.id, director.id);
        }
      }
      if (project.castIds.length < 1) {
        const lead = pickTalent(manager, 'leadActor', project.genre);
        if (lead) {
          manager.negotiateAndAttachTalent(project.id, lead.id);
        }
      }
      if (
        !project.greenlightApproved &&
        project.directorId &&
        project.castIds.length > 0 &&
        project.scriptQuality >= 6 &&
        manager.cash > 1_000_000
      ) {
        manager.runGreenlightReview(project.id, true);
      }
      manager.advanceProjectPhase(project.id);
      continue;
    }

    if (project.phase === 'postProduction') {
      if (project.editorialScore < 7.5 && manager.cash > 10_000_000) {
        manager.runPostProductionPolishPass(project.id);
      }
      if (project.marketingBudget <= 0 && manager.cash > 1_500_000) {
        manager.runMarketingPushOnProject(project.id);
      }
      if (
        (project.festivalStatus === 'none' || project.festivalStatus === 'snubbed') &&
        manager.cash > 12_000_000 &&
        project.prestige >= 64
      ) {
        manager.runFestivalSubmission(project.id);
      }
      manager.advanceProjectPhase(project.id);
      continue;
    }

    if (project.phase === 'distribution') {
      if (!project.releaseWeek) {
        manager.setProjectReleaseWeek(project.id, manager.currentWeek + 1);
      }
      const offers = manager.getOffersForProject(project.id);
      if (!project.releaseWindow && offers.length > 0) {
        const bestOffer = [...offers].sort(
          (a, b) =>
            b.minimumGuarantee * 0.0000014 +
            b.revenueShareToStudio * 95 +
            b.pAndACommitment * 0.0000002 -
            (a.minimumGuarantee * 0.0000014 + a.revenueShareToStudio * 95 + a.pAndACommitment * 0.0000002)
        )[0];
        manager.acceptDistributionOffer(project.id, bestOffer.id);
      }
      if (project.releaseWeek && manager.currentWeek >= project.releaseWeek) {
        manager.advanceProjectPhase(project.id);
      }
      continue;
    }

    manager.advanceProjectPhase(project.id);
  }
}

function investInPipeline(manager: StudioManager): void {
  const activeNonReleased = manager.activeProjects.filter((project) => project.phase !== 'released');
  const availableDirectors = manager.talentPool.filter((talent) => talent.role === 'director' && talent.availability === 'available');
  const availableLeads = manager.talentPool.filter((talent) => talent.role === 'leadActor' && talent.availability === 'available');
  const staffingConstrained = availableDirectors.length === 0 || availableLeads.length === 0;
  const maxPipeline = manager.cash >= 12_000_000 ? 2 : 1;
  if (activeNonReleased.length >= maxPipeline) return;
  if (staffingConstrained && activeNonReleased.some((project) => project.phase === 'development')) return;

  const rankedScripts = manager.scriptMarket
    .map((script) => ({ script, eval: manager.evaluateScriptPitch(script.id) }))
    .filter((row): row is { script: (typeof manager.scriptMarket)[number]; eval: NonNullable<ReturnType<typeof manager.evaluateScriptPitch>> } => !!row.eval)
    .sort((a, b) => b.eval.score - a.eval.score);
  const pick = rankedScripts[0];
  if (!pick) return;
  const affordability = pick.script.askingPrice / Math.max(1, manager.cash);
  if (pick.eval.score < 66) return;
  if (pick.eval.expectedROI < 1.18) return;
  if (affordability > 0.05) return;
  if (manager.cash < pick.script.askingPrice + 10_000_000) return;
  manager.acquireScript(pick.script.id);
}

type RunMetrics = {
  bankrupt: boolean;
  finalCash: number;
  finalHeat: number;
  releasedFilms: number;
  awardsNominations: number;
  awardsWins: number;
  avgPendingCrises: number;
  maxPendingCrises: number;
};

function simulateTenYears(seed: number): RunMetrics {
  const rng = seededRng(seed);
  const manager = new StudioManager({
    crisisRng: rng,
    eventRng: rng,
    negotiationRng: rng,
    rivalRng: rng,
  });
  manager.setTurnLengthWeeks(1);

  const totalTurns = 520;
  let pendingCrisesTotal = 0;
  let maxPendingCrises = 0;
  let turnsExecuted = 0;

  for (let turn = 0; turn < totalTurns; turn += 1) {
    if (manager.isBankrupt) break;
    resolveCrises(manager);
    resolveDecisions(manager);
    operateProjects(manager);
    investInPipeline(manager);
    if (manager.cash > 35_000_000 && turn % 16 === 0) manager.runOptionalAction();
    const summary = manager.endTurn();
    turnsExecuted += 1;
    pendingCrisesTotal += manager.pendingCrises.length;
    maxPendingCrises = Math.max(maxPendingCrises, manager.pendingCrises.length);
    if (summary.hasPendingCrises) {
      resolveCrises(manager);
    }
  }

  const releasedFilms = manager.activeProjects.filter((project) => project.phase === 'released').length;
  const awardsNominations = manager.activeProjects.reduce((sum, project) => sum + project.awardsNominations, 0);
  const awardsWins = manager.activeProjects.reduce((sum, project) => sum + project.awardsWins, 0);

  return {
    bankrupt: manager.isBankrupt,
    finalCash: Math.round(manager.cash),
    finalHeat: manager.studioHeat,
    releasedFilms,
    awardsNominations,
    awardsWins,
    avgPendingCrises: pendingCrisesTotal / Math.max(1, turnsExecuted),
    maxPendingCrises,
  };
}

describe('long-run balance harness', () => {
  it('stays within expected economy and progression envelopes over 10-year Monte Carlo runs', () => {
    const runs = Array.from({ length: 24 }, (_, index) => simulateTenYears(10_000 + index * 137));
    const bankruptRate = runs.filter((run) => run.bankrupt).length / runs.length;
    const cashValues = runs.map((run) => run.finalCash);
    const heatValues = runs.map((run) => run.finalHeat);
    const releasedValues = runs.map((run) => run.releasedFilms);
    const nominations = runs.map((run) => run.awardsNominations);
    const wins = runs.map((run) => run.awardsWins);
    const avgCrisis = runs.map((run) => run.avgPendingCrises);
    const maxCrisis = runs.map((run) => run.maxPendingCrises);

    const summary = {
      bankruptRate: Number(bankruptRate.toFixed(3)),
      cashMedian: Math.round(median(cashValues)),
      cashMin: Math.min(...cashValues),
      cashMax: Math.max(...cashValues),
      heatMean: Number(mean(heatValues).toFixed(2)),
      releasedMean: Number(mean(releasedValues).toFixed(2)),
      releasedMin: Math.min(...releasedValues),
      awardsNomMean: Number(mean(nominations).toFixed(2)),
      awardsWinMean: Number(mean(wins).toFixed(2)),
      avgPendingCrisesMean: Number(mean(avgCrisis).toFixed(2)),
      maxPendingCrises: Math.max(...maxCrisis),
    };

    expect(summary).toMatchInlineSnapshot(`
      {
        "avgPendingCrisesMean": 0.58,
        "awardsNomMean": 49.75,
        "awardsWinMean": 5.88,
        "bankruptRate": 0.25,
        "cashMax": 148103738,
        "cashMedian": 46533385,
        "cashMin": 0,
        "heatMean": 97.5,
        "maxPendingCrises": 4,
        "releasedMean": 21.71,
        "releasedMin": 8,
      }
    `);

    expect(bankruptRate).toBeLessThan(0.94);
    expect(summary.cashMax).toBeLessThan(220_000_000);
    expect(summary.releasedMean).toBeGreaterThanOrEqual(10);
    expect(summary.awardsNomMean).toBeGreaterThan(10);
    expect(summary.maxPendingCrises).toBeLessThan(7);
  }, 20_000);
});
