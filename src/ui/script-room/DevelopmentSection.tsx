import { Pressable, Text, View } from 'react-native';

import type { StudioManager } from '@/src/domain/studio-manager';
import type { MovieProject, Talent } from '@/src/domain/types';
import { agencyLabel, capitalize, pct } from '@/src/ui/helpers/formatting';
import { styles } from '@/src/ui/script-room/script-room-styles';

interface DevelopmentSectionProps {
  projects: MovieProject[];
  availableDirectors: Talent[];
  availableActors: Talent[];
  availableActresses: Talent[];
  manager: StudioManager;
  onStartNegotiation: (projectId: string, talentId: string) => void;
  onAttachTalent: (projectId: string, talentId: string) => void;
}

function TalentRow({
  talent,
  projectId,
  manager,
  labelField,
  onStartNegotiation,
  onAttachTalent,
}: {
  talent: Talent;
  projectId: string;
  manager: StudioManager;
  labelField: 'craftScore' | 'starPower';
  onStartNegotiation: (projectId: string, talentId: string) => void;
  onAttachTalent: (projectId: string, talentId: string) => void;
}) {
  const labelKey = labelField === 'craftScore' ? 'Craft' : 'Star';
  return (
    <View style={styles.inlineActions}>
      <Pressable style={styles.talentButton} onPress={() => onStartNegotiation(projectId, talent.id)}>
        <Text style={styles.talentText}>
          Open: {talent.name} | {labelKey} {talent[labelField].toFixed(1)} | {agencyLabel(talent.agentTier)}
        </Text>
        <Text style={styles.talentMeta}>Chance {pct(manager.getNegotiationChance(talent.id, projectId) ?? 0)}</Text>
      </Pressable>
      <Pressable style={styles.quickButton} onPress={() => onAttachTalent(projectId, talent.id)}>
        <Text style={styles.quickText}>Quick Close {pct(manager.getQuickCloseChance(talent.id) ?? 0)}</Text>
      </Pressable>
    </View>
  );
}

export function DevelopmentSection({
  projects,
  availableDirectors,
  availableActors,
  availableActresses,
  manager,
  onStartNegotiation,
  onAttachTalent,
}: DevelopmentSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Development Attachments</Text>
      {projects.length === 0 ? (
        <Text style={styles.muted}>No development projects available.</Text>
      ) : (
        projects.map((project) => {
          const projection = manager.getProjectedForProject(project.id);
          const attachedDirector = manager.talentPool.find((talent) => talent.id === project.directorId);
          const castNames = project.castIds
            .map((id) => manager.talentPool.find((talent) => talent.id === id)?.name)
            .filter((value): value is string => !!value);
          return (
            <View key={project.id} style={styles.card}>
              <Text style={styles.cardTitle}>{project.title}</Text>
              <Text style={styles.body}>
                {capitalize(project.genre)} | Director: {attachedDirector?.name ?? 'Unattached'}
              </Text>
              <Text style={styles.body}>
                Cast attached: {project.castIds.length} {castNames.length > 0 ? `(${castNames.join(', ')})` : ''}
              </Text>
              <Text style={styles.muted}>
                Required: {project.castRequirements.actorCount} actor(s), {project.castRequirements.actressCount} actress(es)
              </Text>
              {projection ? (
                <Text style={styles.muted}>
                  Projection: Critic {projection.critical.toFixed(0)} | ROI {projection.roi.toFixed(2)}x
                </Text>
              ) : null}

              <Text style={styles.subHeader}>Director</Text>
              {availableDirectors.map((talent) => (
                <TalentRow
                  key={talent.id}
                  talent={talent}
                  projectId={project.id}
                  manager={manager}
                  labelField="craftScore"
                  onStartNegotiation={onStartNegotiation}
                  onAttachTalent={onAttachTalent}
                />
              ))}

              <Text style={styles.subHeader}>Actor</Text>
              {availableActors.map((talent) => (
                <TalentRow
                  key={talent.id}
                  talent={talent}
                  projectId={project.id}
                  manager={manager}
                  labelField="starPower"
                  onStartNegotiation={onStartNegotiation}
                  onAttachTalent={onAttachTalent}
                />
              ))}

              <Text style={styles.subHeader}>Actress</Text>
              {availableActresses.map((talent) => (
                <TalentRow
                  key={talent.id}
                  talent={talent}
                  projectId={project.id}
                  manager={manager}
                  labelField="starPower"
                  onStartNegotiation={onStartNegotiation}
                  onAttachTalent={onAttachTalent}
                />
              ))}
            </View>
          );
        })
      )}
    </View>
  );
}
