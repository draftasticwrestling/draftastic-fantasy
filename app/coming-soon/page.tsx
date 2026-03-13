import Link from "next/link";
import Image from "next/image";
import { EmailSignupForm } from "./EmailSignupForm";

const IMG = "https://qvbqxietcmweltxoonvh.supabase.co/storage/v1/object/public/draftastic-screenshots";

export default function ComingSoonPage() {
  return (
    <>
      {/* 1. Hero Section (Above the Fold) */}
      <section className="cs-hero">
        <div className="cs-hero-inner">
          <h1 className="cs-hero-title">Draftastic Fantasy Pro Wrestling</h1>
          <p className="cs-hero-tagline">Putting the sport back in sports entertainment.</p>
          <p className="cs-hero-sub">
            Draft your roster. Track every match. Compete with friends and turn every episode of wrestling into a fantasy battle.
          </p>
          <div className="cs-hero-ctas">
            <EmailSignupForm />
            <Link href="#how-it-works" className="cs-btn cs-btn-secondary">
              See How It Works
            </Link>
          </div>
        </div>
      </section>

      {/* 2. The Hook Section */}
      <section className="cs-section">
        <div className="cs-section-inner">
          <h2 className="cs-section-title">Why Isn&apos;t Fantasy Pro Wrestling a Huge Thing?</h2>
          <p>
            Millions of fans tune in every week to watch professional wrestling. The drama. The rivalries. The moments that make you jump off the couch.
          </p>
          <p>So we had a question.</p>
          <p><strong>Why isn&apos;t Fantasy Pro Wrestling bigger?</strong></p>
          <p>
            Fantasy football makes every Sunday game matter. Fantasy baseball turns stats into strategy.
          </p>
          <p>With millions watching wrestling every week… shouldn&apos;t fantasy wrestling exist too?</p>
        </div>
      </section>

      {/* 3. Our Story */}
      <section className="cs-section">
        <div className="cs-section-inner">
          <h2 className="cs-section-title">How Draftastic Was Born</h2>
          <p>
            Three longtime wrestling fans attended their first WWE event in over twenty years… and suddenly we were hooked all over again.
          </p>
          <p>The energy. The crowd. The storylines unfolding in the ring.</p>
          <p>But when we went looking for a fantasy league to make watching wrestling even more fun…</p>
          <p>We discovered something surprising.</p>
          <p>There weren&apos;t many good options.</p>
          <p>So we did what wrestling fans do best.</p>
          <p><strong>We built our own.</strong></p>
          <p>
            Draftastic started as a spreadsheet, a scoring system, and a group of friends who suddenly cared a lot about what happened on RAW, SmackDown, and every Premium Live Event. The more we refined the league, the more invested we became. Soon we weren&apos;t just watching wrestling again.
          </p>
          <p>We were studying it. Debating it. Drafting it. Trash-talking about it.</p>
          <p>Now we&apos;re bringing that experience to fans everywhere.</p>
          <p>
            Draft your roster.<br />
            Track every match.<br />
            Compete with your friends.
          </p>
          <p>Because wrestling isn&apos;t just entertainment.</p>
          <p><strong>It&apos;s competition.</strong></p>
          <p>And now you&apos;re part of the game.</p>
        </div>
      </section>

      {/* 4. What Draftastic Lets You Do */}
      <section className="cs-section">
        <div className="cs-section-inner">
          <h2 className="cs-section-title">Turn Wrestling Into a Competition</h2>
          <p className="cs-bullet-intro">With Draftastic you can:</p>
          <ul className="cs-bullets">
            <li>Draft your own roster of superstars</li>
            <li>Earn points based on match results and performance</li>
            <li>Compete against friends in custom leagues</li>
            <li>Track scores across RAW, SmackDown, and every PLE</li>
            <li>Prove once and for all who the best wrestling mind is</li>
          </ul>
        </div>
      </section>

      {/* 5. How It Works — Step 1 includes Roster screenshot */}
      <section id="how-it-works" className="cs-section">
        <div className="cs-section-inner">
          <h2 className="cs-section-title">How It Works</h2>
          <div className="cs-step-block">
            <h3 className="cs-step-heading">Step 1 — Draft Your Roster</h3>
            <p>
              Build your dream roster from the current wrestling landscape. Every superstar you draft becomes part of your fantasy stable, earning points based on their performances each week.
            </p>
            <figure className="cs-inline-screenshot">
              <div className="cs-screenshot-img-wrap">
                <Image
                  src={`${IMG}/draftastic-roster.png`}
                  alt="Draftastic roster page"
                  fill
                  className="cs-screenshot-img"
                  sizes="(max-width: 640px) 100vw, 600px"
                />
              </div>
              <figcaption className="cs-screenshot-caption">Manage your roster and build the ultimate lineup.</figcaption>
            </figure>
          </div>
          <ol className="cs-steps">
            <li>
              <strong>2 — Watch the Action</strong><br />
              Every match, victory, and performance earns fantasy points.
            </li>
            <li>
              <strong>3 — Compete for the Championship</strong><br />
              Climb the leaderboard and claim bragging rights.
            </li>
          </ol>
        </div>
      </section>

      {/* 6. Compete for the Championship — Standings screenshot */}
      <section className="cs-section">
        <div className="cs-section-inner">
          <h2 className="cs-section-title">Compete for the Championship</h2>
          <p>
            Every match matters. Wins, title changes, and standout performances all impact the leaderboard. Track your progress and see who&apos;s dominating the league.
          </p>
          <figure className="cs-inline-screenshot">
            <div className="cs-screenshot-img-wrap">
              <Image
                src={`${IMG}/draftastic-standings.png`}
                alt="Draftastic league standings"
                fill
                className="cs-screenshot-img"
                sizes="(max-width: 640px) 100vw, 600px"
              />
            </div>
            <figcaption className="cs-screenshot-caption">Climb the standings and prove you&apos;re the best booker in the league.</figcaption>
          </figure>
        </div>
      </section>

      {/* 7. Wrestling, But With Stats — League Leaders screenshot */}
      <section className="cs-section">
        <div className="cs-section-inner">
          <h2 className="cs-section-title">Wrestling, But With Stats</h2>
          <p>
            Track the hottest performers across the wrestling landscape. League leaderboards highlight the superstars delivering the most fantasy points, giving you the data you need to make smarter roster moves.
          </p>
          <figure className="cs-inline-screenshot">
            <div className="cs-screenshot-img-wrap">
              <Image
                src={`${IMG}/draftastic-leaderboard.png`}
                alt="Draftastic league leaders table"
                fill
                className="cs-screenshot-img"
                sizes="(max-width: 640px) 100vw, 600px"
              />
            </div>
            <figcaption className="cs-screenshot-caption">Track the top fantasy performers across the entire league.</figcaption>
          </figure>
        </div>
      </section>

      {/* 8. Dive Into Superstar Performance — Profile screenshot */}
      <section className="cs-section">
        <div className="cs-section-inner">
          <h2 className="cs-section-title">Dive Into Superstar Performance</h2>
          <p>
            Each wrestler has a detailed profile showing their fantasy production, stats, and performance trends. Study the numbers and build a roster that dominates.
          </p>
          <figure className="cs-inline-screenshot">
            <div className="cs-screenshot-img-wrap">
              <Image
                src={`${IMG}/draftastic-profile.png`}
                alt="Draftastic wrestler profile"
                fill
                className="cs-screenshot-img"
                sizes="(max-width: 640px) 100vw, 600px"
              />
            </div>
            <figcaption className="cs-screenshot-caption">Detailed profiles help you scout your next fantasy superstar.</figcaption>
          </figure>
        </div>
      </section>

      {/* 9. Final CTA */}
      <section className="cs-section cs-final-cta">
        <div className="cs-section-inner">
          <h2 className="cs-section-title">Wrestling Was Never Meant to Be Passive.</h2>
          <p>
            It&apos;s drama. It&apos;s strategy. It&apos;s competition.
          </p>
          <p>
            Draftastic turns every episode of wrestling into a game where every match matters.
          </p>
          <div className="cs-final-cta-btn">
            <EmailSignupForm />
          </div>
        </div>
      </section>
    </>
  );
}
