import type {
  CrisisEvent,
  DecisionItem,
  DistributionOffer,
  InboxNotification,
  MovieProject,
  PlayerNegotiation,
  RivalStudio,
  ScriptPitch,
  Talent,
} from '@/src/domain/types';

type SigPart = string | number | boolean | null | undefined;

function encode(value: SigPart): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[|:,]/g, '_');
}

function joinParts(parts: SigPart[]): string {
  return parts.map((part) => encode(part)).join(':');
}

export function buildInboxCrisesSignature(crises: CrisisEvent[]): string {
  return crises
    .map((crisis) => {
      const options = crisis.options
        .map((option) =>
          joinParts([
            option.id,
            option.label,
            option.preview,
            option.cashDelta,
            option.scheduleDelta,
            option.hypeDelta,
            option.releaseWeekShift ?? '',
          ])
        )
        .join(',');
      return joinParts([
        crisis.id,
        crisis.projectId,
        crisis.kind,
        crisis.title,
        crisis.severity,
        crisis.body,
        options,
      ]);
    })
    .join('|');
}

export function buildInboxDecisionsSignature(decisions: DecisionItem[]): string {
  return decisions
    .map((decision) => {
      const options = decision.options
        .map((option) =>
          joinParts([
            option.id,
            option.label,
            option.preview,
            option.cashDelta,
            option.scriptQualityDelta,
            option.hypeDelta,
            option.studioHeatDelta ?? '',
            option.scheduleDelta ?? '',
            option.releaseWeekShift ?? '',
            option.marketingDelta ?? '',
          ])
        )
        .join(',');
      return joinParts([
        decision.id,
        decision.projectId ?? 'studio',
        decision.title,
        decision.body,
        decision.weeksUntilExpiry,
        decision.category ?? '',
        options,
      ]);
    })
    .join('|');
}

export function buildInboxNotificationsSignature(items: InboxNotification[]): string {
  return items
    .map((item) => joinParts([item.id, item.week, item.kind, item.projectId ?? 'studio', item.title, item.body]))
    .join('|');
}

export function buildInboxProjectsSignature(projects: MovieProject[]): string {
  return projects
    .map((project) => joinParts([project.id, project.title, project.phase, project.releaseWeek ?? '', project.releaseResolved]))
    .join('|');
}

export function buildSlateProjectsSignature(projects: MovieProject[]): string {
  return projects
    .map((project) =>
      joinParts([
        project.id,
        project.title,
        project.genre,
        project.phase,
        project.scheduledWeeksRemaining,
        project.budget.actualSpend,
        project.budget.ceiling,
        project.releaseWeek ?? '',
        project.directorId ?? '',
        project.castIds.join(','),
        project.hypeScore,
        project.projectedROI,
      ])
    )
    .join('|');
}

export function buildSlateScriptsSignature(scripts: ScriptPitch[]): string {
  return scripts
    .map((script) =>
      joinParts([
        script.id,
        script.title,
        script.genre,
        script.askingPrice,
        script.scriptQuality,
        script.conceptStrength,
        script.expiresInWeeks,
      ])
    )
    .join('|');
}

export function buildSlateOffersSignature(offers: DistributionOffer[]): string {
  return offers
    .map((offer) =>
      joinParts([
        offer.id,
        offer.projectId,
        offer.partner,
        offer.releaseWindow,
        offer.minimumGuarantee,
        offer.pAndACommitment,
        offer.revenueShareToStudio,
        offer.counterAttempts,
      ])
    )
    .join('|');
}

export function buildSlateRivalsSignature(rivals: RivalStudio[]): string {
  return rivals
    .map((rival) =>
      joinParts([
        rival.id,
        rival.name,
        rival.studioHeat,
        rival.upcomingReleases
          .map((film) => joinParts([film.id, film.title, film.genre, film.releaseWeek, film.estimatedBudget]))
          .join(','),
      ])
    )
    .join('|');
}

export function buildBoxOfficeReleasedSignature(projects: MovieProject[]): string {
  return projects
    .filter((project) => project.phase === 'released')
    .map((project) =>
      joinParts([
        project.id,
        project.title,
        project.phase,
        project.finalBoxOffice ?? '',
        project.projectedROI,
        project.budget.ceiling,
        project.marketingBudget,
        project.criticalScore ?? '',
        project.audienceScore ?? '',
        project.openingWeekendGross ?? '',
        project.awardsNominations,
        project.awardsWins,
        project.studioRevenueShare,
        project.distributionPartner ?? '',
      ])
    )
    .join('|');
}

export function buildReleaseReportsSignature(reports: {
  projectId: string;
  weekResolved: number;
  roi: number;
  totalBudget: number;
  totalGross: number;
  profit: number;
}[]): string {
  return reports
    .map((report) =>
      joinParts([
        report.projectId,
        report.weekResolved,
        report.roi,
        report.totalBudget,
        report.totalGross,
        report.profit,
      ])
    )
    .join('|');
}

export function buildTalentProjectsSignature(projects: MovieProject[]): string {
  return projects
    .filter((project) => project.phase === 'development')
    .map((project) =>
      joinParts([
        project.id,
        project.title,
        project.genre,
        project.scriptQuality,
        project.directorId ?? 'none',
        project.castIds.join(','),
        project.hypeScore,
        project.budget.actualSpend,
        project.scheduledWeeksRemaining,
      ])
    )
    .join('|');
}

export function buildTalentPoolSignature(talentPool: Talent[]): string {
  return talentPool
    .map((talent) => {
      const memory = talent.relationshipMemory;
      const memoryTail = memory.interactionHistory
        .slice(-3)
        .map((entry) =>
          joinParts([entry.week, entry.kind, entry.trustDelta, entry.loyaltyDelta, entry.projectId ?? 'none'])
        )
        .join(',');
      const genreFit = Object.entries(talent.genreFit)
        .map(([genre, fit]) => joinParts([genre, fit]))
        .join(',');
      return joinParts([
        talent.id,
        talent.role,
        talent.availability,
        talent.attachedProjectId ?? 'none',
        talent.unavailableUntilWeek ?? '',
        talent.marketWindowExpiresWeek ?? '',
        talent.starPower,
        talent.craftScore,
        talent.egoLevel,
        talent.agentTier,
        talent.reputation,
        talent.studioRelationship,
        memory.trust,
        memory.loyalty,
        memoryTail,
        genreFit,
      ]);
    })
    .join('|');
}

export function buildTalentNegotiationSignature(negotiations: PlayerNegotiation[]): string {
  return negotiations
    .map((negotiation) =>
      joinParts([
        negotiation.talentId,
        negotiation.projectId,
        negotiation.openedWeek,
        negotiation.rounds ?? 0,
        negotiation.holdLineCount ?? 0,
        negotiation.offerSalaryMultiplier ?? '',
        negotiation.offerBackendPoints ?? '',
        negotiation.offerPerksBudget ?? '',
        negotiation.lastComputedChance ?? '',
        negotiation.lastResponse ?? '',
      ])
    )
    .join('|');
}

export function buildTalentRivalsSignature(rivals: RivalStudio[]): string {
  return rivals
    .map((rival) =>
      joinParts([
        rival.id,
        rival.studioHeat,
        rival.lockedTalentIds.join(','),
        rival.memory.hostility,
        rival.memory.respect,
        rival.memory.retaliationBias,
        rival.memory.cooperationBias,
      ])
    )
    .join('|');
}
