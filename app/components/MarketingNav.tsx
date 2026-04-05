"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { siteLogoHref } from "@/lib/siteLogo";

export default function MarketingNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <>
      <header className="nav-header">
        <Link href="/" className="nav-header-brand-wrap">
          <img src={siteLogoHref()} alt="" className="nav-header-logo" />
          <span className="nav-header-brand nav-header-brand-full">Draftastic Pro Wrestling</span>
          <span className="nav-header-brand nav-header-brand-short" aria-hidden>
            Draftastic
          </span>
        </Link>

        <nav className="nav-top-links nav-top-links-desk" aria-label="Site">
          <Link href="/news" className="nav-top-link">
            News
          </Link>
          <Link href="/event-results" className="nav-top-link">
            Results
          </Link>
          <Link href="/wrestlers" className="nav-top-link">
            Wrestlers
          </Link>
          <Link href="/about-us" className="nav-top-link">
            About Us
          </Link>
        </nav>

        <button
          type="button"
          className="nav-mobile-menu-btn"
          onClick={() => setMobileMenuOpen((o) => !o)}
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          <svg
            className="nav-mobile-menu-icon"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </header>

      {mobileMenuOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            id="nav-mobile-panel"
            className="nav-mobile-panel"
            role="dialog"
            aria-label="Site menu"
          >
            <nav className="nav-mobile-panel-inner" aria-label="Site">
              <Link href="/" className="nav-mobile-panel-link" onClick={closeMobileMenu}>
                Home
              </Link>
              <Link href="/news" className="nav-mobile-panel-link" onClick={closeMobileMenu}>
                News
              </Link>
              <Link href="/event-results" className="nav-mobile-panel-link" onClick={closeMobileMenu}>
                Results
              </Link>
              <Link href="/wrestlers" className="nav-mobile-panel-link" onClick={closeMobileMenu}>
                Wrestlers
              </Link>
              <Link href="/about-us" className="nav-mobile-panel-link" onClick={closeMobileMenu}>
                About Us
              </Link>
            </nav>
          </div>,
          document.body
        )}
    </>
  );
}
