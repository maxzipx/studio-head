import {
  ACTION_BALANCE,
  AWARDS_RULES,
  FESTIVAL_RULES,
} from '../balance-constants';
import { createId } from '../id';
import {
  awardsNominationProbability,
  awardsSeasonScore,
  awardsWinProbability,
  reputationDeltasFromRelease,
  projectedCriticalScore,
  projectedOpeningWeekendRange,
  projectedROI,
} from '../formulas';
import type { StudioManager } from '../studio-manager';
import {
  clamp,
  MILESTONE_LABELS,
  phaseBurnMultiplier,
  releaseOutcomeFromRoi,
} from '../studio-manager.constants';
import type {
  ChronicleEntry,
  MilestoneRecord,
  MovieGenre,
  MovieProject,
  ReleasePerformanceBreakdown,
  ReleaseReport,
  Talent,
} from '../types';

export class ReleaseService {
  constructor(private readonly manager: StudioManager) {}

  // --- Projections ---

  getProjectedForProject(projectId: string): {
    critical: number;
    openingLow: number;
    openingHigh: number;
    roi: number;
  } | null {
    const project = this.manager.activeProjects.find((item) => item.id === projectId);
    if (!project) return null;
    return this.buildProjection(project, project.releaseWeek ?? this.manager.currentWeek + 4);
  }

  getProjectedForProjectAtWeek(
    projectId: string,
    releaseWeek: number
  ): {
    critical: number;
    openingLow: number;
    openingHigh: number;
    roi: number;
  } | null {
    const project = this.manager.activeProjects.find((item) => item.id === projectId);
    if (!project) return null;
    const clampedWeek = clamp(Math.round(releaseWeek), this.manager.currentWeek + 1, this.manager.currentWeek + 52);
    return this.buildProjection(project, clampedWeek);
  }

  buildProjection(
    project: MovieProject,
    releaseWeek: number
  ): {
    critical: number;
    openingLow: number;
    openingHigh: number;
    roi: number;
  } {
    const director = this.manager.talentPool.find((item) => item.id === project.directorId);
    const lead = this.manager.talentPool
      .filter((item) => project.castIds.includes(item.id) && (item.role === 'leadActor' || item.role === 'leadActress'))
      .sort((a, b) => b.starPower - a.starPower)[0];
    const franchiseModifiers = this.manager.getFranchiseProjectionModifiersForRelease(project, releaseWeek);
    const baseCritical = projectedCriticalScore({
      scriptQuality: project.scriptQuality,
      directorCraft: director?.craftScore ?? 6,
      leadActorCraft: lead?.craftScore ?? 6,
      productionSpend: project.budget.actualSpend,
      conceptStrength: project.conceptStrength,
      editorialCutChoice: project.editorialScore,
      crisisPenalty: project.productionStatus === 'inCrisis' ? 8 : 0,
      chemistryPenalty: 0,
    });
    const critical = clamp(baseCritical + franchiseModifiers.criticalDelta + this.manager.specializationProfile.criticalDelta, 0, 100);

    const opening = projectedOpeningWeekendRange({
      genre: project.genre,
      hypeScore: project.hypeScore,
      starPower: lead?.starPower ?? 5.5,
      marketingBudget: project.marketingBudget,
      totalBudget: project.budget.ceiling,
      seasonalMultiplier: this.manager.getGenreDemandMultiplier(project.genre),
    });
    const pressure = this.calendarPressureMultiplier(releaseWeek, project.genre);
    const combinedOpeningMultiplier = pressure * franchiseModifiers.openingMultiplier * this.manager.specializationProfile.openingMultiplier;
    const openingLow = opening.low * combinedOpeningMultiplier;
    const openingHigh = opening.high * combinedOpeningMultiplier;
    const openingMid = opening.midpoint * combinedOpeningMultiplier;
    const audienceProjection = clamp(critical + 4 + franchiseModifiers.audienceDelta, 0, 100);

    const roiBase = projectedROI({
      openingWeekend: openingMid,
      criticalScore: critical,
      audienceScore: audienceProjection,
      genre: project.genre,
      totalCost: project.budget.ceiling + project.marketingBudget,
    });
    const roi = clamp(roiBase * franchiseModifiers.roiMultiplier, 0.4, 4.5);

    return { critical, openingLow, openingHigh, roi };
  }

