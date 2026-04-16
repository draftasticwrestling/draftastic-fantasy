"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { siteLogoHref } from "@/lib/siteLogo";

const CONSTANT_CONTACT_SIGNUP_URL = "https://lp.constantcontactpages.com/sl/Qe4DAFj";
const PROMPT_DISMISS_KEY = "draftastic_email_prompt_dismissed_until";
const PROMPT_SUBMITTED_KEY = "draftastic_email_prompt_submitted";
const PROMPT_SHOWN_KEY = "draftastic_email_prompt_shown";
const DISMISS_DAYS = 10;
const SHOW_DELAY_MS = 10000;
const SCROLL_THRESHOLD = 0.5;

function shouldSuppressOnPath(pathname: string): boolean {
  return (
    pathname.startsWith("/internal-admin") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/coming-soon")
  );
}

function trackSignupPrompt(eventName: "email_prompt_shown" | "email_prompt_dismissed" | "email_prompt_cta_clicked") {
  if (typeof window === "undefined") return;
  const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag === "function") {
    gtag("event", eventName, {
      event_category: "email_capture",
      event_label: "first_visit_modal",
    });
  }
}

export default function EmailSignupPrompt() {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);

  const suppressed = useMemo(() => shouldSuppressOnPath(pathname), [pathname]);

  useEffect(() => {
    if (suppressed || typeof window === "undefined") return;

    const submitted = window.localStorage.getItem(PROMPT_SUBMITTED_KEY) === "1";
    if (submitted) return;

    const dismissedUntil = Number(window.localStorage.getItem(PROMPT_DISMISS_KEY) ?? "0");
    if (Number.isFinite(dismissedUntil) && dismissedUntil > Date.now()) return;

    const shownAlready = window.localStorage.getItem(PROMPT_SHOWN_KEY) === "1";
    if (shownAlready) return;

    let shown = false;
    let timer: number | null = window.setTimeout(() => {
      if (!shown) {
        shown = true;
        setOpen(true);
      }
    }, SHOW_DELAY_MS);

    const onScroll = () => {
      if (shown) return;
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;
      const ratio = scrollTop / docHeight;
      if (ratio >= SCROLL_THRESHOLD) {
        shown = true;
        if (timer != null) {
          window.clearTimeout(timer);
          timer = null;
        }
        setOpen(true);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (timer != null) window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [suppressed]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    window.localStorage.setItem(PROMPT_SHOWN_KEY, "1");
    trackSignupPrompt("email_prompt_shown");
  }, [open]);

  if (!open || suppressed) return null;

  const dismiss = () => {
    if (typeof window !== "undefined") {
      const next = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
      window.localStorage.setItem(PROMPT_DISMISS_KEY, String(next));
    }
    trackSignupPrompt("email_prompt_dismissed");
    setOpen(false);
  };

  const onCtaClick = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PROMPT_SUBMITTED_KEY, "1");
    }
    trackSignupPrompt("email_prompt_cta_clicked");
    setOpen(false);
  };

  return (
    <div className="email-prompt-overlay" role="dialog" aria-modal="true" aria-labelledby="email-prompt-title">
      <button className="email-prompt-backdrop" aria-label="Close signup prompt" onClick={dismiss} />
      <section className="email-prompt-modal">
        <button type="button" className="email-prompt-close" aria-label="Close signup prompt" onClick={dismiss}>
          ×
        </button>
        <div className="email-prompt-brand">
          <img src={siteLogoHref()} alt="" className="email-prompt-logo" />
          <p className="email-prompt-kicker">Draftastic Fantasy Pro Wrestling</p>
        </div>
        <h2 id="email-prompt-title">Get your beta ACCESS CODE before WrestleMania ends</h2>
        <p>
          Email signup closes Sunday, Apr 19 at approximately 7:00 PM PT. You must be on the list to receive this weekend&apos;s
          ACCESS CODE, which is required to create a league for the Road to SummerSlam beta tests.
        </p>
        <a
          href={CONSTANT_CONTACT_SIGNUP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="email-prompt-cta"
          onClick={onCtaClick}
        >
          Join the list and get my code
        </a>
        <button type="button" className="email-prompt-secondary" onClick={dismiss}>
          Maybe later
        </button>
      </section>
    </div>
  );
}
