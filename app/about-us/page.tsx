import Link from "next/link";

const CONTACT_EMAIL = "draftasticwrestling@gmail.com";

export const metadata = {
  title: "About Us — Draftastic Pro Wrestling",
  description:
    "Who we are, why we built Draftastic Fantasy Pro Wrestling, and how to reach us with questions or corrections.",
};

export default function AboutUsPage() {
  return (
    <main className="app-page">
      <p style={{ marginBottom: 16 }}>
        <Link href="/" className="app-link">
          ← Home
        </Link>
      </p>

      <h1 style={{ fontSize: "1.75rem", marginBottom: 12, fontWeight: 700 }}>About us</h1>

      <section style={{ marginBottom: 36, lineHeight: 1.65, color: "var(--color-text)" }}>
        <p style={{ margin: "0 0 1rem" }}>
          Draftastic Fantasy Pro Wrestling is for fans who want{" "}
          <strong>putting the sport back in sports entertainment</strong> to mean something week to week: draft a roster,
          track every match, and compete with friends while RAW, SmackDown, and every Premium Live Event actually
          matters on the scoreboard.
        </p>
        <p style={{ margin: "0 0 1rem" }}>
          We started as three longtime wrestling fans who went to our first WWE show in over twenty years and walked out
          hooked all over again — then went looking for a fantasy league worth our time and didn&apos;t find much that
          fit. So we did what wrestling fans do: we built our own, first as a spreadsheet and a scoring system, then as
          a league with friends who suddenly cared a lot about what happened on TV. The more we refined it, the more we
          were studying the product, debating it, drafting it, and trash-talking about it.
        </p>
        <p style={{ margin: 0 }}>
          Now we&apos;re sharing that same energy with the wider audience: wrestling as drama, strategy, and
          competition — and you&apos;re part of the game.
        </p>
      </section>

      <section className="app-card" aria-labelledby="contact-heading">
        <div className="app-card-header">
          <h2 id="contact-heading" style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>
            Contact us
          </h2>
        </div>
        <div style={{ padding: "20px 22px", lineHeight: 1.6 }}>
          <p style={{ margin: "0 0 1rem", color: "var(--color-text-muted)" }}>
            We read every message. Reach out if you have <strong>questions</strong> about the site or how scoring works,{" "}
            <strong>suggestions</strong> for how we can make Draftastic better, or{" "}
            <strong>corrections</strong> to stats, results, or title history so we can keep the record as accurate as
            possible.
          </p>
          <p style={{ margin: 0, fontSize: "1.05rem" }}>
            <a href={`mailto:${CONTACT_EMAIL}`} className="app-link" style={{ wordBreak: "break-all" }}>
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
