import Link from "next/link";
import { notFound } from "next/navigation";
import { getBreakingNewsByIdForAdmin } from "@/lib/breakingNews";
import { BreakingNewsForm } from "../../BreakingNewsForm";
import styles from "../../../internal-admin.module.css";

export const metadata = {
  title: "Edit breaking news — Site admin",
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditBreakingNewsPage({ params }: Props) {
  const { id } = await params;
  const row = await getBreakingNewsByIdForAdmin(id);
  if (!row) notFound();

  return (
    <div style={{ maxWidth: 720 }}>
      <p style={{ marginBottom: 16 }}>
        <Link href="/internal-admin/breaking-news" className="app-link">
          ← Breaking news
        </Link>
      </p>
      <h1 className={styles.pageTitle}>Edit breaking news</h1>
      <BreakingNewsForm mode="edit" row={row} />
    </div>
  );
}
