"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/app/mock-draft/mock-draft.module.css";
import { BeginDraftForm } from "./BeginDraftForm";
import { GenerateDraftOrderForm } from "./GenerateDraftOrderForm";

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
  /** GM or site admin. Order and Begin Draft live in this room. */
  canManage: boolean;
  order: { overall_pick: number; user_id: string }[];
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
  canManage,
  order,
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
  const router = useRouter();
  const refreshing = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    function enterDraft(status: string | null | undefined) {
      if (cancelled || !status || status === "not_started" || refreshing.current) return;
      refreshing.current = true;
      router.refresh();
    }

    async function checkStatus() {
      const { data } = await supabase.from("leagues").select("draft_status").eq("id", leagueId).maybeSingle();
      if (cancelled) return;
      enterDraft((data as { draft_status?: string } | null)?.draft_status);
    }

    void checkStatus();
    const poll = window.setInterval(() => {
      void checkStatus();
    }, 2000);
    const channel = supabase
      .channel(`league-draft-status-${leagueId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "leagues", filter: `id=eq.${leagueId}` },
        (payload) => {
          enterDraft((payload.new as { draft_status?: string }).draft_status);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [leagueId, router]);

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

  const teamCount = useMemo(() => new Set(order.map((seat) => seat.user_id)).size, [order]);
  const teamIds = useMemo(() => order.slice(0, teamCount).map((seat) => seat.user_id), [order, teamCount]);
  const rounds = teamCount > 0 ? Math.ceil(order.length / teamCount) : 0;
  const nameById = useMemo(() => new Map(members.map((member) => [member.userId, member.name])), [members]);

  function overallFor(round: number, teamIndex: number): number {
    const indexInRound = round % 2 === 0 ? teamCount - 1 - teamIndex : teamIndex;
    return (round - 1) * teamCount + indexInRound + 1;
  }

  return (
    <div className={styles.roomPage}>
      <div className={styles.status}>
        <Link
          href={`/leagues/${leagueSlug}/draft`}
          className={styles.closeBtn}
          aria-label="Back to draft page"
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none", color: "inherit" }}
        >
          ×
        </Link>
        <div className={styles.statusMain}>
          <div className={styles.turnPill}>
            <span>Waiting to start</span>
          </div>
          <p className={styles.lastPick}>
            {hereCount} of {members.length} in the room · {readyCount} ready
            {scheduleLabel ? ` · ${scheduleLabel}` : ""}
          </p>
        </div>
      </div>
      <div className={styles.body}>
        {teamCount > 0 ? (
          <div className={styles.boardScroll}>
            <div className={styles.grid} style={{ ["--teams" as string]: String(teamCount) }}>
              {teamIds.map((userId) => (
                <div
                  key={`head-${userId}`}
                  className={`${styles.teamHead} ${userId === currentUserId ? styles.youHead : ""}`}
                >
                  {userId === currentUserId ? "You" : nameById.get(userId) ?? "Manager"}
                </div>
              ))}
              {Array.from({ length: rounds }, (_, roundIdx) => {
                const round = roundIdx + 1;
                return teamIds.map((_, teamIndex) => {
                  const overall = overallFor(round, teamIndex);
                  const indexInRound = round % 2 === 0 ? teamCount - teamIndex : teamIndex + 1;
                  return (
                    <div key={overall} className={styles.cell}>
                      <span className={styles.cellEmpty}>
                        {round}.{indexInRound}
                      </span>
                    </div>
                  );
                });
              })}
            </div>
          </div>
        ) : null}
        <section className={styles.dock} aria-label="Draft room">
          <div className={styles.tabs}>
            <button type="button" className={styles.tab} aria-selected="true">
              Room
            </button>
          </div>
          <div className={styles.dockBody}>
            <p className={styles.hint}>
              You are in the draft room. Mark ready when you can draft. The GM sets the order and begins the draft here.
            </p>
            {presenceError ? <p style={{ margin: "0 0 12px", color: "#b91c1c", fontSize: 14 }}>{presenceError}</p> : null}
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
                      {here ? "In the room" : "Away"}
                      {" · "}
                      {isReady ? "Ready" : "Not ready"}
                    </span>
                  </li>
                );
              })}
            </ul>
            {currentUserId ? (
              <button type="button" className={styles.primary} onClick={toggleReady}>
                {ready ? "Ready" : "Mark ready"}
              </button>
            ) : (
              <p className={styles.hint}>Sign in as a league member to enter the room.</p>
            )}
            {canManage ? (
              <div style={{ marginTop: 18 }}>
                <GenerateDraftOrderForm leagueSlug={leagueSlug} replaceExisting={order.length > 0} />
                {order.length > 0 ? (
                  <BeginDraftForm
                    leagueSlug={leagueSlug}
                    draftDateYmd={draftDateYmd}
                    showDateHint={showDateHint}
                    memberCount={memberCount}
                    maxTeams={maxTeams}
                    minTeams={minTeams}
                  />
                ) : (
                  <p className={styles.hint}>Set the draft order, then begin the draft from this room.</p>
                )}
              </div>
            ) : (
              <p className={styles.hint}>
                {order.length > 0
                  ? "The GM begins the draft from this room."
                  : "The GM sets the draft order, then begins the draft from this room."}
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
