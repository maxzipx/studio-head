/**
 * useNegotiationModal — encapsulates the open/close/submit state for the
 * talent negotiation modal in the Talent screen.
 *
 * Extracted from app/(tabs)/talent.tsx to keep the screen component focused on
 * layout rather than negotiation orchestration.
 */

import { useState } from 'react';
import type { StudioManager } from '@/src/domain/studio-manager';
import type { MovieProject, NegotiationAction, Talent } from '@/src/domain/types';

export interface NegotiationModalState {
  /** The talent currently being negotiated with, or null if modal is closed. */
  talent: Talent | null;
  /** The negotiation action selected for round 1. */
  draftAction: NegotiationAction;
  /** Preview of the negotiation outcome given the current draft action. */
  preview: ReturnType<StudioManager['previewTalentNegotiationRound']> | null;
  /** Whether the submit button should be disabled. */
  submitDisabled: boolean;
  open: (talentId: string) => void;
  close: () => void;
  setDraftAction: (action: NegotiationAction) => void;
  submit: () => void;
}

export function useNegotiationModal(
  manager: StudioManager,
  activeProject: MovieProject | null,
  startNegotiation: (projectId: string, talentId: string) => void,
  adjustNegotiation: (projectId: string, talentId: string, action: NegotiationAction) => void,
): NegotiationModalState {
  const [talentId, setTalentId] = useState<string | null>(null);
  const [draftAction, setDraftAction] = useState<NegotiationAction>('holdFirm');

  const talent = talentId ? (manager.talentPool.find((t) => t.id === talentId) ?? null) : null;

  const preview =
    activeProject && talent
      ? manager.previewTalentNegotiationRound(activeProject.id, talent.id, draftAction)
      : null;

  const submitDisabled = !activeProject || !talent || !preview?.success;

  const open = (id: string) => {
    setDraftAction('holdFirm');
    setTalentId(id);
  };

  const close = () => {
    setTalentId(null);
    setDraftAction('holdFirm');
  };

  const submit = () => {
    if (!activeProject || !talentId) return;
    const wasOpen = manager.playerNegotiations.some(
      (entry) => entry.projectId === activeProject.id && entry.talentId === talentId
    );
    startNegotiation(activeProject.id, talentId);
    const isOpen = manager.playerNegotiations.some(
      (entry) => entry.projectId === activeProject.id && entry.talentId === talentId
    );
    if (!wasOpen && isOpen) {
      adjustNegotiation(activeProject.id, talentId, draftAction);
    }
    close();
  };

  return { talent, draftAction, preview, submitDisabled, open, close, setDraftAction, submit };
}
