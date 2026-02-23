import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useGame } from '@/src/state/game-context';
import { tokens } from '@/src/ui/tokens';

function money(amount: number): string {
  return `$${Math.round(amount).toLocaleString()}`;
}

export default function ScriptRoomScreen() {
  const { manager, acquireScript, passScript, attachTalent, lastMessage } = useGame();
  const developmentProjects = manager.activeProjects.filter((project) => project.phase === 'development');
  const availableDirectors = manager.getAvailableTalentForRole('director');
  const availableLeads = manager.getAvailableTalentForRole('leadActor');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Script Room</Text>
      <Text style={styles.subtitle}>Acquire projects, evaluate projections, attach talent</Text>
      {lastMessage ? <Text style={styles.message}>{lastMessage}</Text> : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Market Offers</Text>
        {manager.scriptMarket.length === 0 ? (
          <Text style={styles.muted}>No open script offers this week.</Text>
        ) : (
          manager.scriptMarket.map((script) => (
            <View key={script.id} style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.cardTitle}>{script.title}</Text>
                <Text style={styles.genre}>{script.genre}</Text>
              </View>
              <Text style={styles.body}>{script.logline}</Text>
              <Text style={styles.muted}>Ask: {money(script.askingPrice)} • Expires in {script.expiresInWeeks}w</Text>
              <Text style={styles.muted}>
                Script: {script.scriptQuality.toFixed(1)} • Concept: {script.conceptStrength.toFixed(1)}
              </Text>
              <View style={styles.actions}>
                <Pressable style={styles.actionButton} onPress={() => acquireScript(script.id)}>
                  <Text style={styles.actionText}>Acquire</Text>
                </Pressable>
                <Pressable style={styles.actionButton} onPress={() => passScript(script.id)}>
                  <Text style={styles.actionText}>Pass</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Development Attachments</Text>
        {developmentProjects.length === 0 ? (
          <Text style={styles.muted}>No development projects available.</Text>
        ) : (
          developmentProjects.map((project) => {
            const projection = manager.getProjectedForProject(project.id);
            const attachedDirector = manager.talentPool.find((talent) => talent.id === project.directorId);
            return (
              <View key={project.id} style={styles.card}>
                <Text style={styles.cardTitle}>{project.title}</Text>
                <Text style={styles.body}>Director: {attachedDirector?.name ?? 'Unattached'}</Text>
                <Text style={styles.body}>Cast attached: {project.castIds.length}</Text>
                {projection ? (
                  <Text style={styles.muted}>
                    Projection: Critic {projection.critical.toFixed(0)} • ROI {projection.roi.toFixed(2)}x
                  </Text>
                ) : null}

                <Text style={styles.subHeader}>Attach Director</Text>
                {availableDirectors.map((talent) => (
                  <Pressable
                    key={talent.id}
                    style={styles.talentButton}
                    onPress={() => attachTalent(project.id, talent.id)}>
                    <Text style={styles.talentText}>
                      {talent.name} • Craft {talent.craftScore.toFixed(1)} • {talent.agentTier.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}

                <Text style={styles.subHeader}>Attach Lead Actor</Text>
                {availableLeads.map((talent) => (
                  <Pressable
                    key={talent.id}
                    style={styles.talentButton}
                    onPress={() => attachTalent(project.id, talent.id)}>
                    <Text style={styles.talentText}>
                      {talent.name} • Star {talent.starPower.toFixed(1)} • {talent.agentTier.toUpperCase()}
                    </Text>
                  </Pressable>
                ))}
              </View>
            );
          })
        )}
      </View>
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
    gap: 14,
    paddingBottom: 120,
  },
  title: {
    color: tokens.textPrimary,
    fontSize: 30,
    fontWeight: '700',
  },
  subtitle: {
    color: tokens.textSecondary,
    fontSize: 13,
    marginTop: -2,
  },
  message: {
    color: tokens.accentTeal,
    fontSize: 13,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: tokens.accentGold,
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgSurface,
    padding: 12,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    color: tokens.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  genre: {
    color: tokens.accentGold,
    textTransform: 'capitalize',
    fontSize: 12,
    fontWeight: '600',
  },
  body: {
    color: tokens.textSecondary,
    fontSize: 13,
  },
  muted: {
    color: tokens.textMuted,
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.bgElevated,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actionText: {
    color: tokens.textPrimary,
    fontWeight: '600',
    fontSize: 12,
  },
  subHeader: {
    color: tokens.textPrimary,
    marginTop: 8,
    fontWeight: '600',
    fontSize: 12,
  },
  talentButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: '#202A3F',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  talentText: {
    color: tokens.textSecondary,
    fontSize: 12,
  },
});
