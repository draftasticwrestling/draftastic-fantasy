import Link from "next/link";

export const metadata = {
  title: "Privacy — Draftastic Fantasy",
  description: "Draftastic Fantasy privacy policy",
};

const LAST_UPDATED = "April 8, 2026";
const PRIVACY_EMAIL = "draftasticwrestling@gmail.com";

export default function PrivacyPage() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 760, margin: "0 auto", lineHeight: 1.6 }}>
      <p style={{ marginBottom: 24 }}>
        <Link href="/" style={{ color: "#1a73e8", textDecoration: "none" }}>
          ← Home
        </Link>
      </p>
      <h1 style={{ marginBottom: 12 }}>Privacy Policy</h1>
      <p style={{ color: "#666", marginTop: 0 }}>
        Last updated: {LAST_UPDATED}
      </p>
      <p style={{ color: "#444" }}>
        This Privacy Policy explains how Draftastic Fantasy ("Draftastic", "we", "us") collects, uses, and shares personal data when you
        use the Service.
      </p>

      <h2>1) Data We Collect</h2>
      <ul style={{ color: "#444" }}>
        <li>Account data: email, authentication provider identifiers, account timestamps.</li>
        <li>Profile data: display name, timezone, notification preferences, profile metadata.</li>
        <li>League data: league membership, team names, catchphrases, roster and transaction activity.</li>
        <li>Technical data: device/browser info, logs, and basic usage diagnostics for reliability and security.</li>
        <li>Policy consent data: timestamps for Terms/Privacy acceptance.</li>
      </ul>

      <h2>2) How We Use Data</h2>
      <ul style={{ color: "#444" }}>
        <li>To create and secure accounts, authenticate users, and prevent abuse.</li>
        <li>To run league features and display user-generated league/profile content.</li>
        <li>To provide optional account-related communications and notifications.</li>
        <li>To send marketing/product updates only when you explicitly opt in.</li>
        <li>To maintain, debug, and improve product performance and reliability.</li>
        <li>To comply with legal obligations and enforce our Terms.</li>
      </ul>

      <h2>3) Legal Bases (where applicable)</h2>
      <p style={{ color: "#444" }}>
        Depending on your location, we process data based on performance of a contract (providing the Service), legitimate interests
        (security and improvement), consent (optional communications), and legal obligations.
      </p>

      <h2>4) Sharing and Disclosure</h2>
      <p style={{ color: "#444" }}>We do not sell personal data. We may share data with service providers that help operate the Service, including:</p>
      <ul style={{ color: "#444" }}>
        <li>Authentication and database infrastructure (e.g., Supabase).</li>
        <li>Hosting, monitoring, and operational tooling providers.</li>
        <li>Email/notification providers if or when messaging features are enabled (for example, Constant Contact).</li>
      </ul>
      <p style={{ color: "#444" }}>
        We may also disclose data when required by law or to protect rights, safety, and platform integrity.
      </p>

      <h2>5) Marketing Communications</h2>
      <p style={{ color: "#444" }}>
        Marketing emails are optional and sent only if you explicitly opt in. You can unsubscribe any time from the email footer or by
        updating account preferences.
      </p>

      <h2>6) Cookies and Similar Technologies</h2>
      <p style={{ color: "#444" }}>
        We use essential cookies/session mechanisms required for authentication and secure operation. If we add analytics or marketing
        cookies later, this policy and consent flows will be updated accordingly.
      </p>

      <h2>7) Data Retention</h2>
      <p style={{ color: "#444" }}>
        We retain personal data for as long as needed to provide the Service, comply with legal obligations, resolve disputes, and enforce
        Terms. Retention periods may vary by data type and legal requirements.
      </p>

      <h2>8) Your Rights</h2>
      <p style={{ color: "#444" }}>
        Depending on your jurisdiction, you may have rights to access, correct, delete, or export your data, and to object to certain
        processing. To request these actions, contact <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>.
      </p>

      <h2>9) Children&apos;s Privacy</h2>
      <p style={{ color: "#444" }}>
        The Service is not intended for children under 13. If we learn that we collected personal data from a child under 13 without
        appropriate consent, we will take steps to delete it.
      </p>

      <h2>10) International Transfers</h2>
      <p style={{ color: "#444" }}>
        Your information may be processed in countries other than your own. We take reasonable steps to ensure appropriate safeguards are
        in place.
      </p>

      <h2>11) Security</h2>
      <p style={{ color: "#444" }}>
        We implement reasonable technical and organizational safeguards to protect personal data. No method of transmission or storage is
        100% secure.
      </p>

      <h2>12) Changes to this Policy</h2>
      <p style={{ color: "#444" }}>
        We may update this Privacy Policy from time to time. Material changes will be posted in the Service with an updated effective date.
      </p>

      <h2>13) Contact</h2>
      <p style={{ color: "#444" }}>
        For privacy questions or data requests, contact: <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>
      </p>
    </main>
  );
}