  // --- Burn ---

  estimateWeeklyBurn(): number {
    const modifiers = this.manager.getArcOutcomeModifiers();
    return this.manager.activeProjects.reduce((sum, project) => {
      if (project.phase === 'released') return sum;
      return sum + this.projectedBurnForProject(project, modifiers.burnMultiplier);
    }, 0);
  }

  projectedBurnForProject(project: MovieProject, burnMultiplier: number): number {
    const productionEfficiency = 1 - this.manager.departmentLevels.production * 0.03;
    return (
      project.budget.ceiling *
      phaseBurnMultiplier(project.phase) *
      burnMultiplier *
      this.manager.specializationProfile.burnMultiplier *
      clamp(productionEfficiency, 0.82, 1.05)
    );
  }

  applyWeeklyBurn(): number {
    const modifiers = this.manager.getArcOutcomeModifiers();
    let total = 0;
    for (const project of this.manager.activeProjects) {
      if (project.phase === 'released') continue;
      const burn = this.projectedBurnForProject(project, modifiers.burnMultiplier);
      total += burn;
      project.budget.actualSpend += burn;
      project.scheduledWeeksRemaining = Math.max(0, project.scheduledWeeksRemaining - 1);
      project.productionStatus = project.budget.actualSpend > project.budget.ceiling ? 'atRisk' : project.productionStatus === 'inCrisis' ? 'inCrisis' : 'onTrack';
    }
    this.manager.adjustCash(-total);
    return total;
  }

  applyHypeDecay(): void {
    const modifiers = this.manager.getArcOutcomeModifiers();
    const step = clamp(modifiers.hypeDecayStep, 0.8, 3.2);
    for (const project of this.manager.activeProjects) {
      project.hypeScore = clamp(project.hypeScore - step, 0, 100);
    }
  }

  projectOutcomes(): void {
    for (const project of this.manager.activeProjects) {
      const projection = this.getProjectedForProject(project.id);
      if (!projection) continue;
      project.projectedROI = projection.roi;
    }
  }

  // --- Released films tick ---

