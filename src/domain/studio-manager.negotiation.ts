import type { NegotiationAction, PlayerNegotiation } from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface NegotiationSnapshot {
  salaryMultiplier: number;
  backendPoints: number;
  perksBudget: number;
  rounds: number;
  holdLineCount: number;
  chance: number;
  signal: string;
  pressurePoint: 'salary' | 'backend' | 'perks';
  roundsRemaining: number;
  demandSalaryMultiplier: number;
  demandBackendPoints: number;
  demandPerksBudget: number;
}

export function getNegotiationChanceForManager(manager: any, talentId: string, projectId?: string): number | null {
  const talent = manager.talentPool.find((item: any) => item.id === talentId);
  if (!talent) return null;
  const negotiation = manager.findNegotiation(talentId, projectId);
  if (!negotiation) return manager.talentDealChance(talent, 0.7);
  return manager.evaluateNegotiation(negotiation, talent).chance;
}

export function getQuickCloseChanceForManager(manager: any, talentId: string): number | null {
  const talent = manager.talentPool.find((item: any) => item.id === talentId);
  if (!talent) return null;
  const quickTerms = manager.buildQuickCloseTerms(talent);
  return manager.evaluateNegotiation(
    {
      talentId,
      projectId: '',
      openedWeek: manager.currentWeek,
      rounds: 1,
      holdLineCount: 0,
      offerSalaryMultiplier: quickTerms.salaryMultiplier,
      offerBackendPoints: quickTerms.backendPoints,
      offerPerksBudget: quickTerms.perksBudget,
    },
    talent,
    0.72
  ).chance;
}

export function getNegotiationSnapshotForManager(manager: any, projectId: string, talentId: string): NegotiationSnapshot | null {
  const talent = manager.talentPool.find((item: any) => item.id === talentId);
  if (!talent) return null;
  const negotiation = manager.findNegotiation(talentId, projectId);
  if (!negotiation) return null;

  const normalized = manager.normalizeNegotiation(negotiation, talent);
  const evaluation = manager.evaluateNegotiation(normalized, talent);
  const signal =
    normalized.lastResponse ?? manager.composeNegotiationPreview(talent.name, evaluation, normalized.holdLineCount ?? 0);

  return {
    salaryMultiplier: normalized.offerSalaryMultiplier ?? 1,
    backendPoints: normalized.offerBackendPoints ?? talent.salary.backendPoints,
    perksBudget: normalized.offerPerksBudget ?? talent.salary.perksCost,
    rounds: normalized.rounds ?? 0,
    holdLineCount: normalized.holdLineCount ?? 0,
    chance: evaluation.chance,
    signal,
    pressurePoint: manager.negotiationPressurePoint(evaluation),
    roundsRemaining: Math.max(0, 4 - (normalized.rounds ?? 0)),
    demandSalaryMultiplier: evaluation.demand.salaryMultiplier,
    demandBackendPoints: evaluation.demand.backendPoints,
    demandPerksBudget: evaluation.demand.perksBudget,
  };
}

