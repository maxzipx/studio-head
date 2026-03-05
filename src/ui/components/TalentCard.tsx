/**
 * TalentCard — displays a single talent's stats, relationship info, and
 * negotiation/attach actions.
 *
 * Extracted from app/(tabs)/talent.tsx to allow independent memoization and
 * reuse across market and roster sections.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { StudioManager } from '@/src/domain/studio-manager';
import type { MovieProject, Talent } from '@/src/domain/types';
import { colors, radius, spacing, typography } from '@/src/ui/tokens';
import {
  agencyLabel,
  craftGrade,
  craftGradeColor,
  interactionLabel,
  pct,
  refusalRiskColor,
  roleLabel,
  trustLevelColor,
  trustLevelLabel,
} from '@/src/ui/helpers/formatting';
import { GlassCard } from './GlassCard';
import { PremiumButton } from './PremiumButton';
import { ProgressBar } from './ProgressBar';
import { SectionLabel } from './SectionLabel';
import { StarRating } from './StarRating';

export interface TalentCardProps {
  talent: Talent;
  manager: StudioManager;
  activeProject: MovieProject | null;
  openNegotiationModal: (talentId: string) => void;
  attachTalent: (projectId: string, talentId: string) => void;
  showCountdown: boolean;
}

export const TalentCard = React.memo(function TalentCard({
  talent,
  manager,
  activeProject,
  openNegotiationModal,
  attachTalent,
  showCountdown,
}: TalentCardProps) {
  const isAvailable = talent.availability === 'available';
  const [detailsOpen, setDetailsOpen] = useState(false);
  const rival = manager.rivals.find((r) => r.lockedTalentIds.includes(talent.id));
  const attachedProject =
    talent.attachedProjectId && manager.activeProjects.find((p) => p.id === talent.attachedProjectId);
  const trustLevel = manager.getTalentTrustLevel(talent);
  const trust = talent.relationshipMemory?.trust ?? Math.round(talent.studioRelationship * 100);
  const loyalty = talent.relationshipMemory?.loyalty ?? Math.round(talent.studioRelationship * 100);
  const outlook = manager.getTalentNegotiationOutlook(talent);
  const targetChance = activeProject ? manager.getNegotiationChance(talent.id, activeProject.id) : null;
  const recentMemory = [...(talent.relationshipMemory?.interactionHistory ?? [])].slice(-3).reverse();
  const trustColor = trustLevelColor(trustLevel);

  const weeksLeft =
    showCountdown && talent.marketWindowExpiresWeek !== null
      ? Math.max(0, talent.marketWindowExpiresWeek - manager.currentWeek)
      : null;

  const windowUrgent = weeksLeft !== null && weeksLeft <= 1;
  const windowWarning = weeksLeft !== null && weeksLeft === 2;

  return (
    <GlassCard
      variant={!isAvailable ? 'elevated' : 'default'}
      style={{ gap: spacing.sp2, opacity: !isAvailable ? 0.82 : 1 }}
    >
      {/* Row 1: Name + window countdown */}
      <View style={styles.talentHeader}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.talentName}>{talent.name}</Text>
          <Text style={styles.talentRole}>{roleLabel(talent.role)} - {agencyLabel(talent.agentTier)}</Text>
        </View>
        <View style={styles.badgeGroup}>
          {weeksLeft !== null && (
            <View style={[styles.windowChip, {
              borderColor: windowUrgent ? colors.accentRed + '70' : windowWarning ? colors.goldMid + '70' : colors.borderDefault,
              backgroundColor: windowUrgent ? colors.accentRed + '10' : windowWarning ? colors.goldMid + '10' : colors.bgElevated,
            }]}>
              <Text style={[styles.windowText, {
                color: windowUrgent ? colors.accentRed : windowWarning ? colors.goldMid : colors.textMuted,
              }]}>
                {weeksLeft === 0 ? 'Expires' : `${weeksLeft}w left`}
              </Text>
            </View>
          )}
          {!isAvailable && (
            <View style={[styles.availBadge, { borderColor: colors.textMuted + '40', backgroundColor: 'transparent' }]}>
              <Text style={[styles.availText, { color: colors.textMuted }]}>
                {rival ? `${rival.name}` : attachedProject ? 'On Set' : 'Locked'}
              </Text>
            </View>
          )}
          <Pressable style={styles.detailsToggle} onPress={() => setDetailsOpen((v) => !v)}>
            <Text style={styles.detailsToggleText}>{detailsOpen ? 'Less' : 'Details'}</Text>
          </Pressable>
        </View>
      </View>

      {/* Row 2: Star rating + craft bar + base cost */}
      <View style={styles.statsRow}>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>STAR POWER</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <StarRating value={talent.starPower} size="sm" />
          </View>
        </View>
        <View style={styles.statBlockSmall}>
          <Text style={styles.statLabel}>CRAFT</Text>
          <View style={styles.craftRow}>
            <View style={[styles.craftGradeChip, { borderColor: craftGradeColor(talent.craftScore) + '60', backgroundColor: craftGradeColor(talent.craftScore) + '14' }]}>
              <Text style={[styles.craftGradeText, { color: craftGradeColor(talent.craftScore) }]}>{craftGrade(talent.craftScore)}</Text>
            </View>
            <View style={styles.miniBarContainer}>
              <ProgressBar value={(talent.craftScore / 10) * 100} color={colors.accentGreen} height={4} animated />
            </View>
          </View>
        </View>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>Est. Base Cost</Text>
          <Text style={[styles.statNum, { color: colors.textPrimary }]}>${(talent.salary.base / 1_000_000).toFixed(1)}M</Text>
        </View>
      </View>

      {/* Row 3: Trust / loyalty */}
      {detailsOpen && (
        <View style={styles.trustRow}>
          <View style={[styles.trustBadge, { borderColor: trustColor + '50', backgroundColor: trustColor + '10' }]}>
            <Text style={[styles.trustText, { color: trustColor }]}>
              {trustLevelLabel(trustLevel)} - T{trust.toFixed(0)} L{loyalty.toFixed(0)}
            </Text>
          </View>
          <View style={[styles.riskBadge, { borderColor: refusalRiskColor(outlook.refusalRisk) + '50' }]}>
            <Text style={[styles.riskText, { color: refusalRiskColor(outlook.refusalRisk) }]}>
              {outlook.refusalRisk === 'critical' ? 'High Risk' : outlook.refusalRisk === 'elevated' ? 'Med Risk' : 'Low Risk'}
            </Text>
          </View>
          {outlook.blocked && outlook.lockoutUntilWeek && (
            <Text style={styles.muted}>Cooling off until W{outlook.lockoutUntilWeek}</Text>
          )}
        </View>
      )}

      {detailsOpen && outlook.reason && (
        <Text style={[styles.alert, { color: colors.goldMid }]}>{outlook.reason}</Text>
      )}

      {activeProject && (
        <Text style={styles.muted}>
          Fit to <Text style={{ color: colors.textPrimary }}>{activeProject.title}</Text>:{' '}
          {pct(talent.genreFit[activeProject.genre] ?? 0.5)}
          {targetChance !== null && ` - Close ${pct(targetChance)}`}
        </Text>
      )}

      {attachedProject && (
        <Text style={styles.muted}>Attached: {attachedProject.title}</Text>
      )}

      {/* Recent memory */}
      {detailsOpen && recentMemory.length > 0 && (
        <View style={{ gap: 3 }}>
          <SectionLabel label="Recent Memory" />
          {recentMemory.map((entry, i) => (
            <Text key={`${talent.id}-${entry.week}-${i}`} style={styles.memoryLine}>
              W{entry.week}: {interactionLabel(entry.kind)}{' '}
              <Text style={{ color: entry.trustDelta >= 0 ? colors.accentGreen : colors.accentRed }}>
                ({entry.trustDelta >= 0 ? '+' : ''}{entry.trustDelta}T)
              </Text>
            </Text>
          ))}
        </View>
      )}

      {/* Rival / cooling status line */}
      {!isAvailable && rival && (
        <Text style={styles.muted}>{rival.name} - returns W{talent.unavailableUntilWeek ?? '-'}</Text>
      )}

      {/* Actions */}
      {activeProject && isAvailable && (
        <View style={styles.actions}>
          <PremiumButton
            label={`Negotiate - ${pct(manager.getNegotiationChance(talent.id, activeProject.id) ?? 0)}`}
            onPress={() => openNegotiationModal(talent.id)}
            disabled={outlook.blocked}
            variant="gold-outline"
            size="sm"
            style={styles.flexBtn}
          />
          <PremiumButton
            label={`Quick Close - ${pct(manager.getQuickCloseChance(talent.id) ?? 0)}`}
            onPress={() => attachTalent(activeProject.id, talent.id)}
            disabled={outlook.blocked}
            variant="primary"
            size="sm"
            style={styles.flexBtn}
          />
        </View>
      )}
    </GlassCard>
  );
});

