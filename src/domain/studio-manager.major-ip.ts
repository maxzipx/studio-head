import type { MovieProject, OwnedIp } from './types';
import {
  MAJOR_IP_CONTRACT_RULES,
  majorIpBreachedKey,
  majorIpDeadlineKey,
  majorIpRemainingKey,
  majorIpTotalKey,
} from './studio-manager.constants';

export interface MajorIpCommitmentSnapshot {
  ipId: string;
  name: string;
  remainingReleases: number;
  requiredReleases: number;
  deadlineWeek: number;
  breached: boolean;
  hasActiveInstallment: boolean;
  isBlocking: boolean;
}

function hasActiveInstallmentForIpForManager(manager: any, ipId: string): boolean {
  return manager.activeProjects.some((project: MovieProject) => project.adaptedFromIpId === ipId && !project.releaseResolved);
}

export function initializeMajorIpCommitmentForManager(
  manager: any,
  ip: OwnedIp
): { required: number; deadlineWeek: number } | null {
  if (!ip.major) return null;
  const remainingKey = majorIpRemainingKey(ip.id);
  const totalKey = majorIpTotalKey(ip.id);
  const deadlineKey = majorIpDeadlineKey(ip.id);
  const breachedKey = majorIpBreachedKey(ip.id);

  const existingRemaining = Math.max(0, Math.round(manager.storyFlags[remainingKey] ?? 0));
  const existingTotal = Math.max(0, Math.round(manager.storyFlags[totalKey] ?? 0));
  const existingDeadline = Math.round(manager.storyFlags[deadlineKey] ?? 0);

  const required = Math.max(existingTotal, existingRemaining, MAJOR_IP_CONTRACT_RULES.REQUIRED_RELEASES);
  const deadlineWeek =
    existingDeadline > 0 ? existingDeadline : manager.currentWeek + MAJOR_IP_CONTRACT_RULES.DEADLINE_WEEKS;

  manager.storyFlags[remainingKey] = Math.max(existingRemaining, required);
  manager.storyFlags[totalKey] = required;
  manager.storyFlags[deadlineKey] = deadlineWeek;
  manager.storyFlags[breachedKey] = manager.storyFlags[breachedKey] ?? 0;
  return { required, deadlineWeek };
}

export function getBlockingMajorIpCommitmentForManager(
  manager: any,
  targetIpId?: string
): { ip: OwnedIp; remaining: number; deadlineWeek: number } | null {
  const ownedMajorIps = manager.ownedIps.filter((ip: OwnedIp) => ip.major && (manager.storyFlags[`owned_ip_${ip.id}`] ?? 0) > 0);
  const pending = ownedMajorIps
    .map((ip: OwnedIp) => {
      const remaining = Math.max(0, Math.round(manager.storyFlags[majorIpRemainingKey(ip.id)] ?? 0));
      const deadlineWeek = Math.round(manager.storyFlags[majorIpDeadlineKey(ip.id)] ?? manager.currentWeek);
      return { ip, remaining, deadlineWeek };
    })
    .filter((entry: { remaining: number }) => entry.remaining > 0)
    .sort((a: { deadlineWeek: number }, b: { deadlineWeek: number }) => a.deadlineWeek - b.deadlineWeek);

  for (const entry of pending) {
    if (targetIpId && entry.ip.id === targetIpId) continue;
    if (hasActiveInstallmentForIpForManager(manager, entry.ip.id)) continue;
    return entry;
  }
  return null;
}

export function getMajorIpCommitmentsForManager(manager: any): MajorIpCommitmentSnapshot[] {
  const result: MajorIpCommitmentSnapshot[] = [];
  const blocking = getBlockingMajorIpCommitmentForManager(manager);
  for (const ip of manager.ownedIps.filter((item: OwnedIp) => item.major)) {
    const owned = (manager.storyFlags[`owned_ip_${ip.id}`] ?? 0) > 0;
    if (!owned) continue;
    const remaining = Math.max(0, Math.round(manager.storyFlags[majorIpRemainingKey(ip.id)] ?? 0));
    const requiredReleases = Math.max(
      remaining,
      Math.round(manager.storyFlags[majorIpTotalKey(ip.id)] ?? MAJOR_IP_CONTRACT_RULES.REQUIRED_RELEASES)
    );
    const deadlineWeek = Math.round(
      manager.storyFlags[majorIpDeadlineKey(ip.id)] ?? manager.currentWeek + MAJOR_IP_CONTRACT_RULES.DEADLINE_WEEKS
    );
    const breached = (manager.storyFlags[majorIpBreachedKey(ip.id)] ?? 0) > 0;
    if (remaining <= 0 && !breached) continue;
    const hasActiveInstallment = hasActiveInstallmentForIpForManager(manager, ip.id);
    result.push({
      ipId: ip.id,
      name: ip.name,
      remainingReleases: remaining,
      requiredReleases,
      deadlineWeek,
      breached,
      hasActiveInstallment,
      isBlocking: blocking?.ip.id === ip.id,
    });
  }
  return result.sort((a, b) => a.deadlineWeek - b.deadlineWeek);
}

