import "server-only";

import { Resend } from "resend";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "Draftastic Fantasy <onboarding@resend.dev>";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string | null;
};

export async function sendTransactionalEmail(
  params: SendEmailParams
): Promise<{ ok: true; id?: string } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY is not configured." };
  }
  const to = params.to.trim();
  if (!to) return { ok: false, error: "Missing recipient email." };

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: [to],
    replyTo: params.replyTo?.trim() || undefined,
    subject: params.subject,
    html: params.html,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data?.id };
}
