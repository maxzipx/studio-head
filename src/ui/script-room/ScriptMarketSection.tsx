import { Pressable, Text, View } from 'react-native';

import type { StudioManager } from '@/src/domain/studio-manager';
import type { ScriptPitch } from '@/src/domain/types';
import { money, recommendationLabel } from '@/src/ui/helpers/formatting';
import { styles } from '@/src/ui/script-room/script-room-styles';
import { scriptTierLabel } from '@/src/ui/script-room/script-room-helpers';

interface ScriptMarketSectionProps {
  scripts: ScriptPitch[];
  manager: StudioManager;
  onAcquire: (scriptId: string, title: string) => void;
  onPass: (scriptId: string) => void;
}

export function ScriptMarketSection({ scripts, manager, onAcquire, onPass }: ScriptMarketSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Market Offers</Text>
      {scripts.length === 0 ? (
        <Text style={styles.muted}>No open script offers this week.</Text>
      ) : (
        scripts.map((script) => (
          <View key={script.id} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.cardTitle}>{script.title}</Text>
              <View style={styles.inlineBadges}>
                {scriptTierLabel(script.marketTier) ? (
                  <Text style={script.marketTier === 'bargain' ? styles.bargainBadge : styles.biddingBadge}>
                    {scriptTierLabel(script.marketTier)}
                  </Text>
                ) : null}
                <Text style={styles.genre}>{script.genre}</Text>
              </View>
            </View>
            <Text style={styles.body}>{script.logline}</Text>
            <Text style={styles.muted}>Ask: {money(script.askingPrice)} | Expires in {script.expiresInWeeks}w</Text>
            <Text style={styles.muted}>
              Script: {script.scriptQuality.toFixed(1)} | Concept: {script.conceptStrength.toFixed(1)}
            </Text>
            {(() => {
              const evalResult = manager.evaluateScriptPitch(script.id);
              if (!evalResult) return null;
              return (
                <View style={styles.subCard}>
                  <Text style={styles.bodyStrong}>{recommendationLabel(evalResult.recommendation)}</Text>
                  <Text style={styles.muted}>
                    Script Grade {evalResult.valueScore.toFixed(0)} | Script Quality {evalResult.qualityScore.toFixed(0)} | Risk {evalResult.riskLabel}
                  </Text>
                </View>
              );
            })()}
            <View style={styles.actions}>
              <Pressable style={styles.actionButton} onPress={() => onAcquire(script.id, script.title)}>
                <Text style={styles.actionText}>Acquire</Text>
              </Pressable>
              <Pressable style={styles.actionButton} onPress={() => onPass(script.id)}>
                <Text style={styles.actionText}>Pass</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </View>
  );
}
