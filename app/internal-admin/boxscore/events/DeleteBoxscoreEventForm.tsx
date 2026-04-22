"use client";

import { useActionState } from "react";
import { deleteBoxscoreEventAction, type DeleteBoxscoreEventState } from "./actions";

const INITIAL_STATE: DeleteBoxscoreEventState = null;

export function DeleteBoxscoreEventForm({ eventId, eventName }: { eventId: string; eventName: string }) {
  const [state, formAction, pending] = useActionState(deleteBoxscoreEventAction, INITIAL_STATE);

  return (
    <form action={formAction} style={{ display: "inline-flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <input type="hidden" name="event_id" value={eventId} />
      <input
        name="reason"
        required
        placeholder="Reason for delete"
        className="admin-article-input"
        style={{ width: 180, minWidth: 160 }}
        aria-label={`Delete reason for ${eventName}`}
      />
      <input
        name="confirm_text"
        required
        placeholder="Type DELETE"
        className="admin-article-input"
        style={{ width: 130 }}
        aria-label={`Type DELETE to confirm deleting ${eventName}`}
      />
      <button
        type="submit"
        className="admin-article-submit"
        disabled={pending}
        style={{ background: "#b91c1c", borderColor: "#991b1b" }}
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {state?.error ? (
        <span style={{ color: "#b91c1c", fontSize: 12, maxWidth: 260 }} role="alert">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
