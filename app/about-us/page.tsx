import Link from "next/link";
import { MarketingLandingCopy } from "@/app/components/MarketingLandingCopy";
import "@/app/coming-soon/layout.css";
import "./about-us.css";

const CONTACT_EMAIL = "draftasticwrestling@gmail.com";

export const metadata = {
  title: "About Us — Draftastic Pro Wrestling",
  description:
    "Why we built Draftastic Fantasy Pro Wrestling, how it works, and how to reach us with questions or corrections.",
};

export default function AboutUsPage() {
  return (
    <div className="about-us-marketing">
      <p className="about-us-back">
        <Link href="/">← Home</Link>
      </p>
      <MarketingLandingCopy
        showHero={false}
        sidebar={
          <aside
            className="cs-hub-rail cs-hub-rail-sticky about-us-sidebar-contact"
            aria-label="Contact"
          >
            <h2>Contact us</h2>
            <p>
              We read every message. Reach out if you have <strong>questions</strong> about the site or how scoring
              works, <strong>suggestions</strong> for how we can make Draftastic better, or <strong>corrections</strong>{" "}
              to stats, results, or title history so we can keep the record as accurate as possible.
            </p>
            <p>
              <a href={`mailto:${CONTACT_EMAIL}`} className="app-link">
                {CONTACT_EMAIL}
              </a>
            </p>
          </aside>
        }
      />
    </div>
  );
}
