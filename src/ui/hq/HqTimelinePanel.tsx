import { Text, View } from 'react-native';

import type { StudioManager } from '@/src/domain/studio-manager';
import { CollapsibleCard } from '@/src/ui/components';
import { CHRONICLE_ICONS, signedMoney } from '@/src/ui/hq/hq-helpers';
import { styles } from '@/src/ui/hq/hq-styles';
import { colors } from '@/src/ui/tokens';

interface HqTimelinePanelProps {
  manager: StudioManager;
  milestones: StudioManager['milestones'];
  chronicle: StudioManager['studioChronicle'];
  news: StudioManager['industryNewsLog'];
}

export function HqTimelinePanel({ manager, milestones, chronicle, news }: HqTimelinePanelProps) {
  return (
    <>
      {manager.lastWeekSummary ? (
        <CollapsibleCard title="Last Week Summary" defaultOpen>
          <Text style={[styles.body, { color: manager.lastWeekSummary.cashDelta >= 0 ? colors.accentGreen : colors.accentRed }]}>
            Cash {signedMoney(manager.lastWeekSummary.cashDelta)}
          </Text>
          {manager.lastWeekSummary.events.map((event) => (
            <Text key={event} style={styles.muted}>- {event}</Text>
          ))}
        </CollapsibleCard>
      ) : null}

      <CollapsibleCard
        title="Milestones"
        badge={milestones.length > 0 ? `${milestones.length}` : undefined}
        badgeColor={colors.goldMid}
      >
        {milestones.length === 0
          ? <Text style={styles.muted}>No milestones unlocked yet.</Text>
          : milestones.map((milestone) => (
            <View key={`${milestone.id}-${milestone.unlockedWeek}`} style={styles.leaderRow}>
              <Text style={styles.bodyStrong}>[Milestone] {milestone.title}</Text>
              <Text style={styles.muted}>W{milestone.unlockedWeek}</Text>
            </View>
          ))}
      </CollapsibleCard>

      <CollapsibleCard title="Studio Chronicle">
        {chronicle.length === 0
          ? <Text style={styles.muted}>No defining moments yet.</Text>
          : chronicle.map((entry) => (
            <View key={entry.id} style={styles.chronicleEntry}>
              <Text style={styles.chronicleWeek}>W{entry.week} {CHRONICLE_ICONS[entry.type] ?? '.'}</Text>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.chronicleHeadline,
                    entry.impact === 'positive'
                      ? { color: colors.accentGreen }
                      : entry.impact === 'negative'
                        ? { color: colors.accentRed }
                        : null,
                  ]}
                >
                  {entry.headline}
                </Text>
                {entry.detail ? <Text style={styles.muted}>{entry.detail}</Text> : null}
              </View>
            </View>
          ))}
      </CollapsibleCard>

      <CollapsibleCard title="Industry News">
        {news.length === 0
          ? <Text style={styles.muted}>No major rival movement yet.</Text>
          : news.map((item) => (
            <Text key={item.id} style={styles.muted}>W{item.week}: {item.headline}</Text>
          ))}
      </CollapsibleCard>
    </>
  );
}
