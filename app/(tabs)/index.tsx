import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useGame } from '@/src/state/game-context';
import { tokens } from '@/src/ui/tokens';

function money(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`;
}

function signedMoney(amount: number): string {
  return `${amount >= 0 ? '+' : '-'}$${Math.round(Math.abs(amount)).toLocaleString()}`;
}

const ARC_LABELS: Record<string, string> = {
  'awards-circuit': 'Awards Run',
  'exhibitor-war': 'Theater Access Battle',
  'financier-control': 'Investor Pressure',
  'franchise-pivot': 'Universe Gamble',
  'leak-piracy': 'Leak Fallout',
  'talent-meltdown': 'Volatile Star Cycle',
};

export default function HQScreen() {
  const { manager, dismissReleaseReveal, endWeek, resolveCrisis, resolveDecision, runOptionalAction, renameStudio, lastMessage } =
    useGame();
  const reveal = manager.getNextReleaseReveal();
  const leaderboard = manager.getIndustryHeatLeaderboard();
  const news = manager.industryNewsLog.slice(0, 6);
  const readyToAdvance = manager.canEndWeek ? 'Ready' : 'Blocked';
  const arcEntries = Object.entries(manager.storyArcs)
    .sort((a, b) => {
      if (a[1].status === b[1].status) return b[1].lastUpdatedWeek - a[1].lastUpdatedWeek;
      if (a[1].status === 'active') return -1;
      if (b[1].status === 'active') return 1;
      if (a[1].status === 'resolved') return -1;
      return 1;
    })
    .slice(0, 8);
  const activeArcCount = arcEntries.filter(([, arc]) => arc.status === 'active').length;
  const anim = useRef(new Animated.Value(0)).current;
  const [studioNameDraft, setStudioNameDraft] = useState(manager.studioName);

  useEffect(() => {
    if (!reveal) return;
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim, reveal]);

  useEffect(() => {
    setStudioNameDraft(manager.studioName);
  }, [manager.studioName]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Studio HQ</Text>
      <Text style={styles.subtitle}>
        Week {manager.currentWeek} | {manager.studioName}
      </Text>
      {lastMessage ? <Text style={styles.message}>{lastMessage}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.label}>Studio Identity</Text>
        <TextInput
          value={studioNameDraft}
          onChangeText={setStudioNameDraft}
          placeholder="Enter studio name"
          placeholderTextColor={tokens.textMuted}
          style={styles.input}
          maxLength={32}
        />
        <Pressable style={styles.choiceButton} onPress={() => renameStudio(studioNameDraft)}>
          <Text style={styles.choiceTitle}>Rename Studio</Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        <View style={styles.card}>
          <Text style={styles.label}>Week Progress</Text>
          <Text style={styles.metric}>{manager.currentWeek}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Advance Status</Text>
          <Text style={[styles.metric, manager.canEndWeek ? styles.metricReady : styles.metricBlocked]}>{readyToAdvance}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Weekly Status</Text>
        <Text style={styles.body}>Crises: {manager.pendingCrises.length}</Text>
        <Text style={styles.body}>Inbox Items: {manager.decisionQueue.length}</Text>
        <Text style={styles.body}>Active Projects: {manager.activeProjects.length}</Text>
        {!manager.canEndWeek ? <Text style={styles.alert}>Resolve crisis to unlock End Week.</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Story Arcs</Text>
        <Text style={styles.mutedBody}>Active arcs: {activeArcCount}</Text>
        {arcEntries.length === 0 ? <Text style={styles.mutedBody}>No major arc threads have started yet.</Text> : null}
        {arcEntries.map(([arcId, arc]) => (
          <View key={arcId} style={styles.arcRow}>
            <View style={styles.arcHeader}>
              <Text style={styles.bodyStrong}>{ARC_LABELS[arcId] ?? arcId}</Text>
              <Text
                style={[
                  styles.arcStatus,
                  arc.status === 'resolved'
                    ? styles.arcResolved
                    : arc.status === 'failed'
                      ? styles.arcFailed
                      : styles.arcActive,
                ]}>
                {arc.status.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.mutedBody}>
              Stage {arc.stage} | Last updated week {arc.lastUpdatedWeek}
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.card, manager.pendingCrises.length > 0 ? styles.crisisCard : null]}>
        <Text style={styles.label}>Blocking Crises</Text>
        {manager.pendingCrises.length === 0 ? <Text style={styles.mutedBody}>No blocking crises this week.</Text> : null}
        {manager.pendingCrises.map((crisis) => (
          <View key={crisis.id} style={styles.actionCard}>
            <Text style={styles.mutedBody}>
              Affects: {manager.activeProjects.find((project) => project.id === crisis.projectId)?.title ?? 'Unknown project'}
            </Text>
            <Text style={styles.crisisTitle}>{crisis.title}</Text>
            <Text style={styles.body}>{crisis.body}</Text>
            <Text style={styles.alert}>Severity: {crisis.severity.toUpperCase()}</Text>
            {crisis.options.map((option) => (
              <Pressable key={option.id} style={styles.choiceButton} onPress={() => resolveCrisis(crisis.id, option.id)}>
                <Text style={styles.choiceTitle}>{option.label}</Text>
                <Text style={styles.choiceBody}>
                  {option.preview} ({signedMoney(option.cashDelta)}, schedule {option.scheduleDelta >= 0 ? '+' : ''}
                  {option.scheduleDelta}w)
                </Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Decision Inbox</Text>
        {manager.decisionQueue.length === 0 ? <Text style={styles.mutedBody}>No active decisions right now.</Text> : null}
        {manager.decisionQueue.map((item) => (
          <View key={item.id} style={styles.actionCard}>
            <Text style={styles.mutedBody}>
              Scope: {item.projectId ? manager.activeProjects.find((project) => project.id === item.projectId)?.title ?? 'Unknown project' : 'Studio-wide'}
            </Text>
            <Text style={styles.bodyStrong}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
            <Text style={styles.mutedBody}>Expires in {Math.max(0, item.weeksUntilExpiry)} week(s)</Text>
            {item.options.map((option) => (
              <Pressable key={option.id} style={styles.choiceButton} onPress={() => resolveDecision(item.id, option.id)}>
                <Text style={styles.choiceTitle}>{option.label}</Text>
                <Text style={styles.choiceBody}>
                  {option.preview} ({signedMoney(option.cashDelta)})
                </Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Industry Heat Leaderboard</Text>
        {leaderboard.map((entry, index) => (
          <View key={entry.name} style={styles.rowLine}>
            <Text style={[styles.body, entry.isPlayer ? styles.playerRow : null]}>
              #{index + 1} {entry.name}
            </Text>
            <Text style={[styles.body, entry.isPlayer ? styles.playerRow : null]}>{entry.heat.toFixed(0)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Industry News Feed</Text>
        {news.length === 0 ? <Text style={styles.mutedBody}>No major rival movement yet.</Text> : null}
        {news.map((item) => (
          <Text key={item.id} style={styles.mutedBody}>
            W{item.week}: {item.headline}
          </Text>
        ))}
      </View>

      {manager.lastWeekSummary ? (
        <View style={styles.card}>
          <Text style={styles.label}>Last Week Summary</Text>
          <Text style={styles.body}>
            Cash Delta: {manager.lastWeekSummary.cashDelta >= 0 ? '+' : '-'}
            {money(Math.abs(manager.lastWeekSummary.cashDelta))}
          </Text>
          {manager.lastWeekSummary.events.map((event) => (
            <Text key={event} style={styles.mutedBody}>
              - {event}
            </Text>
          ))}
        </View>
      ) : null}

      <Pressable style={styles.secondaryButton} onPress={runOptionalAction}>
        <Text style={styles.secondaryButtonText}>Run Optional Action (+Hype)</Text>
      </Pressable>

      <Pressable
        style={[styles.primaryButton, !manager.canEndWeek ? styles.disabledButton : null]}
        disabled={!manager.canEndWeek}
        onPress={endWeek}>
        <Text style={styles.primaryButtonText}>{manager.canEndWeek ? 'End Week' : 'Resolve Crisis First'}</Text>
      </Pressable>

      <Modal
        visible={!!reveal}
        transparent
        animationType="none"
        onRequestClose={() => reveal && dismissReleaseReveal(reveal.id)}>
        <View style={styles.modalOverlay}>
          {reveal ? (
            <Animated.View
              style={[
                styles.modalCard,
                {
                  opacity: anim,
                  transform: [
                    {
                      translateY: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    },
                    {
                      scale: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.97, 1],
                      }),
                    },
                  ],
                },
              ]}>
              <Text style={styles.modalTitle}>Opening Weekend Reveal</Text>
              <Text style={styles.modalFilm}>{reveal.title}</Text>
              <Text style={styles.modalStat}>Opening Weekend: {money(reveal.openingWeekendGross ?? 0)}</Text>
              <Text style={styles.modalStat}>Critics: {reveal.criticalScore?.toFixed(0) ?? '--'}</Text>
              <Text style={styles.modalStat}>Audience: {reveal.audienceScore?.toFixed(0) ?? '--'}</Text>
              <Text style={styles.modalSub}>Partner: {reveal.distributionPartner ?? 'Pending'}</Text>
              <Text style={styles.modalSub}>Run Length Forecast: {reveal.releaseWeeksRemaining} weeks</Text>

              <Pressable style={styles.modalButton} onPress={() => dismissReleaseReveal(reveal.id)}>
                <Text style={styles.modalButtonText}>Continue</Text>
              </Pressable>
            </Animated.View>
          ) : null}
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.bgPrimary,
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 120,
  },
  title: {
    color: tokens.textPrimary,
    fontSize: 30,
    fontWeight: '700',
  },
  subtitle: {
    color: tokens.textSecondary,
    marginTop: -2,
    marginBottom: 8,
    fontSize: 13,
  },
  message: {
    color: tokens.accentTeal,
    marginBottom: 4,
    fontSize: 13,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgElevated,
    color: tokens.textPrimary,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgSurface,
    padding: 14,
    gap: 6,
  },
  crisisCard: {
    borderColor: tokens.accentRed,
  },
  label: {
    color: tokens.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 11,
    fontWeight: '600',
  },
  metric: {
    color: tokens.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  metricReady: {
    color: tokens.accentTeal,
  },
  metricBlocked: {
    color: tokens.accentRed,
  },
  body: {
    color: tokens.textSecondary,
    fontSize: 14,
  },
  bodyStrong: {
    color: tokens.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  mutedBody: {
    color: tokens.textMuted,
    fontSize: 13,
  },
  actionCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgElevated,
    padding: 10,
    gap: 6,
  },
  arcRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgElevated,
    padding: 10,
    gap: 4,
  },
  arcHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  arcStatus: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  arcActive: {
    color: tokens.accentGold,
  },
  arcResolved: {
    color: tokens.accentTeal,
  },
  arcFailed: {
    color: tokens.accentRed,
  },
  alert: {
    color: tokens.accentRed,
    marginTop: 4,
    fontSize: 13,
  },
  crisisTitle: {
    color: tokens.accentRed,
    fontSize: 15,
    fontWeight: '700',
  },
  choiceButton: {
    borderRadius: 9,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgSurface,
    padding: 9,
    gap: 3,
  },
  choiceTitle: {
    color: tokens.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  choiceBody: {
    color: tokens.textMuted,
    fontSize: 12,
  },
  rowLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playerRow: {
    color: tokens.accentGold,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: tokens.accentGold,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  primaryButtonText: {
    color: '#241B0D',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: tokens.bgElevated,
    borderColor: tokens.border,
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  secondaryButtonText: {
    color: tokens.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#5A4C31',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 9, 13, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.accentGold,
    backgroundColor: tokens.bgSurface,
    padding: 16,
    gap: 8,
  },
  modalTitle: {
    color: tokens.accentGold,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  modalFilm: {
    color: tokens.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  modalStat: {
    color: tokens.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  modalSub: {
    color: tokens.textMuted,
    fontSize: 13,
  },
  modalButton: {
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: tokens.accentGold,
  },
  modalButtonText: {
    color: '#241B0D',
    fontSize: 14,
    fontWeight: '700',
  },
});
