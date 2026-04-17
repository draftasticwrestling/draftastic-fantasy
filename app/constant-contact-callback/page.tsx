import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Constant Contact — OAuth callback",
  robots: { index: false, follow: false },
};

/**
 * Utility page for the one-time Constant Contact OAuth flow.
 * Register this exact URL as a Redirect URI in the CC Developer Portal:
 * https://draftastic-fantasy.netlify.app/constant-contact-callback
 */
export default async function ConstantContactCallbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const code = typeof sp.code === "string" ? sp.code : null;
  const err = typeof sp.error === "string" ? sp.error : null;
  const errDesc = typeof sp.error_description === "string" ? sp.error_description : null;

  return (
    <main
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: 24,
        maxWidth: 640,
        margin: "0 auto",
        lineHeight: 1.5,
      }}
    >
      <p style={{ marginBottom: 16 }}>
        <Link href="/" style={{ color: "#1a73e8" }}>
          ← Home
        </Link>
      </p>
      <h1 style={{ fontSize: "1.25rem", marginBottom: 12 }}>Constant Contact OAuth</h1>
      {err ? (
        <p style={{ color: "#b91c1c", background: "#fef2f2", padding: 12, borderRadius: 8 }}>
          <strong>Error:</strong> {err}
          {errDesc ? ` — ${errDesc}` : ""}
        </p>
      ) : code ? (
        <>
          <p style={{ marginBottom: 8 }}>
            Copy the <strong>authorization code</strong> below, then exchange it for an access token (see{" "}
            <a
              href="https://v3.developer.constantcontact.com/api_guide/server_flow.html"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#1a73e8" }}
            >
              Constant Contact server flow
            </a>
            ). Codes expire in a few minutes.
          </p>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              background: "#f4f4f5",
              padding: 12,
              borderRadius: 8,
              fontSize: 13,
            }}
          >
            {code}
          </pre>
        </>
      ) : (
        <p style={{ color: "#555" }}>
          No <code>code</code> in the URL. Use this page only as the <strong>redirect URI</strong> when authorizing your Constant Contact
          app. After you approve access, you should be sent back here with a code in the address bar.
        </p>
      )}
    </main>
  );
}
