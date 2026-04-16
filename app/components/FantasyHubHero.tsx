"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useState } from "react";
import HeroSignupCountdown from "@/app/components/HeroSignupCountdown";
import { CONSTANT_CONTACT_SIGNUP_URL } from "@/lib/constantContact";
import { DRAFTASTIC_SCREENSHOTS } from "@/lib/draftasticScreenshots";
import { siteLogoHref } from "@/lib/siteLogo";

function HubExpandScreenshot({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <figure className="hub-hero-expand-shot">
      <div className="hub-hero-expand-shot-wrap">
        <Image
          src={src}
          alt={alt}
          fill
          className="hub-hero-expand-shot-img"
          sizes="(max-width: 640px) 100vw, 560px"
        />
      </div>
      <figcaption className="hub-hero-expand-shot-caption">{caption}</figcaption>
    </figure>
  );
}

export default function FantasyHubHero() {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <section className="hub-hero">
      <div className="hub-hero-inner">
        <div className="hub-hero-copy">
          <p className="hub-hero-kicker">Draftastic Fantasy Pro Wrestling</p>
          <img src={siteLogoHref()} alt="" className="hub-hero-logo hub-hero-logo-inline" />
          <h1 className="hub-hero-headline">Draft. Book. Win.</h1>
          <p className="hub-hero-tagline hub-hero-tagline-lead">
            Turn watching WWE into a competition. Build your roster. Score points from real shows. Prove you know wrestling
            better than your friends.
          </p>
          <div className="hub-hero-urgency">
            <p>Sign up by the end of WrestleMania to get your exclusive ACCESS CODE.</p>
            <p>Don&apos;t miss out. Limited spots available for the Road to SummerSlam.</p>
          </div>
          <HeroSignupCountdown />
          <div className="hub-hero-actions">
            <a
              href={CONSTANT_CONTACT_SIGNUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hub-hero-btn hub-hero-btn-primary"
            >
              Join the Beta
            </a>
            <Link href="/how-it-works" className="hub-hero-btn hub-hero-btn-outline">
              How It Works
            </Link>
          </div>
          <button
            type="button"
            className="hub-hero-learn-toggle"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Show less" : "Learn more"}
          </button>
        </div>
      </div>

      <div id={panelId} className="hub-hero-expand-wrap" hidden={!open}>
        <div className="hub-hero-expand">
          <section className="hub-hero-expand-section" aria-labelledby="hub-expand-s2">
            <h2 id="hub-expand-s2">Fantasy Wrestling. But Actually Good.</h2>
            <p>You already predict who&apos;s getting pushed.</p>
            <p>You already argue about booking.</p>
            <p>You already know who should be champion.</p>
            <p>
              <strong>Now it counts.</strong>
            </p>
            <p>Draft real wrestlers.</p>
            <p>Earn points based on what happens on RAW, SmackDown, and PLEs.</p>
            <p>Compete against your league every week.</p>
            <p>Win your league. Talk your trash. Repeat.</p>
          </section>

          <section className="hub-hero-expand-section" aria-labelledby="hub-expand-s3">
            <h2 id="hub-expand-s3">How it works</h2>
            <ol className="hub-hero-expand-steps">
              <li>
                <strong>Draft Your Roster</strong>
                <span>Build a roster that balances stars, sleepers, and chaos agents.</span>
              </li>
              <li>
                <strong>Score Points from Real Shows</strong>
                <span>Matches, wins, appearances, titles… if it happens on TV, it matters.</span>
              </li>
              <li>
                <strong>Make Moves</strong>
                <span>Trades. Waiver pickups. Last-minute genius (or panic) signings.</span>
              </li>
              <li>
                <strong>Win Your League</strong>
                <span>Weekly events. PLE boosts. Opportunities for big point swings. Your path to glory.</span>
              </li>
            </ol>
            <HubExpandScreenshot
              src={DRAFTASTIC_SCREENSHOTS.roster}
              alt="Draftastic roster page"
              caption="Manage your roster and build the ultimate lineup."
            />
          </section>

          <section className="hub-hero-expand-section" aria-labelledby="hub-expand-s4">
            <h2 id="hub-expand-s4">Booking is unpredictable. That&apos;s the point.</h2>
            <p>Your mid-card pick just main-evented RAW.</p>
            <p>Your &quot;can&apos;t miss&quot; superstar disappeared for two weeks.</p>
            <p>A random tag team just saved your matchup.</p>
            <p>Fantasy football rewards logic.</p>
            <p>Fantasy wrestling rewards instinct… and a little madness.</p>
            <HubExpandScreenshot
              src={DRAFTASTIC_SCREENSHOTS.standings}
              alt="Draftastic league standings"
              caption="Climb the standings and prove you're the best booker in the league."
            />
          </section>

          <section className="hub-hero-expand-section" aria-labelledby="hub-expand-s5">
            <h2 id="hub-expand-s5">Watching hits different when it matters</h2>
            <ul className="hub-hero-expand-bullets">
              <li>Every match has stakes</li>
              <li>Every promo could swing your week</li>
              <li>Every show becomes must-watch</li>
            </ul>
            <p className="hub-hero-expand-closer">You&apos;re not just watching anymore. You&apos;re scouting.</p>
            <HubExpandScreenshot
              src={DRAFTASTIC_SCREENSHOTS.leaderboard}
              alt="Draftastic league leaders table"
              caption="Track the top fantasy performers across the entire league."
            />
          </section>

          <section className="hub-hero-expand-section" aria-labelledby="hub-expand-s6">
            <h2 id="hub-expand-s6">What a Week Looks Like</h2>
            <ul className="hub-hero-expand-example">
              <li>
                <strong>Monday (RAW):</strong> Your wrestler wins → Your point total goes up!
              </li>
              <li>
                <strong>Friday (SmackDown):</strong> Your opponent&apos;s star returns → uh oh!
              </li>
              <li>
                <strong>Saturday (PLE):</strong> Surprise title change shakes up the standings!
              </li>
            </ul>
            <p>
              By Sunday, you&apos;ve either built a comfortable lead… or you&apos;re already planning your comeback.
            </p>
            <HubExpandScreenshot
              src={DRAFTASTIC_SCREENSHOTS.profile}
              alt="Draftastic wrestler profile"
              caption="Detailed profiles help you scout your next fantasy superstar."
            />
          </section>

          <section className="hub-hero-expand-section" aria-labelledby="hub-expand-s7">
            <h2 id="hub-expand-s7">Already following the results?</h2>
            <p>We break down every show, every week. Here&apos;s the difference:</p>
            <p>
              <strong>We tell you what it means for your fantasy team.</strong>
            </p>
            <p className="hub-hero-expand-cta-row">
              <Link href="/event-results" className="hub-hero-expand-link">
                Read the Latest
              </Link>
              <span className="hub-hero-expand-cta-sep" aria-hidden>
                +
              </span>
              <Link href="/leagues/new" className="hub-hero-expand-link">
                Start a League
              </Link>
            </p>
          </section>

          <section className="hub-hero-expand-section hub-hero-expand-final" aria-labelledby="hub-expand-final">
            <h2 id="hub-expand-final">Don&apos;t join late. You&apos;ll regret it.</h2>
            <p>Leagues are forming. Drafts are coming. And once the season starts, you&apos;re chasing everyone else.</p>
            <p>Get in now. Build your roster. Be the one everyone&apos;s trying to beat.</p>
            <p className="hub-hero-expand-cta-block">
              <a
                href={CONSTANT_CONTACT_SIGNUP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hub-hero-btn hub-hero-btn-primary"
              >
                Claim Your Spot
              </a>
            </p>
          </section>

          <p className="hub-hero-expand-tagline">Draft smart. Watch closer. Win louder.</p>
        </div>
      </div>
    </section>
  );
}
