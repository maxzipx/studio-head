import { Text, View } from 'react-native';
import type { StudioManager } from '@/src/domain/studio-manager';
import type { MovieProject, Talent } from '@/src/domain/types';
import { GlassCard, TalentCard } from '@/src/ui/components';
import { styles } from '@/src/ui/talent/talent-styles';

interface TalentMarketSectionProps {
  activeProject: MovieProject | null;
  marketTalent: Talent[];
  marketDirectors: Talent[];
  marketActors: Talent[];
  marketActresses: Talent[];
  neededSlots: number;
  manager: StudioManager;
  openNegotiationModal: (talentId: string) => void;
  attachTalent: (projectId: string, talentId: string) => void;
}

export function TalentMarketSection({
  activeProject,
  marketTalent,
  marketDirectors,
  marketActors,
  marketActresses,
  neededSlots,
  manager,
  openNegotiationModal,
  attachTalent,
}: TalentMarketSectionProps) {
  if (!activeProject) {
    return (
      <GlassCard variant="elevated">
        <Text style={styles.empty}>Select a development project to view its staffing needs.</Text>
      </GlassCard>
    );
  }

  if (marketTalent.length === 0) {
    return (
      <GlassCard variant="elevated">
        <Text style={styles.empty}>
          {neededSlots === 0
            ? 'This project\'s current staffing needs are filled.'
            : 'No available talent currently matches this project\'s open roles.'}
        </Text>
      </GlassCard>
    );
  }

  return (
    <>
      {marketDirectors.length > 0 && (
        <>
          <View style={styles.roleHeaderDirector}>
            <Text style={styles.roleHeaderText}>DIRECTORS IN MARKET</Text>
            <Text style={styles.roleHeaderCount}>{marketDirectors.length}</Text>
          </View>
          {marketDirectors.map((talent) => (
            <TalentCard
              key={talent.id}
              talent={talent}
              manager={manager}
              activeProject={activeProject}
              openNegotiationModal={openNegotiationModal}
              attachTalent={attachTalent}
              showCountdown
            />
          ))}
        </>
      )}

      {marketActors.length > 0 && (
        <>
          <View style={styles.roleHeaderActor}>
            <Text style={styles.roleHeaderText}>ACTORS IN MARKET</Text>
            <Text style={styles.roleHeaderCount}>{marketActors.length}</Text>
          </View>
          {marketActors.map((talent) => (
            <TalentCard
              key={talent.id}
              talent={talent}
              manager={manager}
              activeProject={activeProject}
              openNegotiationModal={openNegotiationModal}
              attachTalent={attachTalent}
              showCountdown
            />
          ))}
        </>
      )}

      {marketActresses.length > 0 && (
        <>
          <View style={styles.roleHeaderActor}>
            <Text style={styles.roleHeaderText}>ACTRESSES IN MARKET</Text>
            <Text style={styles.roleHeaderCount}>{marketActresses.length}</Text>
          </View>
          {marketActresses.map((talent) => (
            <TalentCard
              key={talent.id}
              talent={talent}
              manager={manager}
              activeProject={activeProject}
              openNegotiationModal={openNegotiationModal}
              attachTalent={attachTalent}
              showCountdown
            />
          ))}
        </>
      )}
    </>
  );
}
