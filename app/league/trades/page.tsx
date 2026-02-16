import { EXAMPLE_LEAGUE } from "@/lib/league";
import TradeManager from "../TradeManager";

export const metadata = {
  title: `Trades — ${EXAMPLE_LEAGUE.name} — Draftastic Fantasy`,
  description: "Record and view league trades.",
};

export default function LeagueTradesPage() {
  return (
    <>
      <h1 style={{ marginBottom: 8 }}>Trades</h1>
      <p style={{ color: "#555", marginBottom: 32 }}>
        Record trades (wrestlers and draft picks) and view trade history.
      </p>
      <TradeManager />
    </>
  );
}
