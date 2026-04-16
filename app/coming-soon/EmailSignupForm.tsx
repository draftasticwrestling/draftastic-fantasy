"use client";

import { CONSTANT_CONTACT_SIGNUP_URL } from "@/lib/constantContact";

export function EmailSignupForm() {
  return (
    <div className="coming-soon-signup">
      <a
        href={CONSTANT_CONTACT_SIGNUP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="coming-soon-form-btn coming-soon-form-btn-link"
      >
        Join the list — get notified at launch
      </a>
      <p className="coming-soon-signup-note">Opens our signup form in a new tab.</p>
    </div>
  );
}
