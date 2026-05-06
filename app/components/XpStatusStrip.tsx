import { getXpLevelInfo } from "@/lib/xp/xpLevels";

type Props = {
  totalXp: number;
  className?: string;
};

export default function XpStatusStrip({ totalXp, className }: Props) {
  const xp = Math.max(0, Math.floor(Number(totalXp) || 0));
  const level = getXpLevelInfo(xp);
  const pct = level.nextMinXp != null ? Math.round(level.progressToNext * 100) : 100;

  return (
    <div className={`xp-status-strip${className ? ` ${className}` : ""}`}>
      <div className="xp-status-strip__top">
        <span className="xp-status-strip__xp">XP: {xp.toLocaleString()}</span>
      </div>
      <div
        className="xp-status-strip__bar"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`XP progress to ${level.nextLabel ?? "max level"}`}
      >
        <span className="xp-status-strip__bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="xp-status-strip__bottom">
        <span className="xp-status-strip__level">{level.label}</span>
      </div>
    </div>
  );
}
