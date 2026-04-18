import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * One-click Constant Contact OAuth (authorization code flow + PKCE).
 *
 * CC requires PKCE (code_challenge / code_challenge_method) on the authorize URL;
 * without it, the authz server often returns 400.
 *
 * Set in Netlify (same values as in Developer Portal → application):
 *   CONSTANT_CONTACT_CLIENT_ID   = application Client ID (API key)
 *   CONSTANT_CONTACT_OAUTH_REDIRECT_URI = exact registered redirect (must match the portal
 *     byte-for-byte, including trailing slash). Examples:
 *     https://draftastic-fantasy.netlify.app/constant-contact-callback
 *     https://draftastic-fantasy.netlify.app/
 *
 * Then open (in production): /constant-contact/oauth
 *
 * The code_verifier is stored in an httpOnly cookie for a later token exchange.
 */
function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function generateCodeVerifier(): string {
  return base64UrlEncode(randomBytes(32));
}

function codeChallengeS256(verifier: string): string {
  return base64UrlEncode(createHash("sha256").update(verifier, "utf8").digest());
}

/** Doc placeholders — must be replaced with the real API key from Developer Portal → My Applications. */
function looksLikePlaceholderClientId(id: string): boolean {
  const lower = id.toLowerCase().trim();
  if (!lower) return true;
  return (
    new Set([
      "your-client-id-from-portal",
      "your-app-client-id",
      "your-client-id",
    ]).has(lower) || lower.includes("xxxx")
  );
}

export async function GET(request: Request) {
  const clientId = process.env.CONSTANT_CONTACT_CLIENT_ID?.trim() ?? "";
  const redirectUri = process.env.CONSTANT_CONTACT_OAUTH_REDIRECT_URI?.trim() ?? "";
  const scope =
    process.env.CONSTANT_CONTACT_OAUTH_SCOPE?.trim() ?? "contact_data offline_access";

  if (!clientId || !redirectUri) {
    const missing: string[] = [];
    if (!clientId) missing.push("CONSTANT_CONTACT_CLIENT_ID");
    if (!redirectUri) missing.push("CONSTANT_CONTACT_OAUTH_REDIRECT_URI");

    const onNetlify = process.env.NETLIFY === "true";
    const onVercel = Boolean(process.env.VERCEL);

    const fix: string[] = [
      "Add each missing key to a file named .env in the project root (same folder as package.json).",
      "No spaces around the = sign. Example lines (use your real values):",
      "  CONSTANT_CONTACT_CLIENT_ID=abc123...",
      "  CONSTANT_CONTACT_OAUTH_REDIRECT_URI=http://localhost:3000/callback",
      "If you use .env.local, do not leave those keys set to an empty value — that overrides .env.",
      "Stop the dev server (Ctrl+C), run npm run dev again, then open http://localhost:PORT/constant-contact/oauth (PORT from the dev server log).",
    ];
    if (onNetlify || onVercel) {
      fix.unshift(
        onNetlify
          ? "This response is coming from Netlify. Your laptop’s .env file is NOT used on the live site. Add CONSTANT_CONTACT_CLIENT_ID and CONSTANT_CONTACT_OAUTH_REDIRECT_URI in Netlify → Site configuration → Environment variables, then redeploy."
          : "This response is coming from Vercel. Add the same variables in the Vercel project → Settings → Environment Variables, then redeploy."
      );
    } else {
      fix.push(
        "If your browser address bar shows netlify.app or vercel.app, you are not on your dev machine — configure env vars on that host, or use localhost for testing."
      );
    }

    return NextResponse.json(
      {
        error:
          "These environment variables are missing or empty on the server that handled this request.",
        missing,
        fix,
        host: onNetlify ? "netlify" : onVercel ? "vercel" : "other",
      },
      { status: 503 }
    );
  }

  if (looksLikePlaceholderClientId(clientId)) {
    return NextResponse.json(
      {
        error:
          "CONSTANT_CONTACT_CLIENT_ID looks like a placeholder. In .env use the real application API key / Client ID from Constant Contact Developer Portal → My Applications (not the text from docs).",
      },
      { status: 400 }
    );
  }

  let redirectParsed: URL;
  try {
    redirectParsed = new URL(redirectUri);
  } catch {
    return NextResponse.json(
      { error: "CONSTANT_CONTACT_OAUTH_REDIRECT_URI is not a valid absolute URL (include http:// or https://)." },
      { status: 400 }
    );
  }

  const hostHeader = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const hostParts = hostHeader.split(":");
  const requestPort =
    hostParts.length > 1 && /^\d+$/.test(hostParts[hostParts.length - 1]!)
      ? hostParts[hostParts.length - 1]
      : null;
  const redirectPort = redirectParsed.port || (redirectParsed.protocol === "https:" ? "443" : "80");
  if (
    (redirectParsed.hostname === "localhost" || redirectParsed.hostname === "127.0.0.1") &&
    requestPort &&
    redirectParsed.port &&
    redirectParsed.port !== requestPort
  ) {
    return NextResponse.json(
      {
        error: "Redirect URI port does not match this dev server.",
        detail: `You opened this page on port ${requestPort}, but CONSTANT_CONTACT_OAUTH_REDIRECT_URI uses port ${redirectParsed.port}.`,
        fix: `Use http://localhost:${requestPort}/callback in both .env and the Developer Portal redirect list (or free port 3000 and run next dev on 3000).`,
      },
      { status: 400 }
    );
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = codeChallengeS256(codeVerifier);
  const state = base64UrlEncode(randomBytes(24));

  const authorize = new URL("https://authz.constantcontact.com/oauth2/default/v1/authorize");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", scope);
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("code_challenge", codeChallenge);
  authorize.searchParams.set("code_challenge_method", "S256");

  const isProd = process.env.NODE_ENV === "production";
  const res = NextResponse.redirect(authorize.toString(), 302);
  res.cookies.set("cc_oauth_pkce_verifier", codeVerifier, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isProd,
    maxAge: 600,
  });
  res.cookies.set("cc_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isProd,
    maxAge: 600,
  });

  return res;
}