const styles = StyleSheet.create({
  talentHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sp2 },
  talentName: { fontFamily: typography.fontBodyBold, fontSize: typography.sizeMD, color: colors.textPrimary },
  talentRole: { fontFamily: typography.fontBody, fontSize: typography.sizeXS, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  badgeGroup: { flexDirection: 'row', gap: spacing.sp1, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' },
  windowChip: { borderRadius: radius.rFull, borderWidth: 1, paddingVertical: 2, paddingHorizontal: 8 },
  windowText: { fontFamily: typography.fontBodyBold, fontSize: 10, letterSpacing: 0.4 },
  availBadge: { borderRadius: radius.rFull, borderWidth: 1, paddingVertical: 3, paddingHorizontal: 8 },
  availText: { fontFamily: typography.fontBodySemiBold, fontSize: 10, letterSpacing: 0.4 },

  statsRow: { flexDirection: 'row', gap: spacing.sp3, alignItems: 'flex-start' },
  statBlock: { flex: 1, gap: 3 },
  statBlockSmall: { flex: 0.5, gap: 3 },
  craftRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sp1, marginTop: 2 },
  craftGradeChip: { borderRadius: radius.rFull, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  craftGradeText: { fontFamily: typography.fontBodyBold, fontSize: 10, letterSpacing: 0.3 },
  miniBarContainer: { width: 40 },
  statLabel: { fontFamily: typography.fontBodySemiBold, fontSize: 9, color: colors.textMuted, letterSpacing: typography.trackingWidest },
  statNum: { fontFamily: typography.fontBodyBold, fontSize: typography.sizeXS },

  trustRow: { flexDirection: 'row', gap: spacing.sp2, alignItems: 'center', flexWrap: 'wrap' },
  trustBadge: { borderRadius: radius.rFull, borderWidth: 1, paddingVertical: 2, paddingHorizontal: 8 },
  trustText: { fontFamily: typography.fontBodySemiBold, fontSize: 10, letterSpacing: 0.4 },
  riskBadge: { borderRadius: radius.rFull, borderWidth: 1, paddingVertical: 2, paddingHorizontal: 8, backgroundColor: 'transparent' },
  riskText: { fontFamily: typography.fontBodySemiBold, fontSize: 10, letterSpacing: 0.4 },
  detailsToggle: {
    borderRadius: radius.rFull,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  detailsToggleText: { fontFamily: typography.fontBodySemiBold, fontSize: 10, color: colors.textMuted, letterSpacing: 0.3 },

  muted: { fontFamily: typography.fontBody, fontSize: typography.sizeXS, color: colors.textMuted },
  alert: { fontFamily: typography.fontBodyMedium, fontSize: typography.sizeXS },
  memoryLine: { fontFamily: typography.fontBody, fontSize: typography.sizeXS, color: colors.textMuted },

  actions: { flexDirection: 'row', gap: spacing.sp2, flexWrap: 'wrap', marginTop: spacing.sp1 },
  flexBtn: { flex: 1 },
});