  tickReleasedFilms(events: string[]): void {
    const modifiers = this.manager.getArcOutcomeModifiers();
    for (const project of this.manager.activeProjects) {
      if (project.phase !== 'released') continue;
      if (project.releaseResolved) {
        this.tickMerchandiseRevenue(project, events);
        continue;
      }
      if (!project.finalBoxOffice || !project.openingWeekendGross) continue;

      if (project.releaseWeeksRemaining > 0) {
        const decayFactor = 0.62 + project.releaseWeeksRemaining * 0.015;
        const lastWeek =
          project.weeklyGrossHistory[project.weeklyGrossHistory.length - 1] ?? project.openingWeekendGross;
        const weekly = Math.max(250_000, lastWeek * decayFactor);
        project.weeklyGrossHistory.push(weekly);
        project.finalBoxOffice += weekly;
        this.manager.adjustCash(weekly * project.studioRevenueShare);
        project.releaseWeeksRemaining -= 1;
      }

      if (project.releaseWeeksRemaining <= 0) {
        const totalCost = project.budget.ceiling + project.marketingBudget;
        const netRevenue = project.finalBoxOffice * project.studioRevenueShare;
        project.projectedROI = netRevenue / Math.max(1, totalCost);
        const repDeltas = reputationDeltasFromRelease({
          criticalScore: project.criticalScore ?? 50,
          roi: project.projectedROI,
          awardsNominations: 0,
          awardsWins: 0,
          controversyPenalty: project.controversy ?? 0,
        });
        const criticsDelta = repDeltas.critics + modifiers.releaseHeatMomentum;
        const audienceDelta = repDeltas.audience + modifiers.releaseHeatMomentum;
        this.manager.adjustReputation(criticsDelta, 'critics');
        this.manager.adjustReputation(audienceDelta, 'audience');
        project.releaseResolved = true;
        this.settleTrackingLeverage(project, events);
        this.maybeStartMerchandiseStream(project, events);
        this.manager.markFranchiseRelease(project.id);
        this.manager.applyMajorIpReleaseProgress(project, events);
        events.push(
          `${project.title} completed theatrical run. Critics ${criticsDelta >= 0 ? '+' : ''}${criticsDelta.toFixed(0)}, Audience ${audienceDelta >= 0 ? '+' : ''}${audienceDelta.toFixed(0)}.`
        );
        const roiValue = project.projectedROI;
        const grossM = project.finalBoxOffice ? (project.finalBoxOffice / 1_000_000).toFixed(1) : '?';
        const report = this.buildReleaseReport(project);
        this.manager.releaseReports.unshift(report);
        this.manager.releaseReports = this.manager.releaseReports.slice(0, 60);
        this.manager.pendingFinalReleaseReveals.push(project.id);
        this.checkMilestones(report, events);
        this.addChronicleEntry({
          week: this.manager.currentWeek,
          type: 'filmRelease',
          headline: `${project.title} closed at $${grossM}M domestic`,
          detail: `ROI ${roiValue.toFixed(1)}x · Score ${project.criticalScore ?? '?'}`,
          projectTitle: project.title,
          impact: roiValue >= 2.0 ? 'positive' : roiValue < 1.0 ? 'negative' : 'neutral',
        });
        this.manager.checkRivalReleaseResponses(project, events);
      }
    }
  }

  // --- Release reports ---

  buildReleaseReport(project: MovieProject): ReleaseReport {
    const totalBudget = Math.round(project.budget.ceiling + project.marketingBudget);
    const totalGross = Math.round(project.finalBoxOffice ?? 0);
    const studioNet = Math.round(totalGross * project.studioRevenueShare);
    const profit = studioNet - totalBudget;
    const roi = studioNet / Math.max(1, totalBudget);
    const breakdown = this.buildReleaseBreakdown(project);
    const previousBest = this.manager.releaseReports.reduce((max, report) => Math.max(max, report.openingWeekend), 0);
    return {
      projectId: project.id,
      title: project.title,
      weekResolved: this.manager.currentWeek,
      totalBudget,
      totalGross,
      studioNet,
      profit,
      roi,
      openingWeekend: Math.round(project.openingWeekendGross ?? 0),
      critics: Math.round(project.criticalScore ?? 0),
      audience: Math.round(project.audienceScore ?? 0),
      outcome: releaseOutcomeFromRoi(roi),
      wasRecordOpening: (project.openingWeekendGross ?? 0) > previousBest,
      breakdown,
    };
  }

  private buildReleaseBreakdown(project: MovieProject): ReleasePerformanceBreakdown {
    const director = project.directorId ? this.manager.talentPool.find((talent) => talent.id === project.directorId) : null;
    const lead = project.castIds
      .map((talentId) => this.manager.talentPool.find((talent) => talent.id === talentId))
      .filter((talent): talent is Talent => !!talent && (talent.role === 'leadActor' || talent.role === 'leadActress'))
      .sort((a, b) => b.starPower - a.starPower)[0];
    const script = clamp((project.scriptQuality - 5.5) * 7, -18, 18);
    const direction = clamp(((director?.craftScore ?? 6) - 6) * 5, -14, 16);
    const starPower = clamp(((lead?.starPower ?? 5.5) - 5.5) * 6, -14, 18);
    const marketingRatio = project.marketingBudget / Math.max(1, project.budget.ceiling);
    const marketing = clamp((marketingRatio - 0.1) * 80 + project.hypeScore * 0.09, -12, 20);
    const cycle = this.manager.getGenreDemandMultiplier(project.genre);
    const timing = clamp(
      (cycle - 1) * 55 + this.calendarPressureMultiplier(project.releaseWeek ?? this.manager.currentWeek, project.genre) * 8 - 8,
      -14,
      16
    );
    const genreCycle = clamp((cycle - 1) * 100, -16, 16);
    return {
      script: Math.round(script),
      direction: Math.round(direction),
      starPower: Math.round(starPower),
      marketing: Math.round(marketing),
      timing: Math.round(timing),
      genreCycle: Math.round(genreCycle),
    };
  }

