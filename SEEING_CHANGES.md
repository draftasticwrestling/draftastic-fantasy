# How to see scoring changes on event results

If you changed scoring or King/Queen logic but the event results page looks the same, use this checklist.

## 1. Confirm you’re on the Draftastic Fantasy app

- Event results must be on **this app** (the one in this repo), e.g. `http://localhost:3000/results/[eventId]` or your deployed Draftastic Fantasy URL.
- If you’re viewing **prowrestlingboxscore.com**, that’s a different app and won’t show changes made here.

## 2. Use the “Points calculated at” line

- Open an event results page (e.g. Night of Champions or the June 20 SmackDown).
- Under the event title you should see a gray line: **“Points calculated at 2025-02-14T…”**.
- **Reload the page (F5 or Cmd+R).** The timestamp should **change** every time.
  - If it **never changes** on reload, the server is either not running from this repo or the response is cached (see below).
  - If it **does change** on reload, the code in this repo is running and points are recomputed on each load.

## 3. Restart the dev server after code changes

- Stop the server (Ctrl+C in the terminal where `npm run dev` is running).
- Start it again: `npm run dev`.
- Reload the event results page and check the timestamp again.

## 4. If you use production build (`npm run build` + `npm run start`)

- After any scoring/code change you must **rebuild**: run `npm run build`, then `npm run start`.
- Otherwise the running app is still the old build.

## 5. Hard refresh in the browser

- **Windows/Linux:** Ctrl+Shift+R or Ctrl+F5  
- **Mac:** Cmd+Shift+R  

This reduces the chance the browser is showing a cached version of the page.

---

**Summary:** Use the “Points calculated at …” line. If it updates on every reload, the new logic is active. If it doesn’t, restart the dev server (or rebuild for production) and try again.
