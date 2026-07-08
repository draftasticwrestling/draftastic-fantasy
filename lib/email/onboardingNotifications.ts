import "server-only";

import { emailButton, emailLayout } from "@/lib/email/layout";
import { resolveUserEmailTarget } from "@/lib/email/recipients";
import { escapeHtml, isEmailConfigured, sendTransactionalEmail } from "@/lib/email/sendEmail";
import { PLAY_PATH } from "@/lib/playFunnel";
import { absoluteUrl } from "@/lib/sitePublicOrigin";

function logEmailSkip(reason: string, detail?: string): void {
  const msg = detail ? `${reason}: ${detail}` : reason;
  if (process.env.NODE_ENV === "development") {
    console.warn("[email] skipped —", msg);
  }
}

/** Re-engagement email for users who signed up but never joined a league. */
export async function notifyAbandonedSignup(userId: string): Promise<boolean> {
  if (!isEmailConfigured()) {
    logEmailSkip("RESEND_API_KEY is not set");
    return false;
  }

  const target = await resolveUserEmailTarget(userId);
  if (!target?.email) {
    logEmailSkip("no auth email for user", userId);
    return false;
  }

  const joinUrl = absoluteUrl(PLAY_PATH);
  const howItWorksUrl = absoluteUrl("/how-it-works");
  const bodyHtml = `
    <p style="font-size:16px;line-height:1.5;">Hi${target.displayName ? ` ${escapeHtml(target.displayName)}` : ""},</p>
    <p style="font-size:16px;line-height:1.5;">
      Looks like you created your Draftastic account but haven&apos;t jumped into a league yet.
      Here&apos;s the quick version:
    </p>
    <ul style="font-size:16px;line-height:1.6;padding-left:20px;">
      <li><strong>Joining is free.</strong> Public leagues use a fantasy salary cap — not real money.</li>
      <li><strong>Most leagues take only a few minutes each week.</strong> Set your lineup, watch the shows, check scores.</li>
      <li><strong>You can always join another league later.</strong> No long-term commitment.</li>
      <li><strong>Season already started?</strong> New public leagues launch every Monday.</li>
    </ul>
    ${emailButton(joinUrl, "Join a league")}
    <p style="font-size:15px;line-height:1.5;color:#555;">
      Not sure how it works? Read the
      <a href="${escapeHtml(howItWorksUrl)}" style="color:#1a73e8;">two-minute overview</a>.
    </p>`;

  const html = emailLayout({
    preheader: "Join a free public league — new leagues open every Monday.",
    bodyHtml,
  });

  const result = await sendTransactionalEmail({
    to: target.email,
    subject: "You were almost there — join a free fantasy league",
    html,
  });

  if (!result.ok) {
    console.warn("[email] abandoned signup nudge failed:", userId, result.error);
    return false;
  }
  return true;
}
