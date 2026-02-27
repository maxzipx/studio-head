import type {
    Talent,
    MovieProject,
    PlayerNegotiation,
    TalentInteractionKind,
    TalentTrustLevel,
} from './types';
import { clamp, AGENT_DIFFICULTY } from './studio-manager.constants';
import { TALENT_NEGOTIATION_RULES, MEMORY_RULES } from './balance-constants';

export interface TalentManagerAdapter {
    currentWeek: number;
    cash: number;
    talentPool: Talent[];
    activeProjects: MovieProject[];
    playerNegotiations: PlayerNegotiation[];
    reputation: { talent: number };
    executiveNetworkLevel: number;
    studioSpecialization: 'indie' | 'prestige' | 'blockbuster' | 'balanced';

    adjustCash(amount: number): void;
    negotiationRng(): number;
    getArcOutcomeModifiers(): { talentLeverage: number };
}

// Memory & Relationships
export function getTalentMemoryForManager(manager: TalentManagerAdapter, talent: Talent): Talent['relationshipMemory'] {
    if (!talent.relationshipMemory) {
        const trust = Math.round(Math.min(100, Math.max(0, 35 + talent.studioRelationship * 45)));
        const loyalty = Math.round(Math.min(100, Math.max(0, 30 + talent.studioRelationship * 40)));
        talent.relationshipMemory = {
            trust,
            loyalty,
            interactionHistory: [],
        };
    }
    if (!Array.isArray(talent.relationshipMemory.interactionHistory)) {
        talent.relationshipMemory.interactionHistory = [];
    }
    return talent.relationshipMemory;
}

export function syncLegacyRelationshipForManager(manager: TalentManagerAdapter, talent: Talent): void {
    const memory = getTalentMemoryForManager(manager, talent);
    talent.studioRelationship = clamp((memory.trust * 0.62 + memory.loyalty * 0.38) / 100, 0, 1);
}

export function getTalentTrustLevelForManager(manager: TalentManagerAdapter, talent: Talent): TalentTrustLevel {
    const trust = getTalentMemoryForManager(manager, talent).trust;
    if (trust < 25) return 'hostile';
    if (trust < 45) return 'wary';
    if (trust < 65) return 'neutral';
    if (trust < 82) return 'aligned';
    return 'loyal';
}

export function getTalentGrudgeMetricsForManager(
    manager: TalentManagerAdapter,
    talent: Talent
): {
    score: number;
    recentNegativeCount: number;
    recentPositiveCount: number;
} {
    const memory = getTalentMemoryForManager(manager, talent);
    let rawScore = 0;
    let recentNegativeCount = 0;
    let recentPositiveCount = 0;

    for (const entry of memory.interactionHistory) {
        const ageWeeks = Math.max(0, manager.currentWeek - entry.week);
        const decay = Math.pow(TALENT_NEGOTIATION_RULES.GRUDGE_DECAY_PER_WEEK, ageWeeks);
        const trustImpact = Math.max(0, -entry.trustDelta * 1.2);
        const loyaltyImpact = Math.max(0, -entry.loyaltyDelta * 0.9);
        const kindPenalty =
            entry.kind === 'projectAbandoned'
                ? 5
                : entry.kind === 'quickCloseFailed'
                    ? 3
                    : entry.kind === 'negotiationDeclined'
                        ? 2
                        : entry.kind === 'dealStalled'
                            ? 2
                            : entry.kind === 'counterPoachLost'
                                ? 2
                                : 0;
        const impact = (trustImpact + loyaltyImpact + kindPenalty) * decay;
        rawScore += impact;

        const inRecentWindow = ageWeeks <= TALENT_NEGOTIATION_RULES.RECENT_MEMORY_WINDOW_WEEKS;
        if (inRecentWindow) {
            if (impact >= 1.5) recentNegativeCount += 1;
            if (entry.trustDelta > 0 || entry.loyaltyDelta > 0) recentPositiveCount += 1;
        }
    }

    const trustPenalty = Math.max(0, (40 - memory.trust) * 0.25);
    const score = clamp(Math.round(rawScore + trustPenalty), 0, 100);
    return { score, recentNegativeCount, recentPositiveCount };
}

