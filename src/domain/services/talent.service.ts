import { TALENT_MARKET_RULES } from '../balance-constants';
import {
  adjustTalentNegotiationForManager,
  getNegotiationChanceForManager,
  previewTalentNegotiationRoundForManager,
  getNegotiationSnapshotForManager,
  getQuickCloseChanceForManager,
  negotiateAndAttachTalentForManager,
  processPlayerNegotiationsForManager,
  startTalentNegotiationRoundForManager,
  startTalentNegotiationForManager,
  type NegotiationRoundPreview,
  type NegotiationSnapshot,
} from '../studio-manager.negotiation';
import type { StudioManager } from '../studio-manager';
import type {
  CastRequirements,
  CrisisEvent,
  MovieGenre,
  MovieProject,
  NegotiationAction,
  PlayerNegotiation,
  Talent,
  TalentInteractionKind,
  TalentRole,
  TalentTrustLevel,
} from '../types';
import {
  getTalentMemoryForManager,
  syncLegacyRelationshipForManager,
  getTalentTrustLevelForManager,
  getTalentGrudgeMetricsForManager,
  getTalentNegotiationOutlookForManager,
  recordTalentInteractionForManager,
  updateTalentAvailabilityForManager,
  setNegotiationCooldownForManager,
  findNegotiationForManager,
  defaultNegotiationTermsForManager,
  buildQuickCloseTermsForManager,
  readNegotiationTermsForManager,
  normalizeNegotiationForManager,
  demandedNegotiationTermsForManager,
  computeDealMemoCostForManager,
  computeQuickCloseAttemptFeeForManager,
  talentDealChanceForManager,
  evaluateNegotiationForManager,
  finalizeTalentAttachmentForManager,
  negotiationPressurePointForManager,
  composeNegotiationPreviewForManager,
  composeNegotiationSignalForManager,
  processTalentAgingForManager,
  type NegotiationEvaluation,
  type NegotiationTerms,
} from '../talent.service';
import { clamp } from '../studio-manager.constants';

export class TalentService {
  constructor(private readonly manager: StudioManager) {}

  // --- Trust & Memory ---

  getTalentMemory(talent: Talent): Talent['relationshipMemory'] {
    return getTalentMemoryForManager(this.manager, talent);
  }

  syncLegacyRelationship(talent: Talent): void {
    syncLegacyRelationshipForManager(this.manager, talent);
  }

  getTalentTrustLevel(talent: Talent): TalentTrustLevel {
    return getTalentTrustLevelForManager(this.manager, talent);
  }

  getTalentGrudgeMetrics(talent: Talent) {
    return getTalentGrudgeMetricsForManager(this.manager, talent);
  }

  getTalentNegotiationOutlook(talent: Talent) {
    return getTalentNegotiationOutlookForManager(this.manager, talent);
  }

  canOpenTalentNegotiation(talent: Talent): { ok: boolean; lockoutWeeks: number; reason: string | null } {
    const outlook = this.getTalentNegotiationOutlook(talent);
    if (!outlook.blocked) return { ok: true, lockoutWeeks: 0, reason: null };
    return { ok: false, lockoutWeeks: outlook.lockoutWeeks, reason: outlook.reason };
  }

  recordTalentInteraction(
    talent: Talent,
    input: {
      kind: TalentInteractionKind;
      trustDelta: number;
      loyaltyDelta: number;
      note: string;
      projectId?: string | null;
    }
  ): void {
    recordTalentInteractionForManager(this.manager, talent, input);
  }

  // --- Negotiation ---

  getNegotiationChance(talentId: string, projectId?: string): number | null {
    return getNegotiationChanceForManager(this.manager, talentId, projectId);
  }

  getQuickCloseChance(talentId: string): number | null {
    return getQuickCloseChanceForManager(this.manager, talentId);
  }

  getNegotiationSnapshot(projectId: string, talentId: string): NegotiationSnapshot | null {
    return getNegotiationSnapshotForManager(this.manager, projectId, talentId);
  }

  previewTalentNegotiationRound(
    projectId: string,
    talentId: string,
    action: NegotiationAction
  ): { success: boolean; message?: string; preview?: NegotiationRoundPreview } {
    return previewTalentNegotiationRoundForManager(this.manager, projectId, talentId, action);
  }

