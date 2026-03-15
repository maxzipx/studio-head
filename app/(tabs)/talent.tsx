import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { useGameStore } from '@/src/state/game-context';
import { useShallow } from 'zustand/react/shallow';
import { selectTalentView } from '@/src/state/view-selectors';
import { GlassCard, MetricsStrip, PremiumButton, SectionLabel } from '@/src/ui/components';
import { colors, typography } from '@/src/ui/tokens';
import type { NegotiationAction } from '@/src/domain/types';
import {
  capitalized,
  phaseLabel,
} from '@/src/ui/helpers/formatting';
import { buildTalentScreenProjectView } from '@/src/ui/helpers/talent-screen';
import { useNegotiationModal } from '@/src/ui/hooks/useNegotiationModal';

import { styles } from '@/src/ui/talent/talent-styles';
import { TalentStaffingSnapshot } from '@/src/ui/talent/TalentStaffingSnapshot';
import { TalentNegotiationCard } from '@/src/ui/talent/TalentNegotiationCard';
import { TalentNegotiationModal } from '@/src/ui/talent/TalentNegotiationModal';
import { TalentMarketSection } from '@/src/ui/talent/TalentMarketSection';
import { TalentRosterSection } from '@/src/ui/talent/TalentRosterSection';

export default function TalentScreen() {
  const { manager, startNegotiation, adjustNegotiation, dismissNegotiation, attachTalent, lastMessage } = useGameStore(useShallow(selectTalentView));

  const developmentProjects = manager.activeProjects.filter((p) => p.phase === 'development');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(developmentProjects[0]?.id ?? null);
  const [showHelp, setShowHelp] = useState(false);
  // Draft lever selections for open negotiations — keyed by "projectId:talentId"
  const [draftNegActions, setDraftNegActions] = useState<Record<string, NegotiationAction>>({});

  const activeProject = selectedProjectId
    ? developmentProjects.find((p) => p.id === selectedProjectId) ?? null
    : null;

  const negModal = useNegotiationModal(manager, activeProject, startNegotiation, adjustNegotiation);
  const {
    openNegotiations,
    rosterTalent,
    rosterDirectors,
    rosterActors,
    rosterActresses,
    marketTalent,
    marketDirectors,
    marketActors,
    marketActresses,
    marketDirectorCount,
    marketActorCount,
    marketActressCount,
    attachedCount,
    neededSlots,
  } = buildTalentScreenProjectView({
    activeProject,
    playerNegotiations: manager.playerNegotiations,
    talentPool: manager.talentPool,
    getProjectCastStatus: manager.getProjectCastStatus.bind(manager),
  });

  useEffect(() => {
    const stillValid = !!selectedProjectId && developmentProjects.some((p) => p.id === selectedProjectId);
    if (stillValid) return;
    const fallback = developmentProjects[0]?.id ?? null;
    if (fallback !== selectedProjectId) {
      setSelectedProjectId(fallback);
    }
  }, [developmentProjects, selectedProjectId]);

  return (
    <View style={styles.screen}>
      <MetricsStrip cash={manager.cash} heat={manager.studioHeat} week={manager.currentWeek} />
      <ScrollView contentContainerStyle={styles.content}>

        {lastMessage ? (
          <GlassCard variant="amber">
            <Text style={styles.message}>{lastMessage}</Text>
          </GlassCard>
        ) : null}

        {/*  Help  */}
        <PremiumButton
          label={showHelp ? 'Hide Help' : 'Show Help'}
          onPress={() => setShowHelp((v) => !v)}
          variant="ghost"
          size="sm"
        />
        {showHelp && (
          <GlassCard variant="elevated">
            <Text style={styles.helpTitle}>How the Market Works</Text>
            <Text style={styles.helpBody}>A rotating pool of talent appears each week. Lower-tier talent stays 6 weeks; elite talent stays only 3 weeks. New faces trickle in every turn to replace expired windows.</Text>
            <Text style={styles.helpBody}>Higher-star talent only appears once your studio heat or talent reputation reaches their threshold. Build your rep to unlock elite talent.</Text>
            <Text style={styles.helpBody}>Push the highlighted pressure point first to raise close chance fastest. Trust and loyalty influence future negotiations.</Text>
            <Text style={styles.helpBody}>
              <Text style={{ color: colors.goldMid, fontFamily: typography.fontBodySemiBold }}>Star</Text>
              {' = audience draw and launch heat. '}
              <Text style={{ color: colors.accentGreen, fontFamily: typography.fontBodySemiBold }}>Craft</Text>
              {' = execution quality and critic stability.'}
            </Text>
          </GlassCard>
        )}

        {/*  Market Snapshot  */}
        <TalentStaffingSnapshot
          marketDirectorCount={marketDirectorCount}
          marketActorCount={marketActorCount}
          marketActressCount={marketActressCount}
          openNegotiationCount={openNegotiations.length}
          attachedCount={attachedCount}
          neededSlots={neededSlots}
        />

        {/*  Development Targets  */}
        <GlassCard>
          <SectionLabel label="Development Targets" />
          {developmentProjects.length === 0
            ? <Text style={styles.empty}>No development-phase project available for attachment right now.</Text>
            : <View style={styles.targetRow}>
              {developmentProjects.map((project) => (
                <PremiumButton
                  key={project.id}
                  label={`${project.title} (${capitalized(project.genre)})`}
                  onPress={() => setSelectedProjectId(project.id)}
                  variant={selectedProjectId === project.id ? 'primary' : 'secondary'}
                  size="sm"
                />
              ))}
            </View>
          }
        </GlassCard>

        {/*  Active Target  */}
        {activeProject && (
          <GlassCard variant="gold">
            <SectionLabel label="Active Target" />
            <Text style={styles.activeTitle}>{activeProject.title}</Text>
            <Text style={styles.body}>{capitalized(activeProject.genre)} - {phaseLabel(activeProject.phase)}</Text>
            <Text style={styles.muted}>
              Director:{' '}
              {activeProject.directorId
                ? manager.talentPool.find((t) => t.id === activeProject.directorId)?.name ?? 'Unknown'
                : 'Unattached'}
            </Text>
            <Text style={styles.muted}>
              Cast:{' '}
              {activeProject.castIds.length > 0
                ? activeProject.castIds
                  .map((id) => manager.talentPool.find((t) => t.id === id)?.name)
                  .filter((v): v is string => !!v)
                  .join(', ')
                : 'None attached'}
            </Text>
            <Text style={styles.muted}>
              Required: {activeProject.castRequirements.actorCount} actor(s), {activeProject.castRequirements.actressCount} actress(es)
            </Text>
          </GlassCard>
        )}

        {/* Open Negotiations */}
        <GlassCard>
          <SectionLabel label="Open Negotiations" />
          <Text style={styles.muted}>Each submission spends one round. You can change only one lever per round.</Text>
          {!activeProject
            ? <Text style={styles.empty}>Select a development project to view its negotiations.</Text>
            : openNegotiations.length === 0
              ? <Text style={styles.empty}>No open negotiations for this project.</Text>
              : openNegotiations.map((entry) => {
              const draftKey = `${entry.projectId}:${entry.talentId}`;
              return (
                <TalentNegotiationCard
                  key={draftKey}
                  entry={entry}
                  manager={manager}
                  selectedAction={draftNegActions[draftKey] ?? null}
                  onSelectAction={(action) =>
                    setDraftNegActions((prev) => ({
                      ...prev,
                      [draftKey]: action,
                    }))
                  }
                  onSubmitRound={() => {
                    const selectedAction = draftNegActions[draftKey] ?? null;
                    if (selectedAction) {
                      adjustNegotiation(entry.projectId, entry.talentId, selectedAction);
                      setDraftNegActions((prev) => {
                        const next = { ...prev };
                        delete next[draftKey];
                        return next;
                      });
                    }
                  }}
                  onDrop={() => {
                    dismissNegotiation(entry.projectId, entry.talentId);
                    setDraftNegActions((prev) => {
                      const next = { ...prev };
                      delete next[draftKey];
                      return next;
                    });
                  }}
                />
              );
              })
          }
        </GlassCard>

        {/*  Market Talent  */}
        <TalentMarketSection
          activeProject={activeProject}
          marketTalent={marketTalent}
          marketDirectors={marketDirectors}
          marketActors={marketActors}
          marketActresses={marketActresses}
          neededSlots={neededSlots}
          manager={manager}
          openNegotiationModal={negModal.open}
          attachTalent={attachTalent}
        />

        {/*  Your Roster  */}
        {activeProject && (
          <TalentRosterSection
            activeProject={activeProject}
            rosterTalent={rosterTalent}
            rosterDirectors={rosterDirectors}
            rosterActors={rosterActors}
            rosterActresses={rosterActresses}
            manager={manager}
            openNegotiationModal={negModal.open}
            attachTalent={attachTalent}
          />
        )}
      </ScrollView>

      <TalentNegotiationModal negModal={negModal} activeProject={activeProject} />
    </View>
  );
}
