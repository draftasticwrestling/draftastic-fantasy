import { escapeHtml } from "@/lib/email/sendEmail";
import { absoluteUrl } from "@/lib/sitePublicOrigin";

export function emailLayout(opts: {
  preheader?: string;
  bodyHtml: string;
}): string {
  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(opts.preheader)}</div>`
    : "";
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#333;line-height:1.5;">
  ${preheader}
  ${opts.bodyHtml}
  <p style="margin-top:32px;font-size:12px;color:#999;">
    You received this because of your notification settings on Draftastic Fantasy.
    Update preferences in <a href="${escapeHtml(accountSettingsUrl())}" style="color:#1a73e8;">Account settings</a>.
  </p>
</body>
</html>`;
}

function accountSettingsUrl(): string {
  return absoluteUrl("/account");
}

export function emailButton(href: string, label: string): string {
  return `<p style="margin:24px 0;">
    <a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 24px;background:#1a73e8;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">${escapeHtml(label)}</a>
  </p>`;
}

export function emailMutedLink(href: string): string {
  return `<p style="font-size:14px;word-break:break-all;color:#1a73e8;">${escapeHtml(href)}</p>`;
}