export function adjustTalentNegotiationForManager(
  manager: any,
  projectId: string,
  talentId: string,
  action: NegotiationAction
): { success: boolean; message: string } {
  const talent = manager.talentPool.find((item: any) => item.id === talentId);
  if (!talent) return { success: false, message: 'Talent not found.' };
  const project = manager.activeProjects.find((item: any) => item.id === projectId);
  if (!project) return { success: false, message: 'Project not found.' };
  const negotiation = manager.findNegotiation(talentId, projectId);
  if (!negotiation) return { success: false, message: 'No open negotiation for this project and talent.' };
  if (talent.availability !== 'inNegotiation') return { success: false, message: `${talent.name} is not currently in negotiation.` };
  if (project.phase !== 'development') return { success: false, message: 'Negotiation can only be adjusted during development.' };

  const normalized = manager.normalizeNegotiation(negotiation, talent);
  const rounds = normalized.rounds ?? 0;
  if (rounds >= 4) {
    return { success: false, message: `Negotiation with ${talent.name} is out of rounds. Resolve it at End Turn.` };
  }

  if (action === 'sweetenSalary') {
    normalized.offerSalaryMultiplier = clamp((normalized.offerSalaryMultiplier ?? 1) + 0.06, 1, 1.5);
    normalized.holdLineCount = Math.max(0, (normalized.holdLineCount ?? 0) - 1);
    manager.recordTalentInteraction(talent, {
      kind: 'negotiationSweetened',
      trustDelta: 1,
      loyaltyDelta: 0,
      note: `Improved salary terms on ${project.title}.`,
      projectId,
    });
  } else if (action === 'sweetenBackend') {
    normalized.offerBackendPoints = clamp((normalized.offerBackendPoints ?? talent.salary.backendPoints) + 0.5, 0, 10);
    normalized.holdLineCount = Math.max(0, (normalized.holdLineCount ?? 0) - 1);
    manager.recordTalentInteraction(talent, {
      kind: 'negotiationSweetened',
      trustDelta: 1,
      loyaltyDelta: 1,
      note: `Improved backend terms on ${project.title}.`,
      projectId,
    });
  } else if (action === 'sweetenPerks') {
    normalized.offerPerksBudget = Math.min(
      talent.salary.perksCost * 3,
      Math.max(talent.salary.perksCost * 0.4, Math.round((normalized.offerPerksBudget ?? talent.salary.perksCost) + 60_000))
    );
    normalized.holdLineCount = Math.max(0, (normalized.holdLineCount ?? 0) - 1);
    manager.recordTalentInteraction(talent, {
      kind: 'negotiationSweetened',
      trustDelta: 1,
      loyaltyDelta: 0,
      note: `Expanded support/perks package on ${project.title}.`,
      projectId,
    });
  } else if (action === 'holdFirm') {
    normalized.holdLineCount = (normalized.holdLineCount ?? 0) + 1;
    manager.recordTalentInteraction(talent, {
      kind: 'negotiationHardline',
      trustDelta: -2,
      loyaltyDelta: -1,
      note: `Held firm on current package for ${project.title}.`,
      projectId,
    });
  }

  normalized.rounds = rounds + 1;
  const evaluation = manager.evaluateNegotiation(normalized, talent);
  normalized.lastComputedChance = evaluation.chance;
  normalized.lastResponse = manager.composeNegotiationPreview(talent.name, evaluation, normalized.holdLineCount ?? 0);

  Object.assign(negotiation, normalized);
  return {
    success: true,
    message: `${talent.name} negotiation round ${normalized.rounds}: ${normalized.lastResponse} Close chance ${Math.round(
      evaluation.chance * 100
    )}%.`,
  };
}

export function startTalentNegotiationForManager(
  manager: any,
  projectId: string,
  talentId: string
): { success: boolean; message: string } {
  const project = manager.activeProjects.find((item: any) => item.id === projectId);
  if (!project) return { success: false, message: 'Project not found.' };
  if (project.phase !== 'development') {
    return { success: false, message: 'Talent negotiations can only be opened for development projects.' };
  }

  const talent = manager.talentPool.find((item: any) => item.id === talentId);
  if (!talent) return { success: false, message: 'Talent not found.' };
  if (talent.availability !== 'available') {
    const returns = talent.unavailableUntilWeek ? ` (returns week ${talent.unavailableUntilWeek})` : '';
    return { success: false, message: `${talent.name} is unavailable${returns}.` };
  }
  if (manager.playerNegotiations.some((item: any) => item.talentId === talentId)) {
    return { success: false, message: `${talent.name} is already in negotiation.` };
  }

  talent.availability = 'inNegotiation';
  const negotiation: PlayerNegotiation = {
    talentId,
    projectId,
    openedWeek: manager.currentWeek,
    rounds: 0,
    holdLineCount: 0,
    offerSalaryMultiplier: 1,
    offerBackendPoints: talent.salary.backendPoints,
    offerPerksBudget: talent.salary.perksCost,
    lastComputedChance: manager.talentDealChance(talent, 0.7),
    lastResponse: 'Initial offer package sent.',
  };
  manager.playerNegotiations.push(negotiation);
  manager.recordTalentInteraction(talent, {
    kind: 'negotiationOpened',
    trustDelta: 1,
    loyaltyDelta: 0,
    note: `Opened negotiations for ${project.title}.`,
    projectId,
  });
  const chance = manager.evaluateNegotiation(negotiation, talent).chance;
  return {
    success: true,
    message: `Opened negotiation with ${talent.name}. Package starts at salary 1.00x, backend ${talent.salary.backendPoints.toFixed(
      1
    )}, perks ${Math.round(talent.salary.perksCost / 1000)}K. Close chance ${Math.round(chance * 100)}% at next End Turn.`,
  };
}

