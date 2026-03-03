# Coming Soon Landing Page

The app includes a **standalone** coming soon landing for **draftasticprowrestling.com** with embedded Constant Contact signup. The main site (other domains) is unchanged so you can keep developing there.

## Behavior

**On draftasticprowrestling.com only:**
- **`/`** shows the coming soon page (hero + embedded signup). No app nav, no other links.
- Any other path (e.g. `/leagues`, `/wrestlers`) **redirects to `/`**, so only the landing is reachable.
- Root layout is minimal (no Nav, no PageLayout) so the domain is a clean, standalone landing.

**On all other domains** (e.g. your Netlify default URL):
- Normal app: full nav, all routes, `/` = app home.
- **`/coming-soon`** still exists for preview (with app nav/chrome).

## Constant Contact

A **“Join the list”** button links to the Constant Contact signup page (opens in a new tab). Constant Contact’s page does not allow iframe embedding, so we use a direct link instead.

**https://lp.constantcontactpages.com/sl/Qe4DAFj**

To use a different signup URL, edit `CONSTANT_CONTACT_SIGNUP_URL` in `app/coming-soon/EmailSignupForm.tsx`.

## Domain setup

Point **draftasticprowrestling.com** to the same Netlify site. Middleware and the root layout detect the host and serve the locked-down landing only on that domain.