export function getTalentNegotiationOutlookForManager(
    manager: TalentManagerAdapter,
    talent: Talent
): {
    grudgeScore: number;
    recentNegativeCount: number;
    refusalRisk: 'low' | 'elevated' | 'critical';
    blocked: boolean;
    lockoutWeeks: number;
    lockoutUntilWeek: number | null;
    reason: string | null;
} {
    const memory = getTalentMemoryForManager(manager, talent);
    const metrics = getTalentGrudgeMetricsForManager(manager, talent);
    const trustLevel = getTalentTrustLevelForManager(manager, talent);

    let refusalRisk: 'low' | 'elevated' | 'critical' = 'low';
    if (metrics.score >= 20 || metrics.recentNegativeCount >= 2 || trustLevel === 'wary') {
        refusalRisk = 'elevated';
    }
    if (metrics.score >= 30 || trustLevel === 'hostile' || metrics.recentNegativeCount >= 4) {
        refusalRisk = 'critical';
    }

    const hostileBlock =
        memory.trust <= TALENT_NEGOTIATION_RULES.HOSTILE_TRUST_THRESHOLD &&
        metrics.score >= TALENT_NEGOTIATION_RULES.LOCKOUT_GRUDGE_THRESHOLD;
    const freshGrudgeBlock =
        metrics.recentNegativeCount >= TALENT_NEGOTIATION_RULES.LOCKOUT_RECENT_NEGATIVE_THRESHOLD &&
        metrics.recentPositiveCount === 0 &&
        metrics.score >= TALENT_NEGOTIATION_RULES.LOCKOUT_GRUDGE_THRESHOLD;

    let lockoutWeeks = 0;
    let reason: string | null = null;

    if (hostileBlock || freshGrudgeBlock) {
        let computedWeeks = TALENT_NEGOTIATION_RULES.LOCKOUT_WEEKS_MIN;
        if (memory.trust <= TALENT_NEGOTIATION_RULES.HOSTILE_TRUST_THRESHOLD) computedWeeks += 1;
        if (metrics.score >= 28) computedWeeks += 1;
        if (metrics.recentNegativeCount >= 4) computedWeeks += 1;
        lockoutWeeks = clamp(
            computedWeeks,
            TALENT_NEGOTIATION_RULES.LOCKOUT_WEEKS_MIN,
            TALENT_NEGOTIATION_RULES.LOCKOUT_WEEKS_MAX
        );
        reason = hostileBlock
            ? 'Relationship is hostile after recent negotiations.'
            : 'Recent negotiation pattern triggered a cooling-off period.';
    }

    return {
        grudgeScore: metrics.score,
        recentNegativeCount: metrics.recentNegativeCount,
        refusalRisk,
        blocked: lockoutWeeks > 0,
        lockoutWeeks,
        lockoutUntilWeek: lockoutWeeks > 0 ? manager.currentWeek + lockoutWeeks : null,
        reason,
    };
}

export function recordTalentInteractionForManager(
    manager: TalentManagerAdapter,
    talent: Talent,
    input: {
        kind: TalentInteractionKind;
        trustDelta: number;
        loyaltyDelta: number;
        note: string;
        projectId?: string | null;
    }
): void {
    const memory = getTalentMemoryForManager(manager, talent);
    memory.trust = clamp(Math.round(memory.trust + input.trustDelta), 0, 100);
    memory.loyalty = clamp(Math.round(memory.loyalty + input.loyaltyDelta), 0, 100);
    memory.interactionHistory.push({
        week: manager.currentWeek,
        kind: input.kind,
        trustDelta: Math.round(input.trustDelta),
        loyaltyDelta: Math.round(input.loyaltyDelta),
        note: input.note,
        projectId: input.projectId ?? null,
    });
    if (memory.interactionHistory.length > MEMORY_RULES.TALENT_INTERACTION_HISTORY_MAX) {
        memory.interactionHistory = memory.interactionHistory.slice(-MEMORY_RULES.TALENT_INTERACTION_HISTORY_MAX);
    }
    syncLegacyRelationshipForManager(manager, talent);
}

