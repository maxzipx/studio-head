import { Pressable, Text, View } from 'react-native';

import type { OwnedIp } from '@/src/domain/types';
import type { MajorIpCommitmentSnapshot } from '@/src/domain/studio-manager.major-ip';
import { money, capitalize } from '@/src/ui/helpers/formatting';
import { styles } from '@/src/ui/script-room/script-room-styles';

interface IpMarketSectionProps {
  ipMarket: OwnedIp[];
  majorIpCommitments: MajorIpCommitmentSnapshot[];
  onAcquireRights: (ipId: string) => void;
  onStartAdaptation: (ipId: string) => void;
}

export function IpMarketSection({ ipMarket, majorIpCommitments, onAcquireRights, onStartAdaptation }: IpMarketSectionProps) {
  return (
    <>
      {majorIpCommitments.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.bodyStrong}>Major IP Commitments</Text>
          {majorIpCommitments.map((commitment) => (
            <Text key={commitment.ipId} style={styles.muted}>
              {commitment.name}: {commitment.requiredReleases - commitment.remainingReleases}/{commitment.requiredReleases} delivered | deadline W
              {commitment.deadlineWeek}
              {commitment.isBlocking ? ' | CONTRACT LOCK ACTIVE' : ''}
              {commitment.breached ? ' | DEFAULTED' : ''}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>IP Marketplace</Text>
        {ipMarket.length === 0 ? <Text style={styles.muted}>No active IP opportunities this week.</Text> : null}
        {ipMarket.map((ip) => (
          <View key={ip.id} style={styles.card}>
            <Text style={styles.cardTitle}>{ip.name}</Text>
            <Text style={styles.muted}>
              {ip.kind.toUpperCase()} | {capitalize(ip.genre)} | Expires W{ip.expiresWeek}
            </Text>
            <Text style={styles.muted}>
              Rights {money(ip.acquisitionCost)} | Bonuses: +{ip.hypeBonus} hype, +{ip.qualityBonus.toFixed(1)} quality
            </Text>
            {ip.major ? <Text style={styles.warning}>Major IP contract: 3-release obligation applies once rights are secured.</Text> : null}
            <View style={styles.actions}>
              <Pressable style={styles.actionButton} onPress={() => onAcquireRights(ip.id)}>
                <Text style={styles.actionText}>Acquire Rights</Text>
              </Pressable>
              <Pressable style={styles.actionButton} onPress={() => onStartAdaptation(ip.id)}>
                <Text style={styles.actionText}>Start Adaptation</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </>
  );
}
