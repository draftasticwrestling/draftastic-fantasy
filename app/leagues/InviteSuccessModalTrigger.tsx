"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InviteSuccessModal } from "./InviteSuccessModal";

type Props = {
  show: boolean;
  leagueId: string;
  leagueName: string;
  leagueSlug: string;
  joinCode?: string | null;
  /** When true, render an "Invite Managers" primary button that opens the modal */
  showInviteButton?: boolean;
};

export function InviteSuccessModalTrigger({
  show,
  leagueId,
  leagueName,
  leagueSlug,
  joinCode,
  showInviteButton = false,
}: Props) {
  const router = useRouter();
  const [localOpen, setLocalOpen] = useState(false);
  const showModal = show || localOpen;

  const handleClose = () => {
    setLocalOpen(false);
    router.replace(`/leagues/${leagueSlug}`);
  };

  return (
    <>
      <InviteSuccessModal
        show={showModal}
        leagueId={leagueId}
        leagueName={leagueName}
        joinCode={joinCode}
        onClose={handleClose}
      />
      {showInviteButton && (
        <button
          type="button"
          className="lm-btn-primary"
          onClick={() => setLocalOpen(true)}
        >
          Invite Managers
        </button>
      )}
    </>
  );
}
