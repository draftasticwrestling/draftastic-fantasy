"use client";

const CONSTANT_CONTACT_SIGNUP_URL = "https://lp.constantcontactpages.com/sl/Qe4DAFj";

export function EmailSignupForm() {
  return (
    <a
      href={CONSTANT_CONTACT_SIGNUP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="coming-soon-form-btn coming-soon-form-btn-link"
    >
      Get notified when we launch
    </a>
  );
}
