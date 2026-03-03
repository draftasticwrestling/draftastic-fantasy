import { EmailSignupForm } from "./EmailSignupForm";

export default function ComingSoonPage() {
  return (
    <div className="coming-soon-content">
      <h1 className="coming-soon-title">
        The #1 fantasy pro wrestling game is on the way.
      </h1>
      <p className="coming-soon-tagline">
        Draft your roster. Compete on Raw, SmackDown &amp; PLEs. 100% free.
      </p>
      <p className="coming-soon-sub">
        Join the list and we&apos;ll notify you as we get ready to launch.
      </p>
      <EmailSignupForm />
    </div>
  );
}
