# Constant Contact — setup guide (step by step)

This guide explains how to connect Draftastic to your Constant Contact account so people who opt in to marketing can be added to your email list. You only need to do this once (plus occasional token refresh).

---

## Words you will see

| Term | What it means |
|------|----------------|
| **Developer Portal** | Constant Contact’s website for developers: you register your app and allowed redirect URLs here. |
| **Client ID** | A public identifier for your app (not a secret). You copy it from the Developer Portal. |
| **Redirect URI** | The exact web address Constant Contact sends the user back to after login. It must match **character for character** in three places: the portal, your `.env` file, and the URL you use in the browser. |
| **Access token** | A long secret string (usually starts with `eyJ`) that lets the Draftastic **server** talk to Constant Contact’s API. You put it in `.env` as `CONSTANT_CONTACT_ACCESS_TOKEN`. |
| **Refresh token** | A second secret used later to get a **new** access token when the old one expires. Optional but recommended. |
| **List ID** | A UUID (like `50429486-338f-11ed-a355-fa163ef30863`) for one of your contact lists in Constant Contact. |

---

## Part A — Register your app (Constant Contact website)

1. Sign in to **Constant Contact**.
2. Open the **Developer Portal** (search “Constant Contact developer” or use the link from your CC account menus).
3. Open **My Applications** and select your app (for example “Draftastic Marketing Sync”), or create a new application.
4. Open the **OAuth2** (or similar) tab.
5. Under **Redirect URIs**, add **every** address you will use. Examples:
   - Local testing: `http://localhost:3000/callback`  
     (If your computer runs the site on a different port, use that port instead of `3000` — it must match what Terminal prints when you run `npm run dev`.)
   - Production: `https://draftastic-fantasy.netlify.app/`  
     (only if you use the site root; the path must match exactly including `/` at the end if you registered it that way.)
6. Click **Save**. If save fails with “CSRF”, refresh the page, sign out and back in, or try another browser.

---

## Part B — Put Client ID and Redirect URI in Draftastic

1. On your computer, open the **Draftastic project folder** (the one that contains `package.json`).
2. Find or create a file named **`.env`** in that same folder (the name starts with a dot; no `.txt` on the end).
3. Open `.env` in a text editor (VS Code, Notepad, etc.).
4. Add these lines (replace with **your** values):

```bash
CONSTANT_CONTACT_CLIENT_ID=paste-your-client-id-here
CONSTANT_CONTACT_OAUTH_REDIRECT_URI=http://localhost:3000/callback
```

**Important:**

- `CONSTANT_CONTACT_CLIENT_ID` is the **Client ID / API key** from **My Applications** in the Developer Portal — not the word “your-client-id” from examples.
- `CONSTANT_CONTACT_OAUTH_REDIRECT_URI` must be **exactly** one of the Redirect URIs you saved in Part A (same `http` vs `https`, same port, same path).

5. Save `.env`.

---

## Part C — Log in once (browser)

**Important:** Do **not** open `/callback` or `/constant-contact-callback` first and expect anything to happen. Those URLs are only used **automatically** after Constant Contact redirects you. You always **start** from `/constant-contact/oauth`.

1. Open **Terminal** (or Command Prompt), go to your project folder, and run:

   ```bash
   npm run dev
   ```

2. Read the line that says **Local:** — for example `http://localhost:3000` or `http://localhost:3002`.  
   If the port is **not** 3000, go back to Part A and Part B and change **both** the Developer Portal and `.env` to use that port (for example `http://localhost:3002/callback`).

3. In your **web browser**, open **this** address (not the callback page):

   `http://localhost:PORT/constant-contact/oauth`  
   (replace `PORT` with the number from step 2, usually `3000`.)

4. Constant Contact will ask you to **log in** and **allow** the app.

5. After you approve, your browser will go to your **callback** page (for example `/callback`).  
   **The app will now show you the exact lines to put in `.env`** — including the real **access token** and **refresh token**.  
   You do **not** need to run `curl` or copy a short code by hand anymore.

6. Copy those lines into `.env`, save, then **stop** the dev server (Ctrl+C) and run `npm run dev` again.

---

## Part D — List ID (which list to add contacts to)

1. With `CONSTANT_CONTACT_ACCESS_TOKEN` already in `.env`, in Terminal (project folder) run:

   ```bash
   npm run cc:list-ids
   ```

2. You will see a table of **list_id** and list **name**. Pick the list you want for Draftastic.

3. Add to `.env`:

   ```bash
   CONSTANT_CONTACT_LIST_ID=paste-the-list-id-here
   ```

4. Save `.env` and restart `npm run dev` if the server is running.

---

## Part E — Production (Netlify)

1. In the **Netlify** dashboard, open your site → **Site configuration** → **Environment variables**.
2. Add the same variables as in `.env`:  
   `CONSTANT_CONTACT_CLIENT_ID`,  
   `CONSTANT_CONTACT_OAUTH_REDIRECT_URI` (your **production** redirect URL, registered in the Developer Portal),  
   `CONSTANT_CONTACT_ACCESS_TOKEN`,  
   `CONSTANT_CONTACT_REFRESH_TOKEN` (optional),  
   `CONSTANT_CONTACT_LIST_ID`.
3. Trigger a **new deploy** so the live site sees the new variables.

---

## If something goes wrong

- **“Session expired” on the callback page**  
  Start again from `/constant-contact/oauth` in the **same browser** and finish within a few minutes.

- **`npm run cc:list-ids` says 401**  
  The value in `CONSTANT_CONTACT_ACCESS_TOKEN` must be the **long** access token from the callback page (usually starts with `eyJ`), not the short refresh token by itself.

- **When the access token expires**  
  Use `npm run cc:refresh-token` if you saved `CONSTANT_CONTACT_REFRESH_TOKEN`, or run Part C again to get new tokens.

---

## Privacy

Never commit `.env` to git or paste live tokens into public chats. If a token was exposed, revoke or rotate it in Constant Contact and create new tokens.
