import type { GameContextValue } from '@/src/state/game-types';
import type { StudioManager } from '@/src/domain/studio-manager';
import type { CrisisEvent, DecisionItem, InboxNotification } from '@/src/domain/types';
import { GlassCard, PremiumButton, SectionLabel } from '@/src/ui/components';
import { styles } from '@/src/ui/hq/hq-styles';
import { colors, spacing } from '@/src/ui/tokens';
import { signedMoney } from '@/src/ui/hq/hq-helpers';
import { Pressable, Text, View } from 'react-native';

interface HqInboxSectionProps {
  manager: StudioManager;
  visibleCrises: CrisisEvent[];
  visibleDecisions: DecisionItem[];
  visibleUpdates: InboxNotification[];
  inboxCount: number;
  resolveCrisis: GameContextValue['resolveCrisis'];
  resolveDecision: GameContextValue['resolveDecision'];
  dismissDecision: GameContextValue['dismissDecision'];
  dismissInboxNotification: GameContextValue['dismissInboxNotification'];
}

export function HqInboxSection({
  manager,
  visibleCrises,
  visibleDecisions,
  visibleUpdates,
  inboxCount,
  resolveCrisis,
  resolveDecision,
  dismissDecision,
  dismissInboxNotification,
}: HqInboxSectionProps) {
  return (
    <GlassCard style={{ gap: spacing.sp2 }}>
      <SectionLabel label="Inbox" />
      {manager.pendingCrises.length > 0 ? (
        <Text style={[styles.muted, { color: colors.accentRed }]}>
          {manager.pendingCrises.length} blocking crisis{manager.pendingCrises.length === 1 ? '' : 'es'} must be resolved before End Turn.
        </Text>
      ) : null}
      {manager.pendingCrises.length !== visibleCrises.length ? (
        <Text style={[styles.muted, { color: colors.accentRed }]}>
          Some crisis entries are malformed. Restarting the app will repair persisted inbox data.
        </Text>
      ) : null}
      {visibleCrises.map((crisis) => (
        <GlassCard key={crisis.id} variant="elevated" accentBorder={colors.accentRed} style={{ gap: spacing.sp2 }}>
          <View style={styles.inboxHeader}>
            <Text style={styles.muted}>
              {manager.activeProjects.find((p) => p.id === crisis.projectId)?.title ?? 'Unknown Project'}
            </Text>
            <View style={[styles.expiryPill, { borderColor: colors.borderRed }]}>
              <Text style={[styles.expiryText, { color: colors.accentRed }]}>CRISIS</Text>
            </View>
          </View>
          <Text style={[styles.decisionTitle, { color: colors.accentRed }]}>{crisis.title}</Text>
          <Text style={styles.body}>{crisis.body}</Text>
          <Text style={[styles.muted, { color: colors.accentRed }]}>Severity: {crisis.severity.toUpperCase()}</Text>
          {Array.isArray(crisis.options) && crisis.options.length > 0 ? null : (
            <Text style={[styles.muted, { color: colors.accentRed }]}>
              Crisis data is malformed. Restarting the app will repair saved inbox data.
            </Text>
          )}
          <View style={styles.optionGroup}>
            {(Array.isArray(crisis.options) ? crisis.options : []).map((option) => (
              <Pressable
                key={option.id}
                style={({ pressed }) => [styles.optionBtn, { borderColor: colors.borderRed }, pressed && styles.optionBtnPressed]}
                onPress={() => resolveCrisis(crisis.id, option.id)}
              >
                <Text style={styles.optionTitle}>{option.label}</Text>
                <Text style={styles.optionBody}>
                  {option.preview} ({signedMoney(option.cashDelta)}, schedule {option.scheduleDelta >= 0 ? '+' : ''}{option.scheduleDelta}w)
                </Text>
              </Pressable>
            ))}
          </View>
        </GlassCard>
      ))}
      {visibleUpdates.map((item) => (
        <GlassCard key={item.id} variant="elevated" accentBorder={colors.ctaAmber} style={{ gap: spacing.sp2 }}>
          <View style={styles.inboxHeader}>
            <Text style={styles.muted}>
              {item.projectId
                ? manager.activeProjects.find((p) => p.id === item.projectId)?.title ?? 'Unknown Project'
                : 'Studio-wide'}
            </Text>
            <View style={[styles.expiryPill, { borderColor: colors.borderAmber }]}>
              <Text style={[styles.expiryText, { color: colors.ctaAmber }]}>UPDATE</Text>
            </View>
          </View>
          <Text style={styles.bodyStrong}>{item.title}</Text>
          <Text style={styles.body}>{item.body}</Text>
          <PremiumButton
            label="Dismiss"
            onPress={() => dismissInboxNotification(item.id)}
            variant="secondary"
            size="sm"
            style={styles.choiceBtn}
          />
        </GlassCard>
      ))}
      {manager.decisionQueue.length !== visibleDecisions.length ? (
        <Text style={[styles.muted, { color: colors.accentRed }]}>
          Some decision entries are malformed. Use the Inbox tab to dismiss broken items.
        </Text>
      ) : null}
      {visibleDecisions.map((item) => (
        <GlassCard key={item.id} variant="elevated" accentBorder={colors.goldMid} style={{ gap: spacing.sp2 }}>
          <View style={styles.inboxHeader}>
            <Text style={styles.muted}>
              {item.projectId
                ? manager.activeProjects.find((p) => p.id === item.projectId)?.title ?? 'Unknown Project'
                : 'Studio-wide'}
            </Text>
            <View style={[styles.expiryPill, { borderColor: item.weeksUntilExpiry <= 1 ? colors.borderRed : colors.borderGold }]}>
              <Text style={[styles.expiryText, { color: item.weeksUntilExpiry <= 1 ? colors.accentRed : colors.goldMid }]}>
                {Math.max(0, item.weeksUntilExpiry)}w left
              </Text>
            </View>
          </View>
          <Text style={styles.bodyStrong}>{item.title}</Text>
          <Text style={styles.body}>{item.body}</Text>
          <View style={styles.optionGroup}>
            {(Array.isArray(item.options) ? item.options : []).map((option) => (
              <Pressable key={option.id} style={styles.optionBtn} onPress={() => resolveDecision(item.id, option.id)}>
                <Text style={styles.optionTitle}>{option.label}</Text>
                <Text style={styles.optionBody}>{option.preview} ({signedMoney(option.cashDelta)})</Text>
              </Pressable>
            ))}
            {(Array.isArray(item.options) ? item.options : []).length === 0 ? (
              <PremiumButton
                label="Dismiss Broken Item"
                onPress={() => dismissDecision(item.id)}
                variant="secondary"
                size="sm"
                style={styles.choiceBtn}
              />
            ) : null}
          </View>
        </GlassCard>
      ))}
      {inboxCount === 0 ? <Text style={styles.muted}>Inbox clear. No active crises, updates, or decisions.</Text> : null}
    </GlassCard>
  );
}
