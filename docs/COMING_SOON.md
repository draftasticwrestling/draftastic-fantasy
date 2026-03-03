# Coming Soon Landing Page

The app includes a **coming soon** landing page for **draftasticprowrestling.com** with email signup for Constant Contact.

## Routes

- **`/coming-soon`** — Always shows the coming soon page (hero + email form).
- When the request **host** is **draftasticprowrestling.com**, the **root path (`/`)** is rewritten to `/coming-soon` so the domain’s homepage is the landing page. Other domains (e.g. your Netlify default URL) still see the normal app home at `/`.

## Constant Contact

The “Get notified when we launch” button links to the Constant Contact signup page:

**https://lp.constantcontactpages.com/sl/Qe4DAFj**

The link opens in a new tab. To use a different signup URL, edit `CONSTANT_CONTACT_SIGNUP_URL` in `app/coming-soon/EmailSignupForm.tsx`.

## Domain setup

Point **draftasticprowrestling.com** to the same app (e.g. add it as a domain in Netlify). The middleware will serve the coming soon page at `/` for that host.