// Utilities
export function setNegotiationCooldownForManager(manager: TalentManagerAdapter, talent: Talent, weeks: number): void {
    talent.availability = 'unavailable';
    talent.unavailableUntilWeek = manager.currentWeek + Math.max(1, Math.round(weeks));
    talent.attachedProjectId = null;
}

export function updateTalentAvailabilityForManager(manager: TalentManagerAdapter): void {
    for (const talent of manager.talentPool) {
        if (talent.availability !== 'unavailable') continue;
        if (!talent.unavailableUntilWeek) continue;
        if (manager.currentWeek < talent.unavailableUntilWeek) continue;
        talent.availability = 'available';
        talent.unavailableUntilWeek = null;
    }
}

export interface NegotiationTerms {
    salaryMultiplier: number;
    backendPoints: number;
    perksBudget: number;
}

export interface NegotiationEvaluation {
    chance: number;
    salaryFit: number;
    backendFit: number;
    perksFit: number;
    termsScore: number;
    demand: NegotiationTerms;
}

export function findNegotiationForManager(
    manager: TalentManagerAdapter,
    talentId: string,
    projectId?: string
): PlayerNegotiation | null {
    const match = manager.playerNegotiations.find(
        (item) => item.talentId === talentId && (projectId ? item.projectId === projectId : true)
    );
    return match ?? null;
}

export function defaultNegotiationTermsForManager(talent: Talent): NegotiationTerms {
    return {
        salaryMultiplier: 1,
        backendPoints: talent.salary.backendPoints,
        perksBudget: talent.salary.perksCost,
    };
}

export function buildQuickCloseTermsForManager(talent: Talent): NegotiationTerms {
    return {
        salaryMultiplier: 1.06,
        backendPoints: talent.salary.backendPoints + 0.6,
        perksBudget: talent.salary.perksCost * 1.15,
    };
}

export function readNegotiationTermsForManager(
    negotiation: PlayerNegotiation,
    talent: Talent
): NegotiationTerms {
    const defaults = defaultNegotiationTermsForManager(talent);
    return {
        salaryMultiplier: clamp(negotiation.offerSalaryMultiplier ?? defaults.salaryMultiplier, 0.8, 1.6),
        backendPoints: clamp(negotiation.offerBackendPoints ?? defaults.backendPoints, 0, 12),
        perksBudget: Math.max(0, negotiation.offerPerksBudget ?? defaults.perksBudget),
    };
}

export function normalizeNegotiationForManager(
    negotiation: PlayerNegotiation,
    talent: Talent
): PlayerNegotiation {
    const terms = readNegotiationTermsForManager(negotiation, talent);
    if (typeof negotiation.rounds !== 'number') negotiation.rounds = 0;
    if (typeof negotiation.holdLineCount !== 'number') negotiation.holdLineCount = 0;
    negotiation.offerSalaryMultiplier = terms.salaryMultiplier;
    negotiation.offerBackendPoints = terms.backendPoints;
    negotiation.offerPerksBudget = terms.perksBudget;
    return negotiation;
}

export function demandedNegotiationTermsForManager(talent: Talent): NegotiationTerms {
    const agentPush = (AGENT_DIFFICULTY[talent.agentTier] - 1) * 0.18;
    const starPush = Math.max(0, talent.starPower - 5) * 0.045;
    const craftPush = Math.max(0, talent.craftScore - 5) * 0.02;
    return {
        salaryMultiplier: clamp(1 + agentPush + starPush + craftPush, 1, 1.58),
        backendPoints: clamp(talent.salary.backendPoints + starPush * 5 + agentPush * 4 + 0.2, 0.5, 11),
        perksBudget: talent.salary.perksCost * (1 + talent.egoLevel * 0.08 + agentPush),
    };
}

