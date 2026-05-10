# Resend + Supabase Auth (email confirmation & password reset)

This project sends **league invite** emails via the Resend **HTTP API** (`RESEND_API_KEY` in Netlify / `.env`).  
**Supabase Auth** (signup confirmation, magic links, password reset) sends mail **only through SMTP settings in the Supabase Dashboard**—not through Next.js env vars.

Use **one Resend account** for both: same verified domain and API key.

---

## 1. Resend dashboard

1. [Sign up / log in](https://resend.com/).
2. **Domains** → Add your domain (e.g. `draftasticprowrestling.com`) → add the DNS records Resend shows → wait until **Verified**.
3. **API Keys** → Create a key (e.g. “Production”) → copy `re_…` (keep secret).

**Limits (check Resend dashboard for current numbers):** Free tier includes a daily send cap; upgrade if auth + invites exceed it.

---

## 2. Supabase → SMTP (not the “Email” provider modal)

The **Email** item under Authentication opens **policy toggles** (password length, OTP expiry, etc.) — **no SMTP fields**.

Custom SMTP lives here (replace `YOUR_PROJECT_REF`):

`https://supabase.com/dashboard/project/YOUR_PROJECT_REF/auth/smtp`

Or: **Authentication** in the sidebar → find **SMTP** (or **Project settings → Authentication**).

Enable **Custom SMTP** on that page.

Use Resend’s SMTP ([docs](https://resend.com/docs/send-with-smtp)):

| Field | Value |
|--------|--------|
| **Host** | `smtp.resend.com` |
| **Port** | `465` (SSL) **or** `587` (STARTTLS)—match **Sender email** encryption option Supabase shows |
| **Username** | `resend` |
| **Password** | Your Resend **API key** (`re_…`) — same idea as `RESEND_API_KEY` for the app |
| **Sender email** | An address on your **verified** domain, e.g. `auth@yourdomain.com` or reuse `invites@yourdomain.com` |
| **Sender name** | e.g. `Draftastic Fantasy` |

Save. Send a **test email** from Supabase if the UI offers it.

**Important:** Auth emails must use a **verified domain** address. `onboarding@resend.dev` is not suitable for production volume or branding.

---

## 3. Supabase → Authentication → Rate Limits

With **custom SMTP** enabled, you can raise limits (project-wide).

Your screenshot showed **2 emails / hour** for “Rate limit for sending emails”—that will cause **“email rate limit exceeded”** almost immediately in production (signups, resets, retries).

After SMTP is saved:

1. Open **Authentication** → **Rate Limits**.
2. Increase **Rate limit for sending emails** to something aligned with Resend’s plan and your traffic (e.g. **30–120 / hour** to start; raise if needed).
3. Optionally review **token verifications (OTP / magic link)** and **sign-ups / sign-ins** so legitimate users are not throttled during spikes.
4. Click **Save changes**.

---

## 4. App env (Netlify / `.env`) — invites only

These power **`/api/leagues/invite/send`** (Resend SDK), not Supabase Auth:

```bash
RESEND_API_KEY=re_xxxx          # Same key as SMTP password above (or a separate key with send permission)
RESEND_FROM_EMAIL=Draftastic Fantasy <invites@yourdomain.com>
```

Use addresses on the **same verified domain** for consistent deliverability.

---

## 5. Checklist

- [ ] Domain verified in Resend  
- [ ] Custom SMTP filled in Supabase Auth with `smtp.resend.com` + `resend` + API key  
- [ ] Sender email on verified domain  
- [ ] Auth rate limits increased above **2/hour**  
- [ ] `RESEND_API_KEY` + `RESEND_FROM_EMAIL` set on Netlify for invite emails  
- [ ] **Redirect URLs** and **Site URL** still include your production URL and `/auth/callback`

---

## 6. If users still hit limits

- Confirm SMTP test from Supabase succeeds.  
- Check Resend **Logs** for bounces or blocks.  
- Temporarily point users to **Sign in with Google** (no auth email).  
- See `docs/USER_ACCOUNTS_AND_AUTH.md` for URL configuration.
