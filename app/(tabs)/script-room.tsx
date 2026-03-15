import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { useGameStore } from '@/src/state/game-context';
import { useShallow } from 'zustand/react/shallow';
import { buildTalentNegotiationSignature } from '@/src/state/view-signatures';
import { styles } from '@/src/ui/script-room/script-room-styles';
import { ScriptMarketSection } from '@/src/ui/script-room/ScriptMarketSection';
import { IpMarketSection } from '@/src/ui/script-room/IpMarketSection';
import { NegotiationsSection } from '@/src/ui/script-room/NegotiationsSection';
import { DevelopmentSection } from '@/src/ui/script-room/DevelopmentSection';

export default function ScriptRoomScreen() {
  const { manager, acquireScript, passScript, startNegotiation, adjustNegotiation, attachTalent, acquireIpRights, developFromIp, lastMessage, scriptMarketSignature } = useGameStore(useShallow((state) => {
    const mgr = state.manager;
    return {
      manager: mgr,
      acquireScript: state.acquireScript,
      passScript: state.passScript,
      startNegotiation: state.startNegotiation,
      adjustNegotiation: state.adjustNegotiation,
      attachTalent: state.attachTalent,
      acquireIpRights: state.acquireIpRights,
      developFromIp: state.developFromIp,
      lastMessage: state.lastMessage,
      developmentSignature: mgr.activeProjects
        .filter((project) => project.phase === 'development')
        .map(
          (p) =>
            `${p.id}:${p.title}:${p.genre}:${p.scriptQuality}:${p.conceptStrength}:${p.directorId ?? 'none'}:${p.castIds.join(',')}:` +
            `${p.hypeScore}:${p.budget.actualSpend}:${p.budget.ceiling}:${p.franchiseId ?? 'none'}:${p.franchiseEpisode ?? 0}`
        )
        .join('|'),
      talentSignature: mgr.talentPool
        .map(
          (t) =>
            `${t.id}:${t.role}:${t.starPower}:${t.craftScore}:${t.availability}:${t.attachedProjectId ?? 'none'}:` +
            `${t.unavailableUntilWeek ?? -1}`
        )
        .join('|'),
      ipMarketSignature: mgr.ownedIps
        .map(
          (ip) =>
            `${ip.id}:${ip.kind}:${ip.name}:${ip.major}:${ip.acquisitionCost}:${ip.expiresWeek}:${ip.usedProjectId ?? 'none'}`
        )
        .join('|'),
      scriptMarketSignature: mgr.scriptMarket
        .map(
          (s) =>
            `${s.id}:${s.title}:${s.genre}:${s.marketTier ?? 'standard'}:${s.askingPrice}:${s.scriptQuality}:${s.conceptStrength}:${s.expiresInWeeks}`
        )
        .join('|'),
      negotiationSignature: mgr.playerNegotiations
        ? buildTalentNegotiationSignature(mgr.playerNegotiations)
        : '',
    };
  }));
  const developmentProjects = manager.activeProjects.filter((project) => project.phase === 'development');
  const availableDirectors = manager.getAvailableTalentForRole('director');
  const availableActors = manager.getAvailableTalentForRole('leadActor');
  const availableActresses = manager.getAvailableTalentForRole('leadActress');
  const ipMarket = manager.ownedIps.filter((ip) => !ip.usedProjectId && ip.expiresWeek >= manager.currentWeek);
  const majorIpCommitments = manager.getMajorIpCommitments();
  const [showHelp, setShowHelp] = useState(false);
  const [hiddenAcquiredScriptIds, setHiddenAcquiredScriptIds] = useState<string[]>([]);
  const [acquisitionPopup, setAcquisitionPopup] = useState<{
    visible: boolean;
    title: string;
    message: string;
  }>({
    visible: false,
    title: '',
    message: '',
  });

  useEffect(() => {
    setHiddenAcquiredScriptIds((current) => current.filter((id) => manager.scriptMarket.some((script) => script.id === id)));
  }, [manager, scriptMarketSignature]);

  const visibleScriptMarket = manager.scriptMarket.filter((script) => !hiddenAcquiredScriptIds.includes(script.id));

  const openAcquisitionPopup = (title: string, message: string) => {
    setAcquisitionPopup({ visible: true, title, message });
  };

  const handleAcquireScript = (scriptId: string, title: string) => {
    const wasListed = manager.scriptMarket.some((script) => script.id === scriptId);
    const beforeCount = manager.scriptMarket.length;
    acquireScript(scriptId);
    const stillListed = manager.scriptMarket.some((script) => script.id === scriptId);
    const acquired = wasListed && !stillListed && manager.scriptMarket.length < beforeCount;

    if (!acquired) {
      openAcquisitionPopup('Could not acquire script', 'Check funds, capacity, or contract locks and try again.');
      return;
    }

    setHiddenAcquiredScriptIds((current) => (current.includes(scriptId) ? current : [...current, scriptId]));
    openAcquisitionPopup('Script acquired', `"${title}" has been added to your slate.`);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Modal
        transparent
        animationType="fade"
        visible={acquisitionPopup.visible}
        onRequestClose={() => setAcquisitionPopup((current) => ({ ...current, visible: false }))}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{acquisitionPopup.title}</Text>
            <Text style={styles.modalBody}>{acquisitionPopup.message}</Text>
            <Pressable
              style={styles.modalButton}
              onPress={() => setAcquisitionPopup((current) => ({ ...current, visible: false }))}>
              <Text style={styles.modalButtonText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Text style={styles.title}>Script Room</Text>
      <Text style={styles.subtitle}>Acquire projects, evaluate projections, and open negotiations</Text>
      {lastMessage ? <Text style={styles.message}>{lastMessage}</Text> : null}

      <Pressable style={styles.actionButton} onPress={() => setShowHelp((value) => !value)}>
        <Text style={styles.actionText}>{showHelp ? 'Hide Help' : 'Show Help'}</Text>
      </Pressable>
      {showHelp ? (
        <View style={styles.card}>
          <Text style={styles.bodyStrong}>How to read this screen</Text>
          <Text style={styles.muted}>1) Balance script grade and asking price before you commit.</Text>
          <Text style={styles.muted}>2) Attach a director and satisfy actor/actress requirements before greenlight.</Text>
          <Text style={styles.muted}>3) Use negotiation rounds to target the highlighted pressure point.</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.bodyStrong}>
          Capacity {manager.projectCapacityUsed}/{manager.projectCapacityLimit}
        </Text>
        <Text style={styles.muted}>You cannot acquire new projects above capacity.</Text>
      </View>

      <IpMarketSection
        ipMarket={ipMarket}
        majorIpCommitments={majorIpCommitments}
        onAcquireRights={acquireIpRights}
        onStartAdaptation={developFromIp}
      />

      <NegotiationsSection
        manager={manager}
        onAdjust={adjustNegotiation}
      />

      <ScriptMarketSection
        scripts={visibleScriptMarket}
        manager={manager}
        onAcquire={handleAcquireScript}
        onPass={passScript}
      />

      <DevelopmentSection
        projects={developmentProjects}
        availableDirectors={availableDirectors}
        availableActors={availableActors}
        availableActresses={availableActresses}
        manager={manager}
        onStartNegotiation={startNegotiation}
        onAttachTalent={attachTalent}
      />
    </ScrollView>
  );
}
