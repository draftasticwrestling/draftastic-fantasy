"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { HubStepIconDraft, HubStepIconSignup, HubStepIconTrophy } from "@/app/components/HubStepIcons";
import { PLAY_PATH } from "@/lib/playFunnel";

const AUTO_MS = 6500;

const steps = [
  { label: "Sign up", icon: HubStepIconSignup, text: "SIGN-UP" },
  { label: "Draft your team", icon: HubStepIconDraft, text: "DRAFT TEAM" },
  { label: "Start playing", icon: HubStepIconTrophy, text: "START PLAYING" },
] as const;

type PromoSlide = {
  id: string;
  ariaLabel: string;
};

const SLIDES: PromoSlide[] = [
  { id: "public", ariaLabel: "Public leagues" },
  { id: "war-games", ariaLabel: "Road to War Games private leagues" },
  { id: "head-to-head", ariaLabel: "Head-to-Head leagues" },
];

function PublicLeagueSlide() {
  return (
    <div className="hub-steps-slide-inner">
      <div className="hub-steps-grid">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={step.label} className="hub-step hub-step--static" aria-label={step.label}>
              {index > 0 ? <span className="hub-step-divider" aria-hidden /> : null}
              <Icon />
              <div className="hub-step-label">
                <span className="hub-step-label-main">{step.text}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="hub-steps-cta-strip">
        <p className="hub-steps-cta-text">New public leagues start every Monday</p>
      </div>
    </div>
  );
}

function WarGamesSlide() {
  return (
    <div className="hub-steps-slide-inner hub-steps-slide-inner--promo hub-steps-slide-inner--war-games">
      <p className="hub-steps-promo-kicker">Private leagues</p>
      <p className="hub-steps-promo-title">Road to War Games</p>
      <p className="hub-steps-promo-body">
        Create a league for friends — Total Season Points or Head-to-Head. NXT included. No access code.
      </p>
      <div className="hub-steps-cta-strip hub-steps-cta-strip--war-games">
        <p className="hub-steps-cta-text">Aug 3 – Survivor Series: War Games</p>
      </div>
      <div className="hub-steps-promo-links">
        <Link href="/leagues/new" className="hub-steps-promo-link">
          Create a League
        </Link>
        <Link href="/how-it-works?tab=road-to-war-games" className="hub-steps-promo-link hub-steps-promo-link--muted">
          How it Works
        </Link>
      </div>
    </div>
  );
}

function HeadToHeadSlide() {
  return (
    <div className="hub-steps-slide-inner hub-steps-slide-inner--promo hub-steps-slide-inner--war-games">
      <p className="hub-steps-promo-kicker">New this season</p>
      <p className="hub-steps-promo-title">Head-to-Head Matchups</p>
      <p className="hub-steps-promo-body">
        Weekly opponents, win–loss records, and a playoff bracket that crowns a champion at War Games.
      </p>
      <div className="hub-steps-cta-strip hub-steps-cta-strip--war-games">
        <p className="hub-steps-cta-text">4–8 factions · playoffs included</p>
      </div>
      <div className="hub-steps-promo-links">
        <Link href={PLAY_PATH} className="hub-steps-promo-link">
          Play Now
        </Link>
        <Link href="/leagues/new" className="hub-steps-promo-link hub-steps-promo-link--muted">
          Create H2H League
        </Link>
      </div>
    </div>
  );
}

function slideContent(id: string) {
  switch (id) {
    case "war-games":
      return <WarGamesSlide />;
    case "head-to-head":
      return <HeadToHeadSlide />;
    default:
      return <PublicLeagueSlide />;
  }
}

export default function HubStepsBanner() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useRef(false);
  const count = SLIDES.length;

  useEffect(() => {
    reduceMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const go = useCallback(
    (next: number) => {
      setIndex(((next % count) + count) % count);
    },
    [count]
  );

  useEffect(() => {
    if (paused || reduceMotion.current) return;
    const id = window.setInterval(() => go(index + 1), AUTO_MS);
    return () => window.clearInterval(id);
  }, [index, paused, go]);

  return (
    <div
      className="hub-steps-banner hub-steps-carousel"
      aria-roledescription="carousel"
      aria-label="League promotions"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      <div className="hub-steps-carousel-frame">
        <button
          type="button"
          className="hub-steps-carousel-arrow hub-steps-carousel-arrow--prev"
          aria-label="Previous banner"
          onClick={() => go(index - 1)}
        >
          <span aria-hidden>‹</span>
        </button>

        <div className="hub-steps-carousel-viewport">
          <div
            className="hub-steps-carousel-track"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {SLIDES.map((slide, i) => (
              <div
                key={slide.id}
                className={`hub-steps-carousel-slide${i === index ? " is-active" : ""}`}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${count}: ${slide.ariaLabel}`}
                aria-hidden={i !== index}
              >
                {slideContent(slide.id)}
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="hub-steps-carousel-arrow hub-steps-carousel-arrow--next"
          aria-label="Next banner"
          onClick={() => go(index + 1)}
        >
          <span aria-hidden>›</span>
        </button>
      </div>

      <div className="hub-steps-carousel-dots" role="tablist" aria-label="Banner slides">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Show ${slide.ariaLabel}`}
            className={`hub-steps-carousel-dot${i === index ? " is-active" : ""}`}
            onClick={() => go(i)}
          />
        ))}
      </div>
    </div>
  );
}
