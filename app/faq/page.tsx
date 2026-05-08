import Link from "next/link";

const SUPPORT_EMAIL = "draftasticwrestling@gmail.com";

type FaqItem = {
  q: string;
  a: React.ReactNode;
};

type FaqSection = {
  id: string;
  title: string;
  items: FaqItem[];
};

const SECTIONS: FaqSection[] = [
  {
    id: "fantasy-gameplay",
    title: "Fantasy Gameplay",
    items: [
      {
        q: "How is fantasy scoring calculated?",
        a: (
          <>
            Every wrestler&apos;s fantasy output is grouped into three buckets: <strong>R/S</strong> (weekly show
            points), <strong>PLE</strong> (Premium Live Event points), and <strong>Belt</strong> (title-related points).
            A wrestler&apos;s total fantasy points are the sum of those categories. Team and league views use that same
            underlying scoring model.
          </>
        ),
      },
      {
        q: "When do points update during and after events?",
        a: (
          <>
            Points can appear in stages as event data is processed. During and shortly after a show, totals may update
            incrementally. Once event parsing and validation complete, finalized totals are reflected across league
            views.
          </>
        ),
      },
      {
        q: "What time zone does Draftastic use for locks, weekly windows, and matchup timing?",
        a: (
          <>
            League operations that depend on a weekly window use a consistent league clock (Monday-Sunday). Where
            applicable, lock windows and cutoff rules are based on league-defined timing so all managers are evaluated
            consistently, regardless of local device time.
          </>
        ),
      },
      {
        q: "How do seasons work?",
        a: (
          <>
            Each league has a defined start date and end date. Within that window, leagues run regular-season weeks
            and (for formats that use them) playoff weeks. Matchups, standings behavior, and schedule progression are
            all tied to that season window.
          </>
        ),
      },
      {
        q: "How do Head-to-Head matchups work?",
        a: (
          <>
            In Head-to-Head leagues, teams are paired weekly and compared on that week&apos;s event points. Each matchup
            produces a win, loss, or draw. Standings are driven by <strong>W-L-D (Win-Loss-Draw)</strong> record, not
            cumulative owner bonus scoring.
          </>
        ),
      },
      {
        q: "How do standings work in different league types?",
        a: (
          <>
            Standings depend on league format. Some formats are primarily points-based, while Head-to-Head formats
            prioritize <strong>W-L-D (Win-Loss-Draw)</strong> record. If records tie, secondary tie-break logic can use
            scoring context.
          </>
        ),
      },
      {
        q: "How do roster moves affect scoring?",
        a: (
          <>
            Roster transactions only affect scoring when they occur before applicable lock cutoffs. If a move is made
            after an event or matchup lock point, it applies to future eligible scoring windows.
          </>
        ),
      },
      {
        q: "How does XP work?",
        a: (
          <>
            XP is progression for account activity and league participation. Users can earn XP through gameplay
            milestones and engagement actions. As XP increases, users level up and unlock higher rank labels. For full
            details, see{" "}
            <Link href="/xp-scoring-levels" className="app-link">
              XP Scoring &amp; Level Descriptions
            </Link>
            .
          </>
        ),
      },
      {
        q: "Why did I level up (or not level up) after an action?",
        a: (
          <>
            Some XP grants can be processed immediately; others can appear after a short delay due to async processing
            or throttled refresh checks. If a level-up didn&apos;t appear instantly, refresh and re-check after processing
            completes. For exact thresholds and grant sources, see{" "}
            <Link href="/xp-scoring-levels" className="app-link">
              XP Scoring &amp; Level Descriptions
            </Link>
            .
          </>
        ),
      },
    ],
  },
  {
    id: "event-results",
    title: "Event Results",
    items: [
      {
        q: "When are event results posted?",
        a: "Event results are posted after official outcomes are available and processed by the scoring pipeline. Timing can vary by event complexity and data verification needs.",
      },
      {
        q: "Why do match cards show fantasy points?",
        a: "Match card views help users see how outcomes translate to fantasy impact. They reflect the scoring model applied to participants in that event context.",
      },
      {
        q: "Why did points change after I first saw them?",
        a: "Early values can be provisional while data is being finalized. Reconciliation, classification updates, or correction passes can adjust totals before they settle.",
      },
      {
        q: "What is a stat correction?",
        a: "A stat correction is an update applied when event data or parsing needs to be fixed for accuracy. Corrections are intended to make scoring consistent with official outcomes and rules.",
      },
      {
        q: "How long do corrections take?",
        a: "Most corrections are applied as soon as they are validated. More complex issues may take longer if they require deeper review across multiple views or events.",
      },
      {
        q: "Why do two pages sometimes show slightly different totals temporarily?",
        a: "Some pages are cached or revalidated on different intervals. During refresh windows, one page may show newer data first. Totals converge once all affected caches revalidate.",
      },
      {
        q: "How are title and belt-related points handled?",
        a: "Wrestler belt points remain part of normal wrestler scoring. Any owner-level bonus systems (if used by a format) are format-specific and are applied only where that league type supports them.",
      },
    ],
  },
  {
    id: "accounts",
    title: "Accounts",
    items: [
      {
        q: "How do I create an account?",
        a: "Use the sign-up flow with your email and password, then complete any verification step if prompted. After account creation, you can join or create leagues.",
      },
      {
        q: "How do I join a league?",
        a: "Join using a valid invite link or join code from a GM. If a league has reached its member cap or the invite is invalid or expired, joining will fail until a valid slot or link is available.",
      },
      {
        q: "How do I create a league?",
        a: "From your leagues area, choose create league, set format and season settings, and finish setup. You become the GM and can manage invites and league configuration.",
      },
      {
        q: "I forgot my password or cannot sign in. What should I do?",
        a: "Use password reset first. If sign-in still fails, confirm the account email used at signup and retry from a clean browser session.",
      },
      {
        q: "How do I update profile or faction details?",
        a: "Account-level info (like display identity) is managed from account or profile areas. League-specific identity elements (team name, faction details) are managed inside that league.",
      },
      {
        q: "Why cannot I access a league page?",
        a: "Access is restricted to league members (and approved admin contexts). If you are not a member or your session expired, league routes can reject access.",
      },
      {
        q: "Can I be in multiple leagues at once?",
        a: "Yes. You can participate in multiple leagues and switch between them through the league selector and navigation.",
      },
    ],
  },
  {
    id: "league-management-gms",
    title: "League Management (GMs)",
    items: [
      {
        q: "What can GMs control?",
        a: "GMs can configure league settings, invite members, manage draft setup, and handle format-specific operations available in GM tools.",
      },
      {
        q: "How do draft settings work?",
        a: "Draft settings control mode, timing, order behavior, and status transitions. Once a draft is active or completed, some settings become locked to preserve integrity.",
      },
      {
        q: "What do draft statuses mean?",
        a: "Statuses represent lifecycle phases such as not started, in progress, review-ready (if enabled), and completed. Available actions depend on current status.",
      },
      {
        q: "How do roster rules work by format and team size?",
        a: "Roster size and composition rules are tied to league settings and team count. Different formats can enforce different roster constraints.",
      },
      {
        q: "What changes when Include NXT is enabled?",
        a: "Include NXT expands the eligible wrestler pool and can affect roster rule behavior and filtering defaults in relevant league views.",
      },
      {
        q: "How are playoffs generated?",
        a: "Playoff matchups are generated after regular-season conditions are satisfied (for example, required weeks completed and seeding finalized). Until then, future rounds may remain unset.",
      },
      {
        q: "How do GM invites work?",
        a: "GMs can share invite links or join codes. If users cannot join, common causes are invalid code, expired invite, or league capacity limits.",
      },
    ],
  },
  {
    id: "troubleshooting-support",
    title: "Troubleshooting & Support",
    items: [
      {
        q: "I see “Something went wrong.” What should I do first?",
        a: "Refresh the page, retry the action, and re-open from league navigation. If it persists, sign out/in and test once more.",
      },
      {
        q: "Why is a page slow right now?",
        a: "Heavier pages may aggregate large data windows and can run slower during cache refreshes or after major updates. Most recover once caches warm.",
      },
      {
        q: "My draft/autopick preferences did not save. Why?",
        a: "Common reasons: draft status no longer editable, invalid list requirements, or selecting a board that is not supported for that league's format and pool rules.",
      },
      {
        q: "Why is my data stale after a move or update?",
        a: "Some views revalidate on intervals. A short delay can occur before all pages reflect the newest state. Manual refresh usually picks up revalidated data sooner.",
      },
      {
        q: "How do I report a bug effectively?",
        a: "Include: league name or slug, exact page URL, timestamp/time zone, screenshot, what you expected, and what happened instead. Repro steps are especially helpful.",
      },
      {
        q: "How do I contact support?",
        a: (
          <>
            Email us at{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="app-link">
              {SUPPORT_EMAIL}
            </a>{" "}
            and include the bug details checklist above so triage can happen quickly.
          </>
        ),
      },
    ],
  },
];

export const metadata = {
  title: "FAQ — Draftastic Fantasy",
  description: "Frequently asked questions about gameplay, scoring, events, accounts, GM tools, and support.",
};

export default function FaqPage() {
  return (
    <main className="app-page" style={{ maxWidth: 920, fontSize: 16, lineHeight: 1.55 }}>
      <p style={{ marginBottom: 24 }}>
        <Link href="/">← Home</Link>
      </p>
      <h1 style={{ marginBottom: 8 }}>Frequently Asked Questions</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 20 }}>
        Quick answers for gameplay, results, account access, GM controls, and support.
      </p>

      <nav
        aria-label="FAQ sections"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 24,
        }}
      >
        {SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="app-link"
            style={{
              fontSize: 13,
              textDecoration: "none",
              border: "1px solid var(--color-border)",
              borderRadius: 999,
              padding: "6px 10px",
              background: "var(--color-bg-surface)",
            }}
          >
            {section.title}
          </a>
        ))}
      </nav>

      <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
        {SECTIONS.map((section) => (
          <section key={section.id} id={section.id} style={{ scrollMarginTop: 90 }}>
            <h2 style={{ marginBottom: 12 }}>{section.title}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {section.items.map((item) => (
                <details
                  key={item.q}
                  style={{
                    border: "1px solid var(--color-border)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    background: "var(--color-bg-surface)",
                  }}
                >
                  <summary style={{ cursor: "pointer", fontWeight: 700 }}>{item.q}</summary>
                  <div style={{ marginTop: 8, color: "var(--color-text-muted)" }}>{item.a}</div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
