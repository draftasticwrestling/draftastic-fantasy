"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MANAGER_CATCHPHRASE_MAX_LENGTH,
  validateManagerCatchphraseForSave,
} from "@/lib/managerCatchphrase";
import { updateLeagueCatchphraseAction } from "./team/actions";

type Props = {
  leagueSlug: string;
  initialCatchphrase: string;
};

export function MyFactionCatchphraseBlock({ leagueSlug, initialCatchphrase }: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [phrase, setPhrase] = useState(initialCatchphrase.trim());
  const [draft, setDraft] = useState(initialCatchphrase.trim());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const t = initialCatchphrase.trim();
    setPhrase(t);
    setDraft(t);
  }, [initialCatchphrase]);

  const openDialog = () => {
    setDraft(phrase);
    setMessage(null);
    dialogRef.current?.showModal();
  };

  const persist = useCallback(
    async (value: string | null) => {
      const checked = validateManagerCatchphraseForSave(value);
      if (!checked.ok) {
        setMessage(checked.error);
        return false;
      }
      const result = await updateLeagueCatchphraseAction(leagueSlug, checked.value);
      if (result.error) {
        setMessage(result.error);
        return false;
      }
      setMessage(null);
      setPhrase(checked.value ?? "");
      router.refresh();
      return true;
    },
    [leagueSlug, router]
  );

  const onSave = async () => {
    setBusy(true);
    setMessage(null);
    const ok = await persist(draft.trim() || null);
    if (ok) dialogRef.current?.close();
    setBusy(false);
  };

  const onRemove = async () => {
    setBusy(true);
    setMessage(null);
    const ok = await persist(null);
    if (ok) {
      setDraft("");
      dialogRef.current?.close();
    }
    setBusy(false);
  };

  const display = phrase.trim();

  return (
    <div className="lm-myteam-catchphrase-block">
      <div className="lm-myteam-catchphrase-row">
        {display ? (
          <p className="lm-myteam-catchphrase">“{display}”</p>
        ) : (
          <p className="lm-myteam-catchphrase lm-myteam-catchphrase--empty">No catchphrase yet</p>
        )}
        <button
          type="button"
          className={`lm-myteam-catchphrase-edit${busy ? " lm-myteam-catchphrase-edit--busy" : ""}`}
          aria-label={busy ? "Saving catchphrase…" : display ? "Edit catchphrase" : "Add catchphrase"}
          disabled={busy}
          onClick={openDialog}
        >
          <span className="lm-myteam-catchphrase-edit-chip">{busy ? "…" : "Edit"}</span>
        </button>
      </div>

      <dialog ref={dialogRef} className="lm-myteam-avatar-dialog lm-myteam-catchphrase-dialog">
        <h3 className="lm-myteam-avatar-dialog-title">Manager catchphrase</h3>
        <p className="lm-myteam-catchphrase-dialog-hint">
          A short tagline for this league only. Shown in standings and on your faction page. Must be different from
          every other manager&apos;s phrase here (not case-sensitive). Max {MANAGER_CATCHPHRASE_MAX_LENGTH}{" "}
          characters.
        </p>
        <input
          type="text"
          className="lm-myteam-catchphrase-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MANAGER_CATCHPHRASE_MAX_LENGTH + 10}
          placeholder='e.g. "Rent&apos;s Due!"'
          disabled={busy}
          autoComplete="off"
        />
        {draft.trim().length > MANAGER_CATCHPHRASE_MAX_LENGTH ? (
          <p className="lm-myteam-catchphrase-dialog-warn">
            {draft.trim().length}/{MANAGER_CATCHPHRASE_MAX_LENGTH} — shorten to save.
          </p>
        ) : null}
        {message ? (
          <p className="lm-myteam-avatar-msg" role="alert">
            {message}
          </p>
        ) : null}
        <div className="lm-myteam-catchphrase-dialog-actions">
          <button type="button" className="lm-myteam-catchphrase-save" disabled={busy} onClick={onSave}>
            {busy ? "Saving…" : "Save"}
          </button>
          {phrase.trim() ? (
            <button type="button" className="lm-myteam-catchphrase-remove" disabled={busy} onClick={onRemove}>
              Remove
            </button>
          ) : null}
          <button
            type="button"
            className="lm-myteam-avatar-dialog-close"
            disabled={busy}
            onClick={() => dialogRef.current?.close()}
          >
            Cancel
          </button>
        </div>
      </dialog>
    </div>
  );
}