  adjustTalentNegotiation(
    projectId: string,
    talentId: string,
    action: NegotiationAction
  ): { success: boolean; message: string } {
    return adjustTalentNegotiationForManager(this.manager, projectId, talentId, action);
  }

  startTalentNegotiation(projectId: string, talentId: string): { success: boolean; message: string } {
    return startTalentNegotiationForManager(this.manager, projectId, talentId);
  }

  startTalentNegotiationRound(
    projectId: string,
    talentId: string,
    action: NegotiationAction
  ): { success: boolean; message: string } {
    return startTalentNegotiationRoundForManager(this.manager, projectId, talentId, action);
  }

  dismissTalentNegotiation(projectId: string, talentId: string): void {
    this.manager.playerNegotiations = this.manager.playerNegotiations.filter(
      (item) => !(item.projectId === projectId && item.talentId === talentId)
    );
    const talent = this.manager.talentPool.find((item) => item.id === talentId);
    if (!talent) return;
    const stillNegotiating = this.manager.playerNegotiations.some((item) => item.talentId === talentId);
    if (!stillNegotiating && talent.attachedProjectId === null && talent.availability === 'inNegotiation') {
      talent.availability = 'available';
    }
  }

  negotiateAndAttachTalent(projectId: string, talentId: string): { success: boolean; message: string } {
    return negotiateAndAttachTalentForManager(this.manager, projectId, talentId);
  }

  processPlayerNegotiations(events: string[]): void {
    processPlayerNegotiationsForManager(this.manager, events);
  }

  processTalentAging(events: string[]): void {
    processTalentAgingForManager(this.manager, events);
  }

  // --- Negotiation internals (used by ForManager functions via manager) ---

  findNegotiation(talentId: string, projectId?: string): PlayerNegotiation | null {
    return findNegotiationForManager(this.manager, talentId, projectId);
  }

  defaultNegotiationTerms(talent: Talent) {
    return defaultNegotiationTermsForManager(talent);
  }

  buildQuickCloseTerms(talent: Talent) {
    return buildQuickCloseTermsForManager(talent);
  }

  readNegotiationTerms(negotiation: PlayerNegotiation, talent: Talent) {
    return readNegotiationTermsForManager(negotiation, talent);
  }

  normalizeNegotiation(negotiation: PlayerNegotiation, talent: Talent): PlayerNegotiation {
    return normalizeNegotiationForManager(negotiation, talent);
  }

  demandedNegotiationTerms(talent: Talent) {
    return demandedNegotiationTermsForManager(talent);
  }

  computeDealMemoCost(talent: Talent, terms: NegotiationTerms): number {
    return computeDealMemoCostForManager(talent, terms);
  }

  computeQuickCloseAttemptFee(talent: Talent, terms: NegotiationTerms): number {
    return computeQuickCloseAttemptFeeForManager(talent, terms);
  }

  setNegotiationCooldown(talent: Talent, weeks: number): void {
    setNegotiationCooldownForManager(this.manager, talent, weeks);
  }

  talentDealChance(talent: Talent, base: number): number {
    return talentDealChanceForManager(this.manager, talent, base);
  }

  evaluateNegotiation(
    negotiation: PlayerNegotiation,
    talent: Talent,
    baseChance = 0.7
  ) {
    return evaluateNegotiationForManager(this.manager, negotiation, talent, baseChance);
  }

  negotiationPressurePoint(evaluation: NegotiationEvaluation): 'salary' | 'backend' | 'perks' {
    return negotiationPressurePointForManager(evaluation);
  }

  composeNegotiationPreview(
    talentName: string,
    evaluation: NegotiationEvaluation,
    holdLineCount: number
  ): string {
    return composeNegotiationPreviewForManager(talentName, evaluation, holdLineCount);
  }

  composeNegotiationSignal(
    talentName: string,
    evaluation: NegotiationEvaluation,
    accepted: boolean,
    holdLineCount: number
  ): string {
    return composeNegotiationSignalForManager(talentName, evaluation, accepted, holdLineCount);
  }

  finalizeTalentAttachment(project: MovieProject, talent: Talent, terms?: NegotiationTerms): boolean {
    return finalizeTalentAttachmentForManager(this.manager, project, talent, terms);
  }

  // --- Talent Poach Crisis ---

