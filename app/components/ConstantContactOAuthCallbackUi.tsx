import Link from "next/link";
import type { ConstantContactCallbackOutcome } from "@/lib/constantContactOAuthCallbackState";

type Props = {
  outcome: ConstantContactCallbackOutcome;
};

function PreBlock({ children }: { children: string }) {
  return (
    <pre
      style={{
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
        background: "#f4f4f5",
        padding: 12,
        borderRadius: 8,
        fontSize: 12,
        marginTop: 8,
        marginBottom: 16,
      }}
    >
      {children}
    </pre>
  );
}

export function ConstantContactOAuthCallbackUi({ outcome }: Props) {
  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: 24,
        maxWidth: 720,
        margin: "0 auto",
        lineHeight: 1.6,
      }}
    >
      <p style={{ marginBottom: 16 }}>
        <Link href="/" style={{ color: "#1a73e8" }}>
          ← Home
        </Link>
      </p>
      <h1 style={{ fontSize: "1.35rem", marginBottom: 16 }}>Constant Contact — connect your account</h1>

      {outcome.kind === "oauth_error" && (
        <p style={{ color: "#b91c1c", background: "#fef2f2", padding: 12, borderRadius: 8 }}>
          <strong>Error from Constant Contact:</strong> {outcome.err}
          {outcome.errDesc ? ` — ${outcome.errDesc}` : ""}
        </p>
      )}

      {outcome.kind === "success" && (
        <section>
          <p style={{ marginBottom: 12 }}>
            <strong>Step 1 — Copy these lines into your environment file</strong>
          </p>
          <p style={{ color: "#444", marginBottom: 8 }}>
            On your computer, open the Draftastic project folder. Find the file named <code>.env</code> (same folder as{" "}
            <code>package.json</code>). If there is no <code>.env</code>, create a new text file and name it exactly{" "}
            <code>.env</code>.
          </p>
          <p style={{ marginBottom: 8 }}>
            Paste or type the lines below. Replace any old <code>CONSTANT_CONTACT_ACCESS_TOKEN</code> line if you already have
            one.
          </p>
          <p style={{ marginBottom: 4 }}>
            <strong>Line A — access token</strong> (this is the long value the API needs; it usually starts with{" "}
            <code>eyJ</code>):
          </p>
          <PreBlock>{`CONSTANT_CONTACT_ACCESS_TOKEN=${outcome.accessToken}`}</PreBlock>
          {outcome.refreshToken ? (
            <>
              <p style={{ marginBottom: 4 }}>
                <strong>Line B — refresh token</strong> (save this; you can use it later when the access token expires):
              </p>
              <PreBlock>{`CONSTANT_CONTACT_REFRESH_TOKEN=${outcome.refreshToken}`}</PreBlock>
            </>
          ) : null}
          {outcome.expiresIn != null ? (
            <p style={{ color: "#666", fontSize: 14 }}>Access token expires in about {Math.round(outcome.expiresIn / 3600)} hours.</p>
          ) : null}

          <p style={{ marginTop: 20, marginBottom: 8 }}>
            <strong>Step 2 — Save the file and restart the dev server</strong>
          </p>
          <p style={{ color: "#444" }}>
            Save <code>.env</code>. In Terminal, stop the app (Ctrl+C), then run <code>npm run dev</code> again.
          </p>

          <p style={{ marginTop: 20, marginBottom: 8 }}>
            <strong>Step 3 — Get your mailing list ID</strong>
          </p>
          <p style={{ color: "#444" }}>
            In Terminal, from the same project folder, run <code>npm run cc:list-ids</code>. It will print a table: copy the{" "}
            <code>list_id</code> for the list you want, then add a line to <code>.env</code>:{" "}
            <code>CONSTANT_CONTACT_LIST_ID=…</code> (see the full guide in <code>docs/CONSTANT_CONTACT_SETUP.md</code>).
          </p>
        </section>
      )}

      {outcome.kind === "missing_env" && (
        <section>
          <p style={{ color: "#b91c1c", marginBottom: 12 }}>
            The server is missing <code>CONSTANT_CONTACT_CLIENT_ID</code> or <code>CONSTANT_CONTACT_OAUTH_REDIRECT_URI</code> in{" "}
            <code>.env</code>.
          </p>
          <p style={{ color: "#444" }}>
            Add both, restart <code>npm run dev</code>, then start again from{" "}
            <a href="/constant-contact/oauth" style={{ color: "#1a73e8" }}>
              /constant-contact/oauth
            </a>
            .
          </p>
          <p style={{ marginTop: 12, fontSize: 14, color: "#666" }}>
            Authorization code (for support only): <code style={{ wordBreak: "break-all" }}>{outcome.code}</code>
          </p>
        </section>
      )}

      {outcome.kind === "session_expired" && (
        <section>
          <p style={{ color: "#b91c1c", marginBottom: 12 }}>
            Your sign-in session expired, or you opened this page in a different browser than the one that started login.
          </p>
          <p style={{ color: "#444", marginBottom: 16 }}>
            Close this tab. In the <strong>same browser</strong>, go to{" "}
            <a href="/constant-contact/oauth" style={{ color: "#1a73e8" }}>
              /constant-contact/oauth
            </a>{" "}
            again and complete login within a few minutes. Do not copy the URL from another device.
          </p>
        </section>
      )}

      {outcome.kind === "exchange_failed" && (
        <section>
          <p style={{ color: "#b91c1c", marginBottom: 8 }}>
            <strong>Could not exchange the login code for tokens.</strong>
          </p>
          <PreBlock>{outcome.error}</PreBlock>
          <p style={{ color: "#444", marginBottom: 8 }}>
            Try starting again from{" "}
            <a href="/constant-contact/oauth" style={{ color: "#1a73e8" }}>
              /constant-contact/oauth
            </a>
            . If it keeps failing, check <code>docs/CONSTANT_CONTACT_SETUP.md</code> or support.
          </p>
          <p style={{ fontSize: 14, color: "#666" }}>
            Authorization code (expires quickly): <code style={{ wordBreak: "break-all" }}>{outcome.code}</code>
          </p>
        </section>
      )}

      {outcome.kind === "empty" && (
        <section style={{ color: "#333" }}>
          <p style={{ marginBottom: 12, fontSize: "1.05rem" }}>
            <strong>This page is the &quot;return address&quot; after Constant Contact login.</strong> It only does something
            when the address bar contains <code>?code=...</code> right after you approve access. If you opened{" "}
            <code>/callback</code> or <code>/constant-contact-callback</code> by itself, that is normal — there is no code yet.
          </p>
          <p style={{ marginBottom: 20 }}>
            <strong>Do this in order:</strong>
          </p>
          <ol style={{ paddingLeft: 20, marginBottom: 20 }}>
            <li style={{ marginBottom: 10 }}>
              In the Constant Contact Developer Portal, under your app&apos;s <strong>Redirect URIs</strong>, add the exact URL
              you will use (example: <code>http://localhost:3000/callback</code>). Use the <strong>same port</strong> Terminal
              shows when you run <code>npm run dev</code> (3000, 3002, etc.).
            </li>
            <li style={{ marginBottom: 10 }}>
              In your project&apos;s <code>.env</code> file, set{" "}
              <code>CONSTANT_CONTACT_OAUTH_REDIRECT_URI</code> to that <strong>exact</strong> same string, and set{" "}
              <code>CONSTANT_CONTACT_CLIENT_ID</code> to your app&apos;s Client ID. Save the file.
            </li>
            <li style={{ marginBottom: 10 }}>
              Restart <code>npm run dev</code> if it is already running (so it reloads <code>.env</code>).
            </li>
            <li>
              Click the button below. That starts login; after you approve, your browser will come <strong>back here</strong>{" "}
              with a code and you will see your tokens.
            </li>
          </ol>
          <p style={{ marginBottom: 12 }}>
            <a
              href="/constant-contact/oauth"
              style={{
                display: "inline-block",
                background: "#1a73e8",
                color: "#fff",
                padding: "12px 20px",
                borderRadius: 8,
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Start Constant Contact sign-in
            </a>
          </p>
          <p style={{ fontSize: 14, color: "#666" }}>
            Or paste this into the address bar (replace <code>3000</code> with your port if needed):{" "}
            <code style={{ wordBreak: "break-all" }}>http://localhost:3000/constant-contact/oauth</code>
          </p>
        </section>
      )}
    </main>
  );
}
