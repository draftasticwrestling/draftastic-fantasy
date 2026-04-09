import { SPECIAL_MATCH_BATTLE_ROYAL_POINTS } from "@/lib/howItWorksPoints";
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
        Extra scoring for certain match types in addition to normal Raw / SmackDown or PLE match-card points.
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
    </section>
  );
}
