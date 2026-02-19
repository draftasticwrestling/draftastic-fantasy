import Link from "next/link";

export const metadata = {
  title: "MVL Example — The Road to SummerSlam — Draftastic Fantasy",
  description:
    "Minimum Viable League example: The Road to SummerSlam (May 1–Aug 2, 2026). Same scoring, multi-user leagues, drafting, and weekly matchups.",
};

type RoadmapItem = {
  id: number;
  title: string;
  description: string;
  subItems?: string[];
};

const ROADMAP_ITEMS: RoadmapItem[] = [
  {
    id: 1,
    title: "User accounts",
    description: "System for users to create accounts (sign up, sign in, profile).",
  },
  {
    id: 2,
    title: "Create a league & invite friends",
    description:
      "Users can create a league, invite friends to join, and manage league membership.",
  },
  {
    id: 3,
    title: "Drafting system",
    description: "Multiple draft options:",
    subItems: [
      "a) Live draft — hosted on the website with a real-time draft room.",
      "b) Auto-draft — owners set wrestler rankings and the site drafts teams automatically.",
      "c) Commissioner manual input — leagues run an off-line draft and the commissioner enters everyone's roster.",
    ],
  },
  {
    id: 4,
    title: "Drop wrestlers & sign free agents",
    description:
      "Owners can drop wrestlers from their roster and sign free agents (waiver / free-agent pool).",
  },
  {
    id: 5,
    title: "Trades between owners",
    description: "System for owners to propose and complete trades with other owners in the league.",
  },
  {
    id: 6,
    title: "Weekly matchups",
    description:
      "Weekly head-to-head matchups (owner vs owner) that award additional points.",
  },
];

export default function MVLPage() {
  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: 24,
        maxWidth: 960,
        margin: "0 auto",
        fontSize: 18,
        lineHeight: 1.6,
      }}
    >
      <p style={{ marginBottom: 24 }}>
        <Link href="/" style={{ color: "#1a73e8", textDecoration: "none" }}>
          ← Home
        </Link>
      </p>

      <h1 style={{ marginBottom: 8, fontSize: "1.75rem" }}>
        MVL Example: The Road to SummerSlam
      </h1>
      <p style={{ color: "#555", marginBottom: 32 }}>
        This is the <strong>Minimum Viable League (MVL)</strong> example — a
        full-featured fantasy league running from May 1, 2026 through Night 2 of
        SummerSlam on August 2, 2026. It uses the same{" "}
        <Link href="/how-it-works" style={{ color: "#1a73e8" }}>
          point system
        </Link>{" "}
        as the rest of Draftastic Fantasy; additional league structure details
        will be added as we go.
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.35rem", marginBottom: 12 }}>
          League window
        </h2>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>
            <strong>Start:</strong> May 1, 2026
          </li>
          <li>
            <strong>End:</strong> August 2, 2026 (Night 2 of SummerSlam)
          </li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.35rem", marginBottom: 12 }}>
          Scoring
        </h2>
        <p style={{ margin: 0 }}>
          Same scoring structure as the main app: match points, main event
          bonuses, title points, special match types, and PLE scaling. See{" "}
          <Link href="/how-it-works" style={{ color: "#1a73e8" }}>
            How it works
          </Link>{" "}
          for full details.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.35rem", marginBottom: 16 }}>
          MVL roadmap (to-do)
        </h2>
        <p style={{ color: "#555", marginBottom: 20 }}>
          The following features are planned for the MVL. More league structure
          (roster size, matchup rules, etc.) will be added as you provide it.
        </p>
        <ol
          style={{
            listStyle: "decimal",
            margin: 0,
            paddingLeft: 24,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {ROADMAP_ITEMS.map((item) => (
            <li
              key={item.id}
              style={{
                background: "#fafafa",
                border: "1px solid #e8e8e8",
                borderRadius: 8,
                padding: "16px 20px",
              }}
            >
              <strong style={{ fontSize: "1.05rem" }}>{item.title}</strong>
              <p style={{ margin: "8px 0 0 0", color: "#333" }}>
                {item.description}
              </p>
              {item.subItems && (
                <ul
                  style={{
                    margin: "10px 0 0 0",
                    paddingLeft: 20,
                    color: "#555",
                    fontSize: 15,
                  }}
                >
                  {item.subItems.map((sub, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>
                      {sub}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </section>

      <p style={{ color: "#666", fontSize: 15 }}>
        Ready to start building. Share league structure details when you have
        them and we’ll fold them into the plan.
      </p>
    </main>
  );
}
