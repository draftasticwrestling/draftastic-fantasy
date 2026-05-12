import { SPECIAL_MATCH_BATTLE_ROYAL_POINTS, SPECIAL_MATCH_VICTORY_BONUS_BY_EVENT_TIER } from "@/lib/howItWorksPoints";
import styles from "./HowItWorks.module.css";

type Props = {
  /** RTS tab has no Royal Rumble card; Legacy has RR under major PLEs. */
  variant: "rts" | "legacy";
};

export function HowItWorksSpecialMatches({ variant }: Props) {
  const royalRumbleNote =
    variant === "rts"
      ? "Does not apply to the Royal Rumble premium live event — that match uses its own scoring (see the Legacy League tab, Royal Rumble)."
      : "The Royal Rumble premium live event uses the separate scoring listed on the Royal Rumble card under major PLEs below.";

  return (
    <section style={{ marginBottom: 40 }}>
      <h2 className={styles.sectionTitle}>Special matches</h2>
      <p style={{ marginBottom: 16, color: "#555", textAlign: "center", maxWidth: 720, marginLeft: "auto", marginRight: "auto" }}>
        For these match types, the special table is used <strong>instead of</strong> the usual Raw / SmackDown or PLE “on the
        card” and “winning your match” points for that match (so you are not double-counted for appearing).
      </p>

      <h3 style={{ fontSize: "1.15rem", marginBottom: 8, fontWeight: 700, textAlign: "center" }}>
        Battle royals (non–Royal Rumble)
      </h3>
      <p
        style={{
          marginBottom: 16,
          color: "#555",
          textAlign: "center",
          maxWidth: 720,
          marginLeft: "auto",
          marginRight: "auto",
          fontSize: 15,
        }}
      >
        Standard battle royals on Raw, SmackDown, or a PLE undercard. {royalRumbleNote}
      </p>
      <div className={styles.darkBox}>
        <div className={styles.specialMatchesInner}>
          {SPECIAL_MATCH_BATTLE_ROYAL_POINTS.map(([action, pts], i) => (
            <div key={i} className={styles.pointRow}>
              <span>{action}</span>
              <span className={styles.pointRowPoints}>{pts}</span>
            </div>
          ))}
        </div>
      </div>

      <h3 style={{ fontSize: "1.15rem", marginBottom: 8, fontWeight: 700, textAlign: "center" }}>
        Multi-person / round-based victory bonus
      </h3>
      <p
        style={{
          marginBottom: 16,
          color: "#555",
          textAlign: "center",
          maxWidth: 760,
          marginLeft: "auto",
          marginRight: "auto",
          fontSize: 15,
        }}
      >
        Multi-person and multi-team matches (triple threat, fatal four-way, five-way, handicap 2v1, etc.) earn an extra
        victory bonus of <strong>one tier point per opponent beyond the first</strong> you defeat in that match (a normal
        singles match has one opponent, so no bonus). <strong>2 out of 3 Falls</strong> and <strong>Gauntlet</strong>{" "}
        matches still award this same tier per round won.
      </p>
      <div className={styles.darkBox}>
        <div className={styles.specialMatchesInner}>
          {SPECIAL_MATCH_VICTORY_BONUS_BY_EVENT_TIER.map(([label, pts]) => (
            <div key={label} className={styles.pointRow}>
              <span>{label}</span>
              <span className={styles.pointRowPoints}>{pts}</span>
            </div>
          ))}
        </div>
      </div>
      {variant === "rts" ? (
        <p
          style={{
            marginTop: -10,
            marginBottom: 0,
            color: "#555",
            textAlign: "center",
            maxWidth: 760,
            marginLeft: "auto",
            marginRight: "auto",
            fontSize: 14,
          }}
        >
          Examples: a 4-team tag winner at WrestleMania with three defeated sides earns <strong>+6</strong> (2
          additional sides beyond the first × 3 major-ple points each). A Raw fatal four-way winner with three defeated
          opponents earns <strong>+2</strong> (2 additional opponents × 1 weekly point each). A Raw triple-threat winner
          earns <strong>+1</strong> (one additional opponent beyond the first).
        </p>
      ) : null}
    </section>
  );
}
