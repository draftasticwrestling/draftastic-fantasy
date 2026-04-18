/**
 * Exchanges a Constant Contact OAuth refresh_token for a new access_token (PKCE app).
 * Use this if you accidentally put refresh_token in CONSTANT_CONTACT_ACCESS_TOKEN — API calls need access_token.
 *
 * Requires in .env / .env.local:
 *   CONSTANT_CONTACT_CLIENT_ID
 *   CONSTANT_CONTACT_OAUTH_REDIRECT_URI (same as authorize + portal)
 *   CONSTANT_CONTACT_REFRESH_TOKEN
 *
 * Prints the new access_token (JWT) for CONSTANT_CONTACT_ACCESS_TOKEN and a new refresh_token to save.
 *
 * Usage: npm run cc:refresh-token
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(repoRoot, ".env") });
config({ path: path.join(repoRoot, ".env.local"), override: true });

const TOKEN_URL = "https://authz.constantcontact.com/oauth2/default/v1/token";

async function main() {
  const clientId = process.env.CONSTANT_CONTACT_CLIENT_ID?.trim() ?? "";
  const redirectUri = process.env.CONSTANT_CONTACT_OAUTH_REDIRECT_URI?.trim() ?? "";
  let refreshToken = process.env.CONSTANT_CONTACT_REFRESH_TOKEN?.trim() ?? "";
  const accessMaybe = process.env.CONSTANT_CONTACT_ACCESS_TOKEN?.trim() ?? "";
  if (!refreshToken && accessMaybe && !accessMaybe.startsWith("eyJ")) {
    refreshToken = accessMaybe;
    console.warn(
      "Using CONSTANT_CONTACT_ACCESS_TOKEN as refresh_token (it does not look like a JWT access token). After this succeeds, move the new access_token into CONSTANT_CONTACT_ACCESS_TOKEN.\n"
    );
  }
  if (!refreshToken) {
    console.error(
      "Set CONSTANT_CONTACT_REFRESH_TOKEN to the refresh_token from the OAuth token JSON, or put the refresh value in CONSTANT_CONTACT_ACCESS_TOKEN if you mistook it for the access token."
    );
    process.exit(1);
  }
  if (!clientId || !redirectUri) {
    console.error("Missing CONSTANT_CONTACT_CLIENT_ID or CONSTANT_CONTACT_OAUTH_REDIRECT_URI.");
    process.exit(1);
  }

  const tokenUrl = new URL(TOKEN_URL);
  tokenUrl.searchParams.set("client_id", clientId);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("refresh_token", refreshToken);
  tokenUrl.searchParams.set("grant_type", "refresh_token");

  const res = await fetch(tokenUrl.toString(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "",
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`HTTP ${res.status}`);
    console.error(text);
    process.exit(1);
  }

  type TokenJson = {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
  };
  let json: TokenJson;
  try {
    json = JSON.parse(text) as TokenJson;
  } catch {
    console.error("Response was not JSON:", text.slice(0, 400));
    process.exit(1);
  }

  if (!json.access_token) {
    console.error("No access_token in response:", text.slice(0, 400));
    process.exit(1);
  }

  console.log("Copy these into .env (access_token is the JWT used for api.cc.email):\n");
  console.log(`CONSTANT_CONTACT_ACCESS_TOKEN=${json.access_token}`);
  if (json.refresh_token) {
    console.log(`CONSTANT_CONTACT_REFRESH_TOKEN=${json.refresh_token}`);
  }
  console.log(`\nexpires_in (seconds): ${json.expires_in ?? "?"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