  resolveTalentPoachCrisis(project: MovieProject, option: CrisisEvent['options'][number]): void {
    const talent = this.manager.talentPool.find((item) => item.id === option.talentId);
    if (!talent) return;
    const rival = this.manager.rivals.find((item) => item.id === option.rivalStudioId);

    if (option.kind === 'talentCounter') {
      const premium = option.premiumMultiplier ?? 1.25;
      const cost = talent.salary.base * 0.2 * premium;
      const retainer = this.computeDealMemoCost(talent, this.defaultNegotiationTerms(talent));
      const chance = clamp(0.55 + this.manager.reputation.talent / 210 + talent.studioRelationship * 0.2, 0.15, 0.95);
      if (this.manager.cash >= cost + retainer && this.manager.negotiationRng() <= chance) {
        this.manager.adjustCash(-cost);
        if (rival) {
          rival.lockedTalentIds = rival.lockedTalentIds.filter((idValue) => idValue !== talent.id);
        }
        this.finalizeTalentAttachment(project, talent);
        this.recordTalentInteraction(talent, {
          kind: 'counterPoachWon',
          trustDelta: 4,
          loyaltyDelta: 7,
          note: `Countered rival pressure and re-secured ${talent.name} for ${project.title}.`,
          projectId: project.id,
        });
      } else {
        this.recordTalentInteraction(talent, {
          kind: 'counterPoachLost',
          trustDelta: -4,
          loyaltyDelta: -6,
          note: `Counter-offer failed while trying to secure ${project.title}.`,
          projectId: project.id,
        });
      }
    }

    if (option.kind === 'talentWalk') {
      project.hypeScore = clamp(project.hypeScore - 2, 0, 100);
      this.recordTalentInteraction(talent, {
        kind: 'counterPoachLost',
        trustDelta: -2,
        loyaltyDelta: -3,
        note: `Let poach pressure stand on ${project.title}.`,
        projectId: project.id,
      });
    }

    this.manager.playerNegotiations = this.manager.playerNegotiations.filter((item) => item.talentId !== talent.id);
  }

  // --- Release talent from project ---

  releaseTalent(projectId: string, context: 'released' | 'abandoned' = 'released'): void {
    const project = this.manager.activeProjects.find((item) => item.id === projectId);
    for (const talent of this.manager.talentPool) {
      if (talent.attachedProjectId === projectId) {
        talent.attachedProjectId = null;
        talent.availability = 'available';
        if (context === 'abandoned') {
          this.recordTalentInteraction(talent, {
            kind: 'projectAbandoned',
            trustDelta: -9,
            loyaltyDelta: -11,
            note: `Studio abandoned ${project?.title ?? 'an attached project'}.`,
            projectId,
          });
        } else {
          this.recordTalentInteraction(talent, {
            kind: 'projectReleased',
            trustDelta: 2,
            loyaltyDelta: 3,
            note: `${project?.title ?? 'Project'} moved into release.`,
            projectId,
          });
        }
      }
    }
  }

  // --- Talent availability ---

  updateTalentAvailability(): void {
    updateTalentAvailabilityForManager(this.manager);
    for (const talent of this.manager.talentPool) {
      if (talent.availability === 'available') {
        for (const rival of this.manager.rivals) {
          rival.lockedTalentIds = rival.lockedTalentIds.filter((idValue) => idValue !== talent.id);
        }
      }
    }
  }

  getAvailableTalentForRole(role: TalentRole): Talent[] {
    return this.manager.talentPool.filter(
      (talent) =>
        talent.role === role &&
        talent.availability === 'available' &&
        talent.marketWindowExpiresWeek !== null
    );
  }

  // --- Cast requirements ---

  castCountsForProject(project: MovieProject): { actorCount: number; actressCount: number; total: number } {
    let actorCount = 0;
    let actressCount = 0;
    for (const talentId of project.castIds) {
      const talent = this.manager.talentPool.find((item) => item.id === talentId);
      if (!talent) continue;
      if (talent.role === 'leadActress') {
        actressCount += 1;
      } else if (talent.role === 'leadActor' || talent.role === 'supportingActor') {
        actorCount += 1;
      }
    }
    return { actorCount, actressCount, total: actorCount + actressCount };
  }

  getProjectCastStatus(projectId: string): { actorCount: number; actressCount: number; total: number; requiredTotal: number } | null {
    const project = this.manager.activeProjects.find((item) => item.id === projectId);
    if (!project) return null;
    const current = this.castCountsForProject(project);
    return {
      ...current,
      requiredTotal: project.castRequirements.actorCount + project.castRequirements.actressCount,
    };
  }