export function applyMajorIpReleaseProgressForManager(manager: any, project: MovieProject, events: string[]): void {
  const ipId = project.adaptedFromIpId;
  if (!ipId) return;
  const ip = manager.ownedIps.find((entry: OwnedIp) => entry.id === ipId);
  if (!ip?.major) return;

  const remainingKey = majorIpRemainingKey(ip.id);
  const totalKey = majorIpTotalKey(ip.id);
  const deadlineKey = majorIpDeadlineKey(ip.id);

  const remaining = Math.max(0, Math.round(manager.storyFlags[remainingKey] ?? 0));
  if (remaining <= 0) return;

  const requiredReleases = Math.max(remaining, Math.round(manager.storyFlags[totalKey] ?? MAJOR_IP_CONTRACT_RULES.REQUIRED_RELEASES));
  const deadlineWeek = Math.round(
    manager.storyFlags[deadlineKey] ?? manager.currentWeek + MAJOR_IP_CONTRACT_RULES.DEADLINE_WEEKS
  );
  const nextRemaining = Math.max(0, remaining - 1);
  manager.storyFlags[remainingKey] = nextRemaining;
  const delivered = requiredReleases - nextRemaining;

  if (nextRemaining === 0) {
    events.push(`${ip.name} contract fulfilled (${delivered}/${requiredReleases} releases delivered).`);
    manager.addChronicleEntry({
      week: manager.currentWeek,
      type: 'arcResolution',
      headline: `${ip.name} contract fulfilled`,
      detail: `Delivered ${requiredReleases} release(s) by week ${manager.currentWeek}.`,
      impact: 'positive',
    });
    return;
  }

  events.push(
    `${ip.name} contract progress: ${delivered}/${requiredReleases} delivered. ${nextRemaining} release(s) remain by week ${deadlineWeek}.`
  );
  if (deadlineWeek - manager.currentWeek <= 26) {
    events.push(`${ip.name} contract warning: ${deadlineWeek - manager.currentWeek} week(s) left to deliver remaining releases.`);
  }
}

export function evaluateMajorIpContractBreachesForManager(manager: any, events: string[]): void {
  for (const ip of manager.ownedIps.filter((entry: OwnedIp) => entry.major && (manager.storyFlags[`owned_ip_${entry.id}`] ?? 0) > 0)) {
    const remainingKey = majorIpRemainingKey(ip.id);
    const breachedKey = majorIpBreachedKey(ip.id);
    const deadlineKey = majorIpDeadlineKey(ip.id);
    const totalKey = majorIpTotalKey(ip.id);
    const remaining = Math.max(0, Math.round(manager.storyFlags[remainingKey] ?? 0));
    if (remaining <= 0) continue;
    const alreadyBreached = (manager.storyFlags[breachedKey] ?? 0) > 0;
    if (alreadyBreached) continue;
    const deadlineWeek = Math.round(manager.storyFlags[deadlineKey] ?? manager.currentWeek);
    if (manager.currentWeek <= deadlineWeek) continue;

    const required = Math.max(remaining, Math.round(manager.storyFlags[totalKey] ?? MAJOR_IP_CONTRACT_RULES.REQUIRED_RELEASES));
    manager.storyFlags[breachedKey] = 1;
    manager.storyFlags[remainingKey] = 0;
    manager.adjustCash(-MAJOR_IP_CONTRACT_RULES.BREACH_CASH_PENALTY);
    manager.adjustReputation(MAJOR_IP_CONTRACT_RULES.BREACH_DISTRIBUTOR_DELTA, 'distributor');
    manager.adjustReputation(MAJOR_IP_CONTRACT_RULES.BREACH_TALENT_DELTA, 'talent');
    manager.adjustReputation(MAJOR_IP_CONTRACT_RULES.BREACH_AUDIENCE_DELTA, 'audience');
    events.push(
      `${ip.name} major-IP contract breached (${required - remaining}/${required} delivered). Penalty ${MAJOR_IP_CONTRACT_RULES.BREACH_CASH_PENALTY.toLocaleString()} and reputation damage applied.`
    );
    manager.addChronicleEntry({
      week: manager.currentWeek,
      type: 'arcResolution',
      headline: `${ip.name} contract default`,
      detail: `${remaining} required release(s) missed by week ${deadlineWeek}.`,
      impact: 'negative',
    });
  }
}
