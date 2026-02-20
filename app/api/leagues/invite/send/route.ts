import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "Draftastic Fantasy <onboarding@resend.dev>";

/**
 * POST /api/leagues/invite/send — send invite email on behalf of the current user (commissioner).
 * Body: { league_id, invite_url, league_name, to_email, message? }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: "Sign in to send an invite." }, { status: 401 });
    }

    const body = await request.json();
    const leagueId = typeof body.league_id === "string" ? body.league_id.trim() : "";
    const inviteUrl = typeof body.invite_url === "string" ? body.invite_url.trim() : "";
    const leagueName = typeof body.league_name === "string" ? body.league_name.trim() : "";
    const toEmail = typeof body.to_email === "string" ? body.to_email.trim() : "";
    const customMessage = typeof body.message === "string" ? body.message.trim() : "";

    if (!leagueId || !inviteUrl || !leagueName || !toEmail) {
      return NextResponse.json(
        { error: "league_id, invite_url, league_name, and to_email are required." },
        { status: 400 }
      );
    }

    const { data: league } = await supabase
      .from("leagues")
      .select("id, commissioner_id")
      .eq("id", leagueId)
      .single();

    if (!league || league.commissioner_id !== user.id) {
      return NextResponse.json({ error: "Only the league commissioner can send invites." }, { status: 403 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Email is not configured. Add RESEND_API_KEY to enable sending invites." },
        { status: 503 }
      );
    }

    const resend = new Resend(apiKey);
    const subject = `You're invited to join ${leagueName} on Draftastic Fantasy`;
    const intro = `You're invited to join the fantasy league "${leagueName}" on Draftastic Fantasy.`;
    const cta = "Click the link below to join. The link expires in 7 days.";
    const messageBlock = customMessage ? `<p style="margin:16px 0;padding:12px;background:#f5f5f5;border-radius:8px;">${escapeHtml(customMessage)}</p>` : "";
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#333;">
  <p style="font-size:16px;line-height:1.5;">${intro}</p>
  ${messageBlock}
  <p style="font-size:16px;line-height:1.5;">${cta}</p>
  <p style="margin:24px 0;">
    <a href="${escapeHtml(inviteUrl)}" style="display:inline-block;padding:12px 24px;background:#1a73e8;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Join league</a>
  </p>
  <p style="font-size:14px;color:#666;">If the button doesn't work, copy and paste this link into your browser:</p>
  <p style="font-size:14px;word-break:break-all;color:#1a73e8;">${escapeHtml(inviteUrl)}</p>
  <p style="margin-top:32px;font-size:12px;color:#999;">Sent via Draftastic Fantasy. Reply to this email to contact the league commissioner.</p>
</body>
</html>
`;

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [toEmail],
      replyTo: user.email,
      subject,
      html,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