  meetsCastRequirements(project: MovieProject): boolean {
    const current = this.castCountsForProject(project);
    const requiredActor = project.castRequirements.actorCount;
    const requiredActress = project.castRequirements.actressCount;
    const requiredTotal = requiredActor + requiredActress;
    return (
      current.actorCount >= requiredActor &&
      current.actressCount >= requiredActress &&
      current.total >= requiredTotal
    );
  }

  // --- Budget planning helpers ---

  talentCompensationValue(talent: Talent): number {
    return talent.salary.base + talent.salary.perksCost;
  }

  estimateRoleMarketComp(role: TalentRole, genre: MovieGenre): number {
    const pool = this.manager.talentPool.filter((talent) => talent.role === role);
    if (pool.length === 0) return 0;
    const sample = [...pool]
      .sort((a, b) => {
        const aFit = a.genreFit[genre] ?? 0.55;
        const bFit = b.genreFit[genre] ?? 0.55;
        const aScore = aFit * 5 + a.starPower * 0.35 + a.craftScore * 0.3;
        const bScore = bFit * 5 + b.starPower * 0.35 + b.craftScore * 0.3;
        return bScore - aScore;
      })
      .slice(0, Math.max(8, Math.min(20, Math.round(pool.length * 0.12))));
    const values = sample
      .map((talent) => this.talentCompensationValue(talent))
      .sort((a, b) => a - b);
    const middle = Math.floor(values.length / 2);
    return values[middle] ?? values[0] ?? 0;
  }

  buildProjectBudgetPlan(
    genre: MovieGenre,
    ceiling: number,
    castRequirements: CastRequirements
  ) {
    const directorEstimate = this.estimateRoleMarketComp('director', genre);
    const actorEstimate = this.estimateRoleMarketComp('leadActor', genre);
    const actressEstimate =
      this.estimateRoleMarketComp('leadActress', genre) || this.estimateRoleMarketComp('leadActor', genre);
    const castPlannedActor = Math.round(actorEstimate * castRequirements.actorCount);
    const castPlannedActress = Math.round(actressEstimate * castRequirements.actressCount);
    const castPlannedTotal = castPlannedActor + castPlannedActress;
    const directorFloor = Math.round(ceiling * 0.06);
    const directorCeiling = Math.round(ceiling * 0.26);
    const directorPlanned = clamp(
      Math.round(directorEstimate),
      directorFloor,
      Math.max(directorFloor, directorCeiling)
    );

    return {
      directorPlanned,
      castPlannedTotal,
      castPlannedActor,
      castPlannedActress,
    };
  }

  // --- Talent market ---

  private marketWindowDuration(starPower: number): number {
    if (starPower >= TALENT_MARKET_RULES.THRESHOLD_HIGH) return TALENT_MARKET_RULES.WINDOW_HIGH_WEEKS;
    if (starPower >= TALENT_MARKET_RULES.THRESHOLD_MID) return TALENT_MARKET_RULES.WINDOW_MID_WEEKS;
    return TALENT_MARKET_RULES.WINDOW_LOW_WEEKS;
  }

  private isTalentMarketEligible(talent: Talent): boolean {
    if (talent.availability !== 'available') return false;
    if (talent.marketWindowExpiresWeek !== null) return false;
    const sp = talent.starPower;
    const heat = this.manager.studioHeat;
    const talentRep = this.manager.reputation.talent;
    if (sp >= TALENT_MARKET_RULES.THRESHOLD_LEGEND) {
      return heat >= TALENT_MARKET_RULES.GATE_LEGEND_HEAT && talentRep >= TALENT_MARKET_RULES.GATE_LEGEND_TALENT_REP;
    }
    if (sp >= TALENT_MARKET_RULES.THRESHOLD_ELITE) {
      return heat >= TALENT_MARKET_RULES.GATE_ELITE_HEAT || talentRep >= TALENT_MARKET_RULES.GATE_ELITE_TALENT_REP;
    }
    if (sp >= TALENT_MARKET_RULES.THRESHOLD_HIGH) {
      return heat >= TALENT_MARKET_RULES.GATE_HIGH_HEAT || talentRep >= TALENT_MARKET_RULES.GATE_HIGH_TALENT_REP;
    }
    if (sp >= TALENT_MARKET_RULES.THRESHOLD_MID) {
      return heat >= TALENT_MARKET_RULES.GATE_MID_HEAT || talentRep >= TALENT_MARKET_RULES.GATE_MID_TALENT_REP;
    }
    return true;
  }

