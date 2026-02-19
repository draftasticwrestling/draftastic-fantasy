# User Accounts & Auth: Approach and Considerations

This doc outlines the recommended approach for letting users create accounts and use them to form leagues, manage teams, draft, and trade—and what to keep in mind as we build it.

**Implemented:** Sign up / sign in with **email+password** and **Google OAuth**, sign out, forgot password, cookie-based sessions via `@supabase/ssr`, and Nav showing auth state.

---

## Enabling Google sign-in (Supabase Dashboard)

1. In [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **Providers**, enable **Google**.
2. Add your OAuth client ID and secret (from [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → OAuth 2.0 Client ID, type “Web application”). Use authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`.
3. In **Authentication** → **URL Configuration**, set **Site URL** to your app origin (e.g. `http://localhost:3000` for dev). Add **Redirect URLs** to include `http://localhost:3000/auth/callback` and your production URL (e.g. `https://yourdomain.com/auth/callback`).

---

## Recommended approach: Supabase Auth

**Use Supabase Auth** for sign-up, sign-in, and sessions. You already use Supabase for data; Auth is built-in, integrates with Row Level Security (RLS), and avoids a separate auth service.

### Why Supabase Auth

- **Already in the stack** — One provider for DB + auth; no extra API keys or billing for a separate auth product.
- **RLS integration** — Policies can use `auth.uid()` so users only see their own leagues, rosters, and trades.
- **Multiple sign-in options** — Email/password, magic link, and OAuth (Google, GitHub, etc.) with minimal config.
- **Hosted and secure** — Passwords hashed, tokens managed; you don’t handle raw secrets.
- **Next.js friendly** — Use `@supabase/ssr` so the session is stored in HTTP-only cookies and works in both Server and Client Components.

### Implementation outline

1. **Add `@supabase/ssr`**  
   Create a Supabase client that reads/writes the session from cookies (per-request on the server, from cookies on the client). Supabase docs: [Next.js App Router with SSR](https://supabase.com/docs/guides/auth/server-side/nextjs).

2. **Auth routes**  
   - **Sign up** — Email + password (and optionally “display name”). Optionally require email confirmation.  
   - **Sign in** — Email + password, or “Sign in with Google” (etc.).  
   - **Sign out** — Clear session.  
   - **Password reset** — “Forgot password” flow using Supabase’s built-in email.

3. **Profile (display identity)**  
   Supabase gives you `auth.users` (id, email). Add a **`profiles`** table (or similar) keyed by `user_id` (uuid from `auth.users`): e.g. `display_name`, `avatar_url`, `created_at`. Create a row on first sign-up (DB trigger or app code). Use `display_name` in leagues, rosters, and trades.

4. **Linking leagues to users**  
   Today leagues/rosters use `owner_slug` (e.g. `christopher-cramer`). For MVL, introduce **league membership**: e.g. `league_members(league_id, user_id, role, display_name_or_slug)`. “Owner” in a league = one row in `league_members`. Rosters, draft picks, and trades then reference that membership (e.g. `owner_user_id` or a stable `member_id`) instead of a free-text slug. You can still derive a slug from `profiles.display_name` for URLs if you want.

5. **RLS**  
   - **Leagues** — User can read leagues they’re a member of; create league if authenticated.  
   - **Rosters / draft picks / trades** — Scoped by league and membership; only members of that league can read/write as appropriate.  
   - **Profiles** — Users can read all profiles (for display names in the league); only update their own.

---

## Considerations as we build

### 1. Identity and sign-up

- **Email/password** — Simple; add validation (e.g. password strength, email format). Consider “confirm email” so you have a reachable address for invites and password reset.
- **OAuth (Google, GitHub, etc.)** — Fewer passwords to manage; Supabase Dashboard → Authentication → Providers. Decide which providers you want and document for users.
- **Magic link** — “Sign in with a link sent to your email” — good for low-friction; ensure your email domain is configured in Supabase so links aren’t marked spam.
- **Spam/bots** — Rate-limit sign-up and sign-in (Supabase has some built-in; you can add stricter limits in your API routes or Edge). Optional: CAPTCHA or “invite-only” leagues where only invited emails can join.

### 2. Sessions and security

- **Cookie-based session** — Use `@supabase/ssr` so the session is in an HTTP-only cookie (not `localStorage`). Reduces XSS risk and works cleanly with server-rendered pages.
- **Session duration** — Supabase lets you configure JWT expiry and refresh. Balance UX (not logging out too often) vs security (shorter expiry on sensitive actions if you add them).
- **HTTPS** — Always in production so cookies and tokens aren’t sent over plain HTTP.
- **Sign-out everywhere** — Optional “sign out of all devices” by invalidating refresh tokens or tracking sessions in DB; for MVL, single-device sign-out is usually enough.

### 3. Data model and RLS

- **One source of truth for “who is in a league”** — e.g. `league_members` with `user_id`, `league_id`, `role` (commissioner, owner). All roster/draft/trade logic checks membership.
- **Migration from slug-based to user-based** — Current app uses `owner_slug`. Plan a path: either MVL is user-only from day one, or you add `user_id` to existing tables and backfill from a mapping (e.g. “christopher-cramer” → user_id). For a clean MVL, starting with `user_id` + `profiles.display_name` is simpler.
- **RLS policies** — Write policies that use `auth.uid()` and league membership. Test: logged-in user A cannot see user B’s roster in a league B isn’t in; cannot submit trades for leagues they’re not in; etc.

### 4. Roles and league membership

- **Commissioner** — Can edit league settings, generate invite links, (optionally) approve trades, enter offline draft results. Stored as `role` on `league_members`.
- **Owner** — Can manage own roster, draft (when draft is open), propose trades, view league. Same table, different `role`.
- **Invited / pending** — Optional state “invited but not yet joined” so you can show “Pending invites” and only count “joined” members for draft start.

### 5. Invites and joining leagues

- **Invite by email** — Store `league_invites(email, league_id, token, expires_at)`. Send email (or “Copy invite link”) with token; when they sign up or sign in, resolve token and add to `league_members`. Prevents random people joining without an invite if you make “join by token” the only path.
- **Invite link** — Same token in URL; if user is logged in, “Accept invite” adds them. If not, prompt sign-in/sign-up then add.
- **Discovery** — Decide if leagues are “invite-only” or “anyone with link can join.” For MVL, invite-only is simpler and safer.

### 6. Profile and display

- **Display name** — Shown in league, draft order, trade partner dropdown. Store in `profiles` and optionally allow edit on a “My account” or “Profile” page.
- **Avatar** — Optional; Supabase Storage bucket for avatars, or URL from OAuth provider. Keep small (e.g. 128px) for performance.
- **Email visibility** — Usually keep email private; show only to commissioner for “invite” purposes if needed. Don’t expose other members’ emails by default.

### 7. Legal and UX

- **Terms of service / Privacy policy** — Needed if you collect email and personal data; link from sign-up and footer.
- **Forgot password** — Use Supabase’s “Reset password” flow so users can regain access.
- **Account deletion** — “Delete my account” should revoke session, then either anonymize or delete `profiles` and optionally leave league data under a “Deleted User” label so league history stays consistent. Document in privacy policy.
- **Under-13 / COPPA** — If you might have under-13 users, you’d need extra steps; for a fantasy league, “13+” is a common and simple policy.

### 8. Edge cases

- **User deletes account** — Decide: transfer commissioner to someone else first? Mark league as “has left” and hide their roster? Don’t delete league data that other members depend on (scores, history).
- **Change email** — Supabase supports it; update `auth.users` and notify user. No need to change `user_id`; leagues stay tied to that id.
- **Merge accounts** — Rare; avoid if possible. If you ever need it, it’s a one-off script: reassign `league_members`, rosters, trades from old `user_id` to new one, then disable old account.
- **Multiple leagues per user** — Design from the start: one user, many `league_members` rows. UI: “My leagues” list; “Switch league” or per-league navigation.

---

## Suggested order of work

1. **Supabase Auth + SSR** — Add `@supabase/ssr`, cookie-based client, middleware to refresh session.  
2. **Sign up / Sign in / Sign out** — Simple email/password pages; optional “Sign in with Google” later.  
3. **Profiles table** — `user_id`, `display_name`, `created_at`; create on first sign-up.  
4. **“My account” or Profile page** — Show display name, email (masked), link to “Edit profile” and “Change password”.  
5. **RLS** — Start with profiles (user can update own); then leagues and league_members once you add “create league” and “invite”.

This sets you up so “create league & invite friends” and the rest of the MVL roadmap can assume a logged-in user and a clear membership model.
