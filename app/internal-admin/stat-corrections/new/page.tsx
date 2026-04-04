import Link from "next/link";
import { NewCorrectionForm } from "../NewCorrectionForm";
import styles from "../../internal-admin.module.css";

export const metadata = {
  title: "New stat correction — Site admin",
};

export default function NewStatCorrectionPage() {
  return (
    <div style={{ maxWidth: 720 }}>
      <p style={{ marginBottom: 16 }}>
        <Link href="/internal-admin/stat-corrections" className="app-link">
          ← Stat corrections
        </Link>
      </p>
      <h1 className={styles.pageTitle}>New stat correction</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: 24, fontSize: 14, lineHeight: 1.5 }}>
        Published entries appear on each league&apos;s Stat corrections tab (plus site-wide rows when league slug is empty).
        Uses the service role and writes an audit log row.
      </p>
      <NewCorrectionForm />
    </div>
  );
}