export function computeDealMemoCostForManager(talent: Talent, terms: NegotiationTerms): number {
    const salaryRetainer = talent.salary.base * 0.08 * terms.salaryMultiplier;
    const perksHold = terms.perksBudget * 0.2;
    return salaryRetainer + perksHold;
}

export function computeQuickCloseAttemptFeeForManager(talent: Talent, terms: NegotiationTerms): number {
    const memoCost = computeDealMemoCostForManager(talent, terms);
    return clamp(memoCost * 0.2, 25_000, 240_000);
}

export function talentDealChanceForManager(
    manager: TalentManagerAdapter,
    talent: Talent,
    base: number
): number {
    const arcLeverage = manager.getArcOutcomeModifiers().talentLeverage;
    const memory = getTalentMemoryForManager(manager, talent);
    const outlook = getTalentNegotiationOutlookForManager(manager, talent);
    syncLegacyRelationshipForManager(manager, talent);
    const trustBoost = (memory.trust - 50) / 260;
    const loyaltyBoost = (memory.loyalty - 50) / 320;
    const relationshipBoost = clamp((talent.studioRelationship - 0.5) * 0.16 + trustBoost + loyaltyBoost, -0.16, 0.2);
    const heatBoost = clamp((manager.reputation.talent - 10) / 260, -0.08, 0.16);
    const reputationPenalty = clamp((talent.starPower - 5) * 0.015 + (talent.craftScore - 5) * 0.01, 0, 0.16);
    const egoPenalty = clamp((talent.egoLevel - 5) * 0.018, -0.04, 0.16);
    const agentPenalty = clamp((AGENT_DIFFICULTY[talent.agentTier] - 1) * 0.2, 0, 0.12);
    const grudgePenalty = clamp(outlook.grudgeScore / TALENT_NEGOTIATION_RULES.CHANCE_PENALTY_GRUDGE_DIVISOR, 0, 0.2);
    const refusalPenalty = outlook.refusalRisk === 'critical' ? 0.04 : outlook.refusalRisk === 'elevated' ? 0.02 : 0;
    const executiveBoost = manager.executiveNetworkLevel * 0.015;
    return clamp(
        base + relationshipBoost + heatBoost + arcLeverage + executiveBoost - reputationPenalty - egoPenalty - agentPenalty - grudgePenalty - refusalPenalty,
        0.08,
        0.95
    );
}

export function evaluateNegotiationForManager(
    manager: TalentManagerAdapter,
    negotiation: PlayerNegotiation,
    talent: Talent,
    baseChance = 0.7
): NegotiationEvaluation {
    const terms = readNegotiationTermsForManager(negotiation, talent);
    const demand = demandedNegotiationTermsForManager(talent);
    const salaryFit = clamp(terms.salaryMultiplier / Math.max(0.01, demand.salaryMultiplier), 0, 1.25);
    const backendFit = clamp(terms.backendPoints / Math.max(0.01, demand.backendPoints), 0, 1.25);
    const perksFit = clamp(terms.perksBudget / Math.max(1, demand.perksBudget), 0, 1.25);
    const termsScore = salaryFit * 0.5 + backendFit * 0.25 + perksFit * 0.25;
    const rounds = negotiation.rounds ?? 0;
    const hardline = negotiation.holdLineCount ?? 0;
    const termsBoost = (termsScore - 0.72) * 0.34;
    const fatiguePenalty = Math.max(0, rounds - 1) * 0.055;
    const hardlinePenalty = hardline * 0.05;
    const chance = clamp(
        talentDealChanceForManager(manager, talent, baseChance) + termsBoost - fatiguePenalty - hardlinePenalty,
        0.05,
        0.97
    );

    return { chance, salaryFit, backendFit, perksFit, termsScore, demand };
}

