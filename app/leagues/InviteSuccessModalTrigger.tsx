"use client";

import { useEffect, useState } from "react";
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
  /** Dismisses post-create modal while ?invite=1 is still in the URL until navigation finishes. */
  const [dismissedFromCreate, setDismissedFromCreate] = useState(false);

  useEffect(() => {
    if (show) setDismissedFromCreate(false);
  }, [show]);

  const showModal = localOpen || (show && !dismissedFromCreate);

  const handleClose = () => {
    setLocalOpen(false);
    if (show) {
      setDismissedFromCreate(true);
      router.replace(`/leagues/${leagueSlug}`, { scroll: false });
    }
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
