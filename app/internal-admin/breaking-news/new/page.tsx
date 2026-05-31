import Link from "next/link";
import { BreakingNewsForm } from "../BreakingNewsForm";
import styles from "../../internal-admin.module.css";

export const metadata = {
  title: "New breaking news — Site admin",
};

export default function NewBreakingNewsPage() {
  return (
    <div style={{ maxWidth: 720 }}>
      <p style={{ marginBottom: 16 }}>
        <Link href="/internal-admin/breaking-news" className="app-link">
          ← Breaking news
        </Link>
      </p>
      <h1 className={styles.pageTitle}>New breaking news item</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 24, fontSize: 14, lineHeight: 1.5 }}>
        Appears on the homepage below the blue hero when enabled and within the schedule window.
      </p>
      <BreakingNewsForm mode="create" />
    </div>
  );
}