export function finalizeTalentAttachmentForManager(
    manager: TalentManagerAdapter,
    project: MovieProject,
    talent: Talent,
    terms?: NegotiationTerms
): boolean {
    const normalizedTerms = terms ?? defaultNegotiationTermsForManager(talent);
    const retainer = computeDealMemoCostForManager(talent, normalizedTerms);
    if (manager.cash < retainer) {
        talent.availability = 'available';
        recordTalentInteractionForManager(manager, talent, {
            kind: 'dealStalled',
            trustDelta: -5,
            loyaltyDelta: -4,
            note: `Deal memo for ${project.title} failed due to insufficient retainer cash.`,
            projectId: project.id,
        });
        return false;
    }
    manager.adjustCash(-retainer);
    project.budget.actualSpend += retainer * 0.35;
    const backendPoints = normalizedTerms.backendPoints;
    project.studioRevenueShare = clamp(project.studioRevenueShare - backendPoints * 0.004, 0.35, 0.8);
    talent.availability = 'attached';
    talent.unavailableUntilWeek = null;
    talent.attachedProjectId = project.id;
    if (talent.role === 'director') {
        project.directorId = talent.id;
    } else if (talent.role === 'leadActor' || talent.role === 'supportingActor') {
        if (!project.castIds.includes(talent.id)) {
            project.castIds.push(talent.id);
        }
    }
    project.hypeScore = clamp(project.hypeScore + talent.starPower * 0.8, 0, 100);
    recordTalentInteractionForManager(manager, talent, {
        kind: 'dealSigned',
        trustDelta: 5,
        loyaltyDelta: 6,
        note: `Signed onto ${project.title}.`,
        projectId: project.id,
    });
    return true;
}

export function negotiationPressurePointForManager(evaluation: NegotiationEvaluation): 'salary' | 'backend' | 'perks' {
    if (evaluation.salaryFit <= evaluation.backendFit && evaluation.salaryFit <= evaluation.perksFit) return 'salary';
    if (evaluation.backendFit <= evaluation.salaryFit && evaluation.backendFit <= evaluation.perksFit) return 'backend';
    return 'perks';
}

export function composeNegotiationPreviewForManager(
    talentName: string,
    evaluation: NegotiationEvaluation,
    holdLineCount: number
): string {
    if (holdLineCount >= 2) {
        return `${talentName}'s reps are signaling standoff risk after repeated hardline rounds.`;
    }
    const pressurePoint = negotiationPressurePointForManager(evaluation);
    if (pressurePoint === 'salary') {
        return `${talentName}'s reps say salary is the primary gap in the package.`;
    }
    if (pressurePoint === 'backend') {
        return `${talentName}'s reps are pushing hardest on backend participation.`;
    }
    return `${talentName}'s reps want stronger perks and support terms.`;
}

export function composeNegotiationSignalForManager(
    talentName: string,
    evaluation: NegotiationEvaluation,
    accepted: boolean,
    holdLineCount: number
): string {
    if (accepted) {
        if (evaluation.salaryFit < 0.95) {
            return `${talentName} accepted, but flagged salary as the thin part of the deal.`;
        }
        if (evaluation.backendFit < 0.9) {
            return `${talentName} accepted, with notes that backend points were below preferred terms.`;
        }
        if (evaluation.perksFit < 0.9) {
            return `${talentName} accepted after prioritizing schedule and perks concessions.`;
        }
        return `${talentName} accepted terms with strong alignment across the package.`;
    }

    if (holdLineCount >= 2) {
        return `${talentName} declined after repeated hardline rounds. Reps called the package static.`;
    }
    if (evaluation.salaryFit < 0.9) {
        return `${talentName} declined: salary floor not met.`;
    }
    if (evaluation.backendFit < 0.85) {
        return `${talentName} declined: backend participation came in light.`;
    }
    if (evaluation.perksFit < 0.8) {
        return `${talentName} declined: package support and perks were below ask.`;
    }
    return `${talentName} declined final terms after mixed signals from reps.`;
}