  private addTalentToMarket(talent: Talent): void {
    talent.marketWindowExpiresWeek = this.manager.currentWeek + this.marketWindowDuration(talent.starPower);
  }

  private getVisibleLeadTalent(role: 'leadActor' | 'leadActress'): Talent[] {
    return this.manager.talentPool.filter(
      (talent) =>
        talent.role === role &&
        talent.availability === 'available' &&
        talent.marketWindowExpiresWeek !== null
    );
  }

  private getVisibleLeadCount(role: 'leadActor' | 'leadActress'): number {
    return this.getVisibleLeadTalent(role).length;
  }

  private getEligibleLeadPool(role: 'leadActor' | 'leadActress'): Talent[] {
    return this.manager.talentPool.filter((talent) => talent.role === role);
  }

  private hasEligibleLeadSupply(role: 'leadActor' | 'leadActress'): boolean {
    return this.getEligibleLeadPool(role).some((talent) => this.isTalentMarketEligible(talent));
  }

  private getVisibleLeadTotal(): number {
    return this.getVisibleLeadCount('leadActor') + this.getVisibleLeadCount('leadActress');
  }

  private clearVisibleLeadSlot(role: 'leadActor' | 'leadActress'): boolean {
    const candidate = this.getVisibleLeadTalent(role)
      .slice()
      .sort(
        (a, b) =>
          (a.marketWindowExpiresWeek ?? Number.MAX_SAFE_INTEGER) -
          (b.marketWindowExpiresWeek ?? Number.MAX_SAFE_INTEGER)
      )[0];
    if (!candidate) return false;
    candidate.marketWindowExpiresWeek = null;
    return true;
  }

  private ensureLeadRoleFloor(role: 'leadActor' | 'leadActress'): boolean {
    if (this.getVisibleLeadCount(role) > 0 || !this.hasEligibleLeadSupply(role)) return false;
    const oppositeRole = role === 'leadActor' ? 'leadActress' : 'leadActor';
    if (
      this.getVisibleLeadTotal() >= TALENT_MARKET_RULES.MAX_VISIBLE_ACTORS &&
      this.getVisibleLeadCount(oppositeRole) > 0 &&
      !this.clearVisibleLeadSlot(oppositeRole)
    ) {
      return false;
    }
    return this.addNextEligibleFromPool(this.getEligibleLeadPool(role), role);
  }

  private addBalancedLeadEntrant(): boolean {
    if (this.getVisibleLeadTotal() >= TALENT_MARKET_RULES.MAX_VISIBLE_ACTORS) return false;

    const actorCount = this.getVisibleLeadCount('leadActor');
    const actressCount = this.getVisibleLeadCount('leadActress');
    const preferActor =
      actorCount < actressCount ||
      (actorCount === actressCount && this.manager.marketActorIdx % 2 === 0);
    const primaryRole = preferActor ? 'leadActor' : 'leadActress';
    const secondaryRole = preferActor ? 'leadActress' : 'leadActor';

    let added = this.addNextEligibleFromPool(this.getEligibleLeadPool(primaryRole), primaryRole);
    if (!added) {
      added = this.addNextEligibleFromPool(this.getEligibleLeadPool(secondaryRole), secondaryRole);
    }
    if (added) {
      this.manager.marketActorIdx += 1;
    }
    return added;
  }

  private rebalanceLeadMarket(): void {
    this.ensureLeadRoleFloor('leadActor');
    this.ensureLeadRoleFloor('leadActress');

    let additionsRemaining = TALENT_MARKET_RULES.WEEKLY_ACTOR_TRICKLE;
    while (additionsRemaining > 0) {
      const added = this.addBalancedLeadEntrant();
      if (!added) break;
      additionsRemaining -= 1;
    }
  }

