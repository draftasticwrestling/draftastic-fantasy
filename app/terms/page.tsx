import Link from "next/link";

export const metadata = {
  title: "Terms — Draftastic Fantasy",
  description: "Draftastic Fantasy terms of service",
};

const LAST_UPDATED = "April 8, 2026";
const CONTACT_EMAIL = "draftasticwrestling@gmail.com";

export default function TermsPage() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 760, margin: "0 auto", lineHeight: 1.6 }}>
      <p style={{ marginBottom: 24 }}>
        <Link href="/" style={{ color: "#1a73e8", textDecoration: "none" }}>
          ← Home
        </Link>
      </p>
      <h1 style={{ marginBottom: 12 }}>Terms of Service</h1>
      <p style={{ color: "#666", marginTop: 0 }}>
        Last updated: {LAST_UPDATED}
      </p>
      <p style={{ color: "#444" }}>
        These Terms of Service ("Terms") govern your access to and use of Draftastic Fantasy (the "Service"). By creating an account or
        using the Service, you agree to these Terms.
      </p>

      <h2>1) Eligibility and Account</h2>
      <p style={{ color: "#444" }}>
        You must be at least 13 years old to use the Service. You are responsible for safeguarding your account credentials and for all
        activity under your account. You agree to provide accurate account/profile information and keep it updated.
      </p>

      <h2>2) Free Service / No Wagering</h2>
      <p style={{ color: "#444" }}>
        Draftastic Fantasy leagues are currently free to join and use. The Service does not process entry fees, prize pools, or wagering.
        Users may not use the Service to facilitate unlawful gambling activity.
      </p>

      <h2>3) Community Standards and Code of Conduct</h2>
      <p style={{ color: "#444" }}>You may not post or use content that is:</p>
      <ul style={{ color: "#444" }}>
        <li>Harassing, threatening, hateful, discriminatory, or sexually explicit.</li>
        <li>Defamatory, fraudulent, misleading, or otherwise unlawful.</li>
        <li>Infringing of another party&apos;s intellectual property rights.</li>
        <li>Designed to disrupt the Service (spam, scraping, automation abuse, or attacks).</li>
      </ul>
      <p style={{ color: "#444" }}>
        This policy applies to profile/display names, catchphrases, team names, league content, and any other user-provided text.
        Draftastic may remove content, rename profiles/teams, suspend features, or terminate accounts at its discretion to protect users
        and the platform.
      </p>

      <h2>4) User Content and License</h2>
      <p style={{ color: "#444" }}>
        You retain ownership of content you submit, but you grant Draftastic a non-exclusive, worldwide, royalty-free license to host,
        store, reproduce, and display that content as needed to operate, maintain, and improve the Service.
      </p>

      <h2>5) Intellectual Property / DMCA Policy</h2>
      <p style={{ color: "#444" }}>
        Draftastic respects intellectual property rights and responds to valid takedown notices. If you believe content on the Service
        infringes your copyright, send a notice to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with:
      </p>
      <ul style={{ color: "#444" }}>
        <li>Your name and contact information.</li>
        <li>Identification of the copyrighted work you claim is infringed.</li>
        <li>Identification of the allegedly infringing material (URL and enough detail to locate it).</li>
        <li>A statement of good-faith belief that use is not authorized.</li>
        <li>A statement, under penalty of perjury, that your notice is accurate and you are authorized to act.</li>
        <li>Your physical or electronic signature.</li>
      </ul>
      <p style={{ color: "#444" }}>
        Draftastic may remove or disable access to allegedly infringing material while reviewing notices and may terminate repeat
        infringers when appropriate.
      </p>

      <h2>6) Third-Party IP and Branding Disclaimer</h2>
      <p style={{ color: "#444" }}>
        Draftastic is an independent fan-oriented fantasy product and is not affiliated with, endorsed by, or sponsored by WWE or any
        other promotion unless explicitly stated. All third-party names, marks, and logos remain the property of their respective owners.
      </p>

      <h2>7) Suspension and Termination</h2>
      <p style={{ color: "#444" }}>
        We may suspend or terminate your access for violations of these Terms, legal compliance requirements, or conduct that creates risk
        to users or the Service.
      </p>

      <h2>8) Service Changes and Availability</h2>
      <p style={{ color: "#444" }}>
        We may modify, pause, or discontinue features at any time. The Service is provided on an &quot;as is&quot; and &quot;as available&quot; basis without
        warranties of uninterrupted availability.
      </p>

      <h2>9) Limitation of Liability</h2>
      <p style={{ color: "#444" }}>
        To the maximum extent allowed by law, Draftastic is not liable for indirect, incidental, special, consequential, or punitive
        damages, or any loss of data, revenue, or goodwill arising from use of the Service.
      </p>

      <h2>10) Governing Law</h2>
      <p style={{ color: "#444" }}>
        These Terms are governed by applicable laws of the jurisdiction where the operator is established, unless otherwise required by
        consumer protection law.
      </p>

      <h2>11) Changes to Terms</h2>
      <p style={{ color: "#444" }}>
        We may update these Terms from time to time. Material changes will be posted in the Service with an updated effective date.
      </p>

      <h2>12) Contact</h2>
      <p style={{ color: "#444" }}>
        For legal notices, takedown requests, or Terms questions, contact: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </main>
  );
}