  // --- Merchandise ---

  private tickMerchandiseRevenue(project: MovieProject, events: string[]): void {
    if ((project.merchandiseWeeksRemaining ?? 0) <= 0) return;
    const weekly = Math.round(project.merchandiseWeeklyRevenue ?? 0);
    if (weekly <= 0) {
      project.merchandiseWeeksRemaining = 0;
      return;
    }
    this.manager.adjustCash(weekly);
    project.merchandiseWeeksRemaining = Math.max(0, (project.merchandiseWeeksRemaining ?? 0) - 1);
    if ((project.merchandiseWeeksRemaining ?? 0) === 0) {
      events.push(`${project.title} merchandise tail concluded.`);
    }
  }

  private maybeStartMerchandiseStream(project: MovieProject, events: string[]): void {
    const commercialGenres: MovieGenre[] = ['action', 'animation', 'sciFi', 'comedy'];
    if (!commercialGenres.includes(project.genre)) return;
    const audience = project.audienceScore ?? 50;
    if (audience < 58) return;
    const base = (project.finalBoxOffice ?? 0) * 0.022;
    const weekly = Math.round(base * (project.commercialAppeal / 100) / 6);
    if (weekly <= 0) return;
    project.merchandiseWeeklyRevenue = weekly;
    project.merchandiseWeeksRemaining = 6;
    events.push(`${project.title} opened a 6-week merchandise tail (${Math.round(weekly / 1000)}K/week).`);
  }

  // --- Tracking leverage ---

  private settleTrackingLeverage(project: MovieProject, events: string[]): void {
    const leverage = Math.round(project.trackingLeverageAmount ?? 0);
    if (leverage <= 0 || project.trackingSettled) return;
    const realized = Math.round(
      (project.openingWeekendGross ?? 0) *
      project.studioRevenueShare *
      ACTION_BALANCE.TRACKING_LEVERAGE_SHARE_CAP
    );
    const clawback = Math.max(0, leverage - realized);
    if (clawback > 0) {
      this.manager.adjustCash(-clawback);
      events.push(`${project.title} tracking leverage missed. Clawback ${Math.round(clawback / 1000)}K.`);
    } else {
      events.push(`${project.title} tracking leverage cleared with no clawback.`);
    }
    project.trackingSettled = true;
  }

  // --- Milestones ---

  getActiveMilestones(): MilestoneRecord[] {
    return [...this.manager.milestones].sort((a, b) => b.unlockedWeek - a.unlockedWeek);
  }

  getLatestReleaseReport(projectId: string): ReleaseReport | null {
    return this.manager.releaseReports.find((report) => report.projectId === projectId) ?? null;
  }

  private checkMilestones(report: ReleaseReport, events: string[]): void {
    const totalGrossAll = this.manager.releaseReports.reduce((sum, item) => sum + item.totalGross, 0);
    const has = (id: MilestoneRecord['id']) => this.manager.milestones.some((item) => item.id === id);
    const unlock = (id: MilestoneRecord['id'], value?: number): void => {
      if (has(id)) return;
      const label = MILESTONE_LABELS[id];
      this.manager.milestones.unshift({
        id,
        title: label.title,
        description: label.description,
        unlockedWeek: this.manager.currentWeek,
        value,
      });
      this.manager.milestones = this.manager.milestones.slice(0, 30);
      events.push(`Milestone unlocked: ${label.title}.`);
    };

    if (report.roi >= 1.5) unlock('firstHit', report.roi);
    if (report.roi >= 3) unlock('firstBlockbuster', report.roi);
    if (report.totalGross >= 100_000_000) unlock('boxOffice100m', report.totalGross);
    if (totalGrossAll >= 1_000_000_000) unlock('lifetimeRevenue1b', totalGrossAll);

    const bestGross = this.manager.releaseReports.reduce((max, item) => Math.max(max, item.totalGross), 0);
    const worstGross = this.manager.releaseReports.reduce((min, item) => Math.min(min, item.totalGross), Number.POSITIVE_INFINITY);
    if (report.totalGross >= bestGross) unlock('highestGrossingFilm', report.totalGross);
    if (report.totalGross <= worstGross) unlock('lowestGrossingFilm', report.totalGross);
  }