  private addNextEligibleFromPool(
    pool: Talent[],
    role: 'director' | 'leadActor' | 'leadActress'
  ): boolean {
    if (pool.length === 0) return false;
    let attempts = 0;
    while (attempts < pool.length) {
      let candidate: Talent | undefined;
      if (role === 'director') {
        candidate = pool[this.manager.marketDirectorIdx % pool.length];
        this.manager.marketDirectorIdx += 1;
      } else if (role === 'leadActor') {
        candidate = pool[this.manager.marketLeadActorIdx % pool.length];
        this.manager.marketLeadActorIdx += 1;
      } else {
        candidate = pool[this.manager.marketLeadActressIdx % pool.length];
        this.manager.marketLeadActressIdx += 1;
      }
      attempts += 1;
      if (candidate && this.isTalentMarketEligible(candidate)) {
        this.addTalentToMarket(candidate);
        return true;
      }
    }
    return false;
  }

  private ageOutExpiredMarketWindows(): void {
    for (const talent of this.manager.talentPool) {
      if (
        talent.marketWindowExpiresWeek !== null &&
        talent.marketWindowExpiresWeek <= this.manager.currentWeek &&
        talent.availability === 'available'
      ) {
        talent.marketWindowExpiresWeek = null;
      }
    }
  }

  private trickleNewMarketEntrants(): void {
    const directors = this.manager.talentPool.filter((t) => t.role === 'director');

    const visibleDirectors = directors.filter(
      (t) => t.marketWindowExpiresWeek !== null && t.availability === 'available'
    ).length;

    let dirToAdd = Math.min(
      Math.max(0, TALENT_MARKET_RULES.MAX_VISIBLE_DIRECTORS - visibleDirectors),
      TALENT_MARKET_RULES.WEEKLY_DIRECTOR_TRICKLE
    );
    let attempts = 0;
    while (dirToAdd > 0 && attempts < directors.length) {
      const candidate = directors[this.manager.marketDirectorIdx % directors.length];
      this.manager.marketDirectorIdx++;
      attempts++;
      if (candidate && this.isTalentMarketEligible(candidate)) {
        this.addTalentToMarket(candidate);
        dirToAdd--;
      }
    }
    this.rebalanceLeadMarket();
  }

  private populateInitialMarket(): void {
    const directors = this.manager.talentPool.filter((t) => t.role === 'director');
    let dirCount = 0;
    while (dirCount < TALENT_MARKET_RULES.MAX_VISIBLE_DIRECTORS) {
      const added = this.addNextEligibleFromPool(directors, 'director');
      if (!added) break;
      dirCount += 1;
    }

    const leadActors = this.manager.talentPool.filter((t) => t.role === 'leadActor');
    const leadActresses = this.manager.talentPool.filter((t) => t.role === 'leadActress');
    const totalLeadSlots = TALENT_MARKET_RULES.MAX_VISIBLE_ACTORS;
    const baselinePerRole = Math.floor(totalLeadSlots / 2);
    let leadActorCount = 0;
    let leadActressCount = 0;

    while (leadActorCount < baselinePerRole) {
      const added = this.addNextEligibleFromPool(leadActors, 'leadActor');
      if (!added) break;
      leadActorCount += 1;
      this.manager.marketActorIdx += 1;
    }

    while (leadActressCount < baselinePerRole) {
      const added = this.addNextEligibleFromPool(leadActresses, 'leadActress');
      if (!added) break;
      leadActressCount += 1;
      this.manager.marketActorIdx += 1;
    }

    while (leadActorCount + leadActressCount < totalLeadSlots) {
      const preferActor =
        leadActorCount < leadActressCount ||
        (leadActorCount === leadActressCount && this.manager.marketActorIdx % 2 === 0);
      let added = false;
      if (preferActor) {
        added = this.addNextEligibleFromPool(leadActors, 'leadActor');
        if (added) {
          leadActorCount += 1;
        } else {
          added = this.addNextEligibleFromPool(leadActresses, 'leadActress');
          if (added) leadActressCount += 1;
        }
      } else {
        added = this.addNextEligibleFromPool(leadActresses, 'leadActress');
        if (added) {
          leadActressCount += 1;
        } else {
          added = this.addNextEligibleFromPool(leadActors, 'leadActor');
          if (added) leadActorCount += 1;
        }
      }
      if (!added) break;
      this.manager.marketActorIdx += 1;
    }
  }

  refreshTalentMarket(): void {
    if (!this.manager.marketInitialized) {
      this.manager.marketInitialized = true;
      this.populateInitialMarket();
      return;
    }
    this.ageOutExpiredMarketWindows();
    this.trickleNewMarketEntrants();
  }
}
