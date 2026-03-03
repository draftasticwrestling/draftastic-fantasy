"use client";

const CONSTANT_CONTACT_SIGNUP_URL = "https://lp.constantcontactpages.com/sl/Qe4DAFj";

export function EmailSignupForm() {
  return (
    <div className="coming-soon-embed-wrap">
      <iframe
        src={CONSTANT_CONTACT_SIGNUP_URL}
        title="Email signup — Constant Contact"
        className="coming-soon-embed-iframe"
      />
    </div>
  );
}
