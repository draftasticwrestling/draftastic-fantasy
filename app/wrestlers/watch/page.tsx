import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addToWatchlist, getWatchlistWrestlerIds } from "@/lib/watchlist";
import { removeFromWatchlistAction } from "./actions";

export const metadata = {
  title: "Watch List — Wrestlers — Draftastic Fantasy",
  description: "Wrestlers on your watch list",
};

export const dynamic = "force-dynamic";

export default async function WrestlersWatchPage({
  searchParams,
}: {
  searchParams?: Promise<{ add?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const addId = typeof sp.add === "string" ? sp.add.trim() : undefined;

  if (addId) {
    const result = await addToWatchlist(addId);
    if (!result.error) redirect("/wrestlers/watch");
  }

  const ids = await getWatchlistWrestlerIds();
  const supabase = await createClient();
  const { data: wrestlers } =
    ids.length > 0
      ? await supabase
          .from("wrestlers")
          .select("id, name, gender, brand, image_url")
          .in("id", ids)
      : { data: [] as { id: string; name: string | null; gender: string | null; brand: string | null; image_url: string | null }[] };

  const order = new Map(ids.map((id, i) => [id, i]));
  const sorted = (wrestlers ?? []).slice().sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  return (
    <div className="wrestlers-placeholder">
      <h2 style={{ fontSize: "1.25rem", marginBottom: 12 }}>Watch List</h2>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 24 }}>
        Wrestlers you have added to your watch list appear here. Use the flag (⚑) on League Leaders or Free Agents to add wrestlers.
      </p>

      {sorted.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--color-text-dim)" }}>
          Your watch list is empty. Go to a league&apos;s League Leaders or Free Agents and click the flag next to a wrestler to add them.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {sorted.map((w) => (
            <li
              key={w.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 0",
                borderBottom: "1px solid var(--color-border-light)",
              }}
            >
              {w.image_url ? (
                <img
                  src={w.image_url}
                  alt=""
                  width={40}
                  height={40}
                  style={{ borderRadius: "50%", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: "var(--color-bg-elevated)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--color-text-muted)",
                  }}
                >
                  —
                </div>
              )}
              <Link
                href={`/wrestlers/${encodeURIComponent(w.id)}`}
                style={{ color: "var(--color-blue)", textDecoration: "none", fontWeight: 500, flex: 1 }}
              >
                {w.name ?? w.id}
              </Link>
              <form action={removeFromWatchlistAction} style={{ margin: 0 }}>
                <input type="hidden" name="wrestlerId" value={w.id} />
                <button
                  type="submit"
                  style={{
                    padding: "4px 10px",
                    fontSize: 12,
                    color: "var(--color-text-muted)",
                    background: "none",
                    border: "1px solid var(--color-border)",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