  // --- Awards ---

  processAnnualAwards(events: string[]): void {
    if (
      this.manager.currentWeek < AWARDS_RULES.AWARDS_WEEK_IN_SEASON ||
      (this.manager.currentWeek - AWARDS_RULES.AWARDS_WEEK_IN_SEASON) % AWARDS_RULES.SEASON_LENGTH_WEEKS !== 0
    ) {
      return;
    }
    const seasonYear = Math.floor((this.manager.currentWeek - 1) / AWARDS_RULES.SEASON_LENGTH_WEEKS) + 1;
    if (this.manager.awardsSeasonsProcessed.includes(seasonYear)) return;

    const eligibilityStartWeek = this.manager.currentWeek - AWARDS_RULES.ELIGIBILITY_WINDOW_WEEKS;
    const eligibleProjects = this.manager.activeProjects.filter((project) => {
      if (project.phase !== 'released' || !project.releaseResolved) return false;
      const releaseWeek = project.releaseWeek ?? 0;
      if (releaseWeek < eligibilityStartWeek || releaseWeek > this.manager.currentWeek) return false;
      return Number.isFinite(project.criticalScore ?? NaN);
    });

    if (eligibleProjects.length === 0) {
      this.manager.awardsSeasonsProcessed.push(seasonYear);
      events.push(`Awards season year ${seasonYear}: no eligible player releases this cycle.`);
      return;
    }

    const awardsArc = this.manager.storyArcs['awards-circuit'];
    const baseCampaignBoost =
      (this.manager.hasStoryFlag('awards_campaign') ? 8 : 0) +
      this.manager.specializationProfile.awardsBoost +
      this.manager.foundingProfileEffects.awardsCampaignBonus;
    const baselineFestivalBoost = this.manager.hasStoryFlag('festival_selected') ? 4 : 0;
    const arcBoost =
      awardsArc?.status === 'resolved' ? 6 : awardsArc?.status === 'failed' ? -5 : (awardsArc?.stage ?? 0) * 1.5;

    const results = eligibleProjects.map((project) => {
      const projectFestivalBoost =
        project.festivalStatus === 'buzzed'
          ? 8 + project.festivalBuzz * 0.08
          : project.festivalStatus === 'selected'
            ? 4 + project.festivalBuzz * 0.05
            : project.festivalStatus === 'snubbed'
              ? -2
              : baselineFestivalBoost;
      const score = awardsSeasonScore({
        criticalScore: project.criticalScore ?? 50,
        scriptQuality: project.scriptQuality,
        conceptStrength: project.conceptStrength,
        prestige: project.prestige,
        controversy: project.controversy,
        campaignBoost: baseCampaignBoost + arcBoost,
        festivalBoost: projectFestivalBoost,
        studioCriticsReputation: this.manager.reputation.critics,
      });
      const nominationProbability = awardsNominationProbability(score);
      const nominationRolls = clamp(1 + Math.floor(score / 28), 1, 4);
      let nominations = 0;
      for (let i = 0; i < nominationRolls; i += 1) {
        if (this.manager.rivalRng() <= nominationProbability) nominations += 1;
      }
      if (nominations === 0 && score >= 82 && this.manager.rivalRng() < 0.35) {
        nominations = 1;
      }
      let wins = 0;
      if (nominations > 0) {
        const winProbability = awardsWinProbability({
          score,
          nominations,
          controversy: project.controversy,
        });
        if (this.manager.rivalRng() <= winProbability) wins += 1;
        if (nominations >= 3 && this.manager.rivalRng() <= winProbability * 0.35) wins += 1;
      }
      project.awardsNominations += nominations;
      project.awardsWins += wins;
      return {
        projectId: project.id,
        title: project.title,
        nominations,
        wins,
        score,
      };
    });

    results.sort((a, b) => b.score - a.score);
    const totalNominations = results.reduce((sum, item) => sum + item.nominations, 0);
    const totalWins = results.reduce((sum, item) => sum + item.wins, 0);
    const winner = results.find((item) => item.wins > 0) ?? results[0];

    let criticsDelta = totalNominations * 1.1 + totalWins * 3.8;
    let talentDelta = totalNominations * 0.7 + totalWins * 1.6;
    let distributorDelta = totalNominations * 0.4 + totalWins * 1.2;
    let audienceDelta = totalWins * 1;
    if (totalNominations === 0) {
      criticsDelta -= 1;
      talentDelta -= 1;
    }
    this.manager.adjustReputation(Math.round(criticsDelta), 'critics');
    this.manager.adjustReputation(Math.round(talentDelta), 'talent');
    this.manager.adjustReputation(Math.round(distributorDelta), 'distributor');
    this.manager.adjustReputation(Math.round(audienceDelta), 'audience');

    const prestigeRival = this.manager.rivals.find((rival) => rival.personality === 'prestigeHunter');
    if (prestigeRival) {
      this.manager.recordRivalInteraction(prestigeRival, {
        kind: 'prestigePressure',
        hostilityDelta: totalWins > 0 ? 2 : 1,
        respectDelta: totalWins > 0 ? 3 : 1,
        note:
          totalWins > 0
            ? `You converted awards momentum with ${winner.title}.`
            : 'You stayed in awards contention without major wins.',
        projectId: winner.projectId,
      });
    }

    const headline =
      totalWins > 0
        ? `Awards season year ${seasonYear}: ${winner.title} led with ${winner.wins} win(s) and ${winner.nominations} nomination(s).`
        : `Awards season year ${seasonYear}: ${winner.title} led nominations (${winner.nominations}) but no major wins landed.`;
    this.manager.awardsHistory.unshift({
      seasonYear,
      week: this.manager.currentWeek,
      showName: 'Global Film Honors',
      results,
      headline,
    });
    this.manager.awardsHistory = this.manager.awardsHistory.slice(0, 24);
    this.manager.awardsSeasonsProcessed.push(seasonYear);
    this.manager.awardsSeasonsProcessed = this.manager.awardsSeasonsProcessed.slice(-20);
    if (totalNominations > 0 || totalWins > 0) {
      this.addChronicleEntry({
        week: this.manager.currentWeek,
        type: 'awardsOutcome',
        headline,
        impact: totalWins > 0 ? 'positive' : 'neutral',
      });
    }
    events.push(
      `${headline} Reputation: Critics ${Math.round(criticsDelta) >= 0 ? '+' : ''}${Math.round(criticsDelta)}, Talent ${Math.round(talentDelta) >= 0 ? '+' : ''}${Math.round(talentDelta)}.`
    );
  }

