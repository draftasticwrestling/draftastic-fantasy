"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BeginDraftForm } from "./BeginDraftForm";

const HERE_MS = 45_000;
const HEARTBEAT_MS = 20_000;

type Member = {
  userId: string;
  name: string;
  isGm: boolean;
};

type LobbyRow = {
  user_id: string;
  is_ready: boolean;
  last_seen_at: string;
};

type Props = {
  leagueId: string;
  leagueSlug: string;
  currentUserId: string | null;
  members: Member[];
  /** GM or site admin, and a pick order already exists. */
  canStart: boolean;
  orderReady: boolean;
  draftDateYmd: string | null;
  scheduleLabel: string | null;
  showDateHint: boolean;
  memberCount: number;
  maxTeams: number | null;
  minTeams: number;
};

export function LiveDraftLobby({
  leagueId,
  leagueSlug,
  currentUserId,
  members,
  canStart,
  orderReady,
  draftDateYmd,
  scheduleLabel,
  showDateHint,
  memberCount,
  maxTeams,
  minTeams,
}: Props) {
  const [rows, setRows] = useState<LobbyRow[]>([]);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [presenceError, setPresenceError] = useState<string | null>(null);
  const readyRef = useRef(false);
  readyRef.current = ready;

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    const userId = currentUserId;
    const supabase = createClient();
    let cancelled = false;

    async function beat(isReady: boolean) {
      const { error } = await supabase.from("league_draft_lobby").upsert(
        {
          league_id: leagueId,
          user_id: userId,
          is_ready: isReady,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "league_id,user_id" }
      );
      if (!cancelled && error) {
        setPresenceError("Could not update your lobby status. Apply the live-draft lobby database update, then refresh.");
      }
    }

    async function loadRows() {
      const { data, error } = await supabase
        .from("league_draft_lobby")
        .select("user_id, is_ready, last_seen_at")
        .eq("league_id", leagueId);
      if (cancelled) return null;
      if (error) {
        setPresenceError("The lobby list could not load. Apply the live-draft lobby database update, then refresh.");
        return null;
      }
      setPresenceError(null);
      const list = (data ?? []) as LobbyRow[];
      setRows(list);
      return list;
    }

    async function join() {
      const list = await loadRows();
      if (!list || cancelled) return;
      const mine = list.find((row) => row.user_id === userId);
      const initialReady = mine?.is_ready ?? false;
      readyRef.current = initialReady;
      setReady(initialReady);
      await beat(initialReady);
    }

    void join();
    const heartbeat = window.setInterval(() => {
      void beat(readyRef.current);
    }, HEARTBEAT_MS);

    const channel = supabase
      .channel(`league-draft-lobby-${leagueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "league_draft_lobby", filter: `league_id=eq.${leagueId}` },
        () => {
          void loadRows();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.clearInterval(heartbeat);
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, leagueId]);

  const byUser = useMemo(() => new Map(rows.map((row) => [row.user_id, row])), [rows]);
  const hereCount = members.filter((member) => {
    const row = byUser.get(member.userId);
    if (!row) return false;
    return now - new Date(row.last_seen_at).getTime() <= HERE_MS;
  }).length;
  const readyCount = members.filter((member) => byUser.get(member.userId)?.is_ready).length;

  function toggleReady() {
    if (!currentUserId) return;
    const next = !ready;
    readyRef.current = next;
    setReady(next);
    setRows((current) => {
      const others = current.filter((row) => row.user_id !== currentUserId);
      return [...others, { user_id: currentUserId, is_ready: next, last_seen_at: new Date().toISOString() }];
    });
    const supabase = createClient();
    void supabase
      .from("league_draft_lobby")
      .upsert(
        {
          league_id: leagueId,
          user_id: currentUserId,
          is_ready: next,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "league_id,user_id" }
      )
      .then(({ error }) => {
        if (error) setPresenceError("Could not save ready status.");
      });
  }

  return (
    <section
      aria-labelledby="live-draft-lobby-heading"
      style={{
        marginBottom: 24,
        padding: "16px 18px",
        background: "var(--color-bg-elevated)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--color-border)",
      }}
    >
      <h2 id="live-draft-lobby-heading" style={{ fontSize: "1.1rem", margin: "0 0 8px" }}>
        Live draft lobby
      </h2>
      {scheduleLabel ? (
        <p style={{ margin: "0 0 8px", fontSize: 14 }}>
          <strong>Draft time:</strong> {scheduleLabel}
        </p>
      ) : null}
      <p style={{ margin: "0 0 12px", color: "var(--color-text-muted)", fontSize: 14 }}>
        {hereCount} of {members.length} in the lobby · {readyCount} ready. Open this page to show as in the lobby, then
        mark ready. The GM starts the draft when the group is set.
      </p>
      {presenceError ? (
        <p style={{ margin: "0 0 12px", color: "#b91c1c", fontSize: 14 }}>{presenceError}</p>
      ) : null}
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px" }}>
        {members.map((member) => {
          const row = byUser.get(member.userId);
          const here = row != null && now - new Date(row.last_seen_at).getTime() <= HERE_MS;
          const isReady = Boolean(row?.is_ready);
          const you = member.userId === currentUserId;
          return (
            <li
              key={member.userId}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                padding: "8px 0",
                borderTop: "1px solid var(--color-border)",
                fontSize: 14,
              }}
            >
              <span>
                <strong>{member.name}</strong>
                {member.isGm ? " · GM" : ""}
                {you ? " · You" : ""}
              </span>
              <span style={{ color: here ? "#0d7d0d" : "var(--color-text-muted)", textAlign: "right" }}>
                {here ? "In the lobby" : "Away"}
                {" · "}
                {isReady ? "Ready" : "Not ready"}
              </span>
            </li>
          );
        })}
      </ul>
      {currentUserId ? (
        <button type="button" className="app-button" onClick={toggleReady} style={{ marginBottom: 16 }}>
          {ready ? "Ready" : "Mark ready"}
        </button>
      ) : (
        <p style={{ margin: "0 0 12px", fontSize: 14 }}>Sign in as a league member to join the lobby.</p>
      )}
      {canStart ? (
        <BeginDraftForm
          leagueSlug={leagueSlug}
          draftDateYmd={draftDateYmd}
          showDateHint={showDateHint}
          memberCount={memberCount}
          maxTeams={maxTeams}
          minTeams={minTeams}
        />
      ) : (
        <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-muted)" }}>
          {orderReady
            ? "The GM starts the draft from this lobby."
            : "The GM sets the draft order, then starts the draft from this lobby."}
        </p>
      )}
    </section>
  );
}