export function negotiateAndAttachTalentForManager(
  manager: any,
  projectId: string,
  talentId: string
): { success: boolean; message: string } {
  const project = manager.activeProjects.find((item: any) => item.id === projectId);
  if (!project) return { success: false, message: 'Project not found.' };
  if (project.phase !== 'development') {
    return { success: false, message: 'Talent attachments can only be closed for development projects.' };
  }

  const talent = manager.talentPool.find((item: any) => item.id === talentId);
  if (!talent) return { success: false, message: 'Talent not found.' };
  if (talent.availability !== 'available') {
    const returns = talent.unavailableUntilWeek ? ` (returns week ${talent.unavailableUntilWeek})` : '';
    return { success: false, message: `${talent.name} is unavailable${returns}.` };
  }

  const quickTerms = manager.buildQuickCloseTerms(talent);
  const chance = manager.evaluateNegotiation(
    {
      talentId,
      projectId,
      openedWeek: manager.currentWeek,
      rounds: 1,
      holdLineCount: 0,
      offerSalaryMultiplier: quickTerms.salaryMultiplier,
      offerBackendPoints: quickTerms.backendPoints,
      offerPerksBudget: quickTerms.perksBudget,
    },
    talent,
    0.72
  ).chance;
  const retainer = manager.computeDealMemoCost(talent, quickTerms);
  const attemptFee = manager.computeQuickCloseAttemptFee(talent, quickTerms);
  if (manager.cash < retainer + attemptFee) {
    return { success: false, message: 'Insufficient funds for quick-close attempt and deal memo retainer.' };
  }

  manager.adjustCash(-attemptFee);
  if (manager.negotiationRng() > chance) {
    manager.setNegotiationCooldown(talent, 1);
    manager.recordTalentInteraction(talent, {
      kind: 'quickCloseFailed',
      trustDelta: -3,
      loyaltyDelta: -2,
      note: `Quick-close attempt failed for ${project.title}.`,
      projectId,
    });
    return {
      success: false,
      message: `${talent.name}'s reps declined quick-close terms. Attempt cost ${Math.round(
        attemptFee / 1000
      )}K burned. Re-open next week.`,
    };
  }
  if (!manager.finalizeTalentAttachment(project, talent, quickTerms)) {
    return { success: false, message: `Deal memo failed for ${talent.name}; cash is below retainer.` };
  }
  manager.recordTalentInteraction(talent, {
    kind: 'quickCloseSuccess',
    trustDelta: 2,
    loyaltyDelta: 2,
    note: `Quick-close landed for ${project.title}.`,
    projectId,
  });
  return { success: true, message: `${talent.name} attached to ${project.title}.` };
}

export function processPlayerNegotiationsForManager(manager: any, events: string[]): void {
  const resolved: string[] = [];
  for (const negotiation of manager.playerNegotiations) {
    if (manager.currentWeek - negotiation.openedWeek < 1) continue;
    const talent = manager.talentPool.find((item: any) => item.id === negotiation.talentId);
    const project = manager.activeProjects.find((item: any) => item.id === negotiation.projectId);
    if (!talent || !project) {
      if (talent?.availability === 'inNegotiation') {
        talent.availability = 'available';
      }
      resolved.push(negotiation.talentId);
      continue;
    }
    if (talent.availability !== 'inNegotiation') {
      resolved.push(negotiation.talentId);
      continue;
    }
    if (project.phase !== 'development') {
      talent.availability = 'available';
      events.push(`Negotiation window closed for ${talent.name}; ${project.title} moved out of development.`);
      manager.recordTalentInteraction(talent, {
        kind: 'negotiationDeclined',
        trustDelta: -1,
        loyaltyDelta: -2,
        note: `Negotiation closed when ${project.title} moved out of development.`,
        projectId: project.id,
      });
      resolved.push(negotiation.talentId);
      continue;
    }

    const normalized = manager.normalizeNegotiation(negotiation, talent);
    const evaluation = manager.evaluateNegotiation(normalized, talent);
    normalized.lastComputedChance = evaluation.chance;
    if (manager.negotiationRng() <= evaluation.chance) {
      if (manager.finalizeTalentAttachment(project, talent, manager.readNegotiationTerms(normalized, talent))) {
        events.push(manager.composeNegotiationSignal(talent.name, evaluation, true, normalized.holdLineCount ?? 0));
      } else {
        manager.setNegotiationCooldown(talent, 1);
        events.push(`${talent.name} accepted in principle, but retainer cash came up short and the deal stalled.`);
      }
    } else {
      manager.setNegotiationCooldown(talent, 1);
      manager.recordTalentInteraction(talent, {
        kind: 'negotiationDeclined',
        trustDelta: -3,
        loyaltyDelta: -2,
        note: `Declined final terms for ${project.title}.`,
        projectId: project.id,
      });
      events.push(manager.composeNegotiationSignal(talent.name, evaluation, false, normalized.holdLineCount ?? 0));
    }
    resolved.push(negotiation.talentId);
  }
  if (resolved.length > 0) {
    manager.playerNegotiations = manager.playerNegotiations.filter((item: any) => !resolved.includes(item.talentId));
  }
}
