import { redirect } from "next/navigation";

/** Live match edits happen in Edit Event → Edit match (Match Status + commentary). */
export default function BoxscoreLiveResultsRedirectPage() {
  redirect("/internal-admin/boxscore/events?status=live");
}
