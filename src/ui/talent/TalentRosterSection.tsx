import { Text, View } from 'react-native';
import type { StudioManager } from '@/src/domain/studio-manager';
import type { MovieProject, Talent } from '@/src/domain/types';
import { GlassCard, TalentCard } from '@/src/ui/components';
import { styles } from '@/src/ui/talent/talent-styles';

interface TalentRosterSectionProps {
  activeProject: MovieProject;
  rosterTalent: Talent[];
  rosterDirectors: Talent[];
  rosterActors: Talent[];
  rosterActresses: Talent[];
  manager: StudioManager;
  openNegotiationModal: (talentId: string) => void;
  attachTalent: (projectId: string, talentId: string) => void;
}

export function TalentRosterSection({
  activeProject,
  rosterTalent,
  rosterDirectors,
  rosterActors,
  rosterActresses,
  manager,
  openNegotiationModal,
  attachTalent,
}: TalentRosterSectionProps) {
  return (
    <>
      <View style={styles.roleHeaderRoster}>
        <Text style={styles.roleHeaderText}>YOUR ROSTER</Text>
        <Text style={styles.roleHeaderCount}>{rosterTalent.length}</Text>
      </View>
      {rosterTalent.length === 0 && (
        <GlassCard variant="elevated">
          <Text style={styles.empty}>No talent is attached to this project yet.</Text>
        </GlassCard>
      )}
      {rosterDirectors.map((talent) => <TalentCard
        key={talent.id}
        talent={talent}
        manager={manager}
        activeProject={activeProject}
        openNegotiationModal={openNegotiationModal}
        attachTalent={attachTalent}
        showCountdown={false}
      />)}
      {rosterActors.map((talent) => <TalentCard
        key={talent.id}
        talent={talent}
        manager={manager}
        activeProject={activeProject}
        openNegotiationModal={openNegotiationModal}
        attachTalent={attachTalent}
        showCountdown={false}
      />)}
      {rosterActresses.map((talent) => <TalentCard
        key={talent.id}
        talent={talent}
        manager={manager}
        activeProject={activeProject}
        openNegotiationModal={openNegotiationModal}
        attachTalent={attachTalent}
        showCountdown={false}
      />)}
    </>
  );
}