  // --- Festivals ---

  resolveFestivalCircuit(events: string[]): void {
    for (const project of this.manager.activeProjects) {
      if (project.festivalStatus !== 'submitted') continue;
      if (!project.festivalResolutionWeek || this.manager.currentWeek < project.festivalResolutionWeek) continue;

      const projection = this.getProjectedForProject(project.id);
      const criticalAnchor = project.criticalScore ?? projection?.critical ?? 55;
      const cycleBoost = (this.manager.getGenreDemandMultiplier(project.genre) - 1) * 12;
      const score = clamp(
        criticalAnchor * 0.48 +
        project.scriptQuality * 2.8 +
        project.prestige * 0.2 +
        project.originality * 0.18 +
        project.festivalBuzz * 0.12 +
        this.manager.foundingProfileEffects.festivalBuzzBonus +
        cycleBoost -
        project.controversy * 0.15,
        0,
        100
      );
      const selectionChance = clamp(0.16 + score / 132, 0.08, 0.9);
      const selected = this.manager.eventRng() <= selectionChance;

      if (selected) {
        const buzzChance = clamp(0.15 + score / 170, 0.05, 0.78);
        const buzzed = this.manager.eventRng() <= buzzChance;
        const nextStatus: MovieProject['festivalStatus'] = buzzed ? 'buzzed' : 'selected';
        const buzzGain = buzzed ? 12 + Math.round(this.manager.eventRng() * 6) : 6 + Math.round(this.manager.eventRng() * 4);
        project.festivalStatus = nextStatus;
        project.festivalBuzz = clamp(project.festivalBuzz + buzzGain, 0, FESTIVAL_RULES.MAX_BUZZ);
        project.hypeScore = clamp(project.hypeScore + (buzzed ? 6 : 3), 0, 100);
        this.manager.adjustReputation(buzzed ? 4 : 2, 'critics');
        this.manager.adjustReputation(buzzed ? 2 : 1, 'audience');
        this.manager.storyFlags.festival_selected = (this.manager.storyFlags.festival_selected ?? 0) + 1;
        if (buzzed) {
          this.manager.storyFlags.awards_campaign = (this.manager.storyFlags.awards_campaign ?? 0) + 1;
        }
        const prestigeRival = this.manager.rivals.find((rival) => rival.personality === 'prestigeHunter');
        if (prestigeRival) {
          this.manager.recordRivalInteraction(prestigeRival, {
            kind: 'prestigePressure',
            hostilityDelta: buzzed ? 3 : 2,
            respectDelta: 2,
            note: `${project.title} generated ${buzzed ? 'major' : 'solid'} festival traction at ${project.festivalTarget ?? 'festival circuit'}.`,
            projectId: project.id,
          });
        }
        this.addChronicleEntry({
          week: this.manager.currentWeek,
          type: 'festivalOutcome',
          headline: `${project.title} ${buzzed ? 'broke out' : 'screened'} at ${project.festivalTarget ?? 'festival circuit'}`,
          projectTitle: project.title,
          impact: buzzed ? 'positive' : 'neutral',
        });
        events.push(
          `${project.title} ${buzzed ? 'broke out' : 'landed'} at ${project.festivalTarget ?? 'festival circuit'} (${nextStatus}). Critics ${buzzed ? '+4' : '+2'}.`
        );
      } else {
        project.festivalStatus = 'snubbed';
        project.festivalBuzz = Math.max(0, project.festivalBuzz - 2);
        project.hypeScore = clamp(project.hypeScore - 2, 0, 100);
        this.manager.adjustReputation(-1, 'critics');
        events.push(`${project.title} was passed over at ${project.festivalTarget ?? 'festival circuit'}. Critics -1.`);
      }

      project.festivalResolutionWeek = null;
    }
  }

  // --- Calendar pressure ---

  calendarPressureMultiplier(week: number, genre: MovieGenre): number {
    let pressure = 1;
    const rivalFilms = this.manager.rivals
      .flatMap((rival) => rival.upcomingReleases)
      .filter((film) => Math.abs(film.releaseWeek - week) <= 1);

    for (const rivalFilm of rivalFilms) {
      const budgetPenalty = rivalFilm.estimatedBudget > 100_000_000 ? 0.12 : 0.05;
      const genreOverlap = rivalFilm.genre === genre ? 0.08 : 0.02;
      pressure -= budgetPenalty + genreOverlap;
    }
    return Math.max(0.45, pressure);
  }

  // --- Helpers ---

  private addChronicleEntry(entry: Omit<ChronicleEntry, 'id'>): void {
    this.manager.studioChronicle.unshift({ id: createId('chron'), ...entry });
    this.manager.studioChronicle = this.manager.studioChronicle.slice(0, 100);
  }
}
