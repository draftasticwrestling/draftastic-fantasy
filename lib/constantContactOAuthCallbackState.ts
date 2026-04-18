import { cookies } from "next/headers";
import { exchangeConstantContactPkceCode } from "@/lib/constantContactOAuthExchange";

export type ConstantContactCallbackOutcome =
  | { kind: "empty" }
  | { kind: "oauth_error"; err: string; errDesc: string | null }
  | {
      kind: "success";
      accessToken: string;
      refreshToken?: string;
      expiresIn?: number;
    }
  | { kind: "missing_env"; code: string }
  | { kind: "session_expired"; code: string }
  | { kind: "exchange_failed"; error: string; code: string };

/**
 * After Constant Contact redirects back with ?code=..., exchange the code for tokens using
 * the PKCE verifier stored in an httpOnly cookie when /constant-contact/oauth started.
 */
export async function resolveConstantContactCallback(
  sp: Record<string, string | string[] | undefined>
): Promise<ConstantContactCallbackOutcome> {
  const code = typeof sp.code === "string" ? sp.code : null;
  const state = typeof sp.state === "string" ? sp.state : null;
  const err = typeof sp.error === "string" ? sp.error : null;
  const errDesc = typeof sp.error_description === "string" ? sp.error_description : null;

  if (err) {
    return { kind: "oauth_error", err, errDesc };
  }

  if (!code) {
    return { kind: "empty" };
  }

  const cookieStore = await cookies();
  const verifier = cookieStore.get("cc_oauth_pkce_verifier")?.value;
  const storedState = cookieStore.get("cc_oauth_state")?.value;
  const clientId = process.env.CONSTANT_CONTACT_CLIENT_ID?.trim() ?? "";
  const redirectUri = process.env.CONSTANT_CONTACT_OAUTH_REDIRECT_URI?.trim() ?? "";

  if (!clientId || !redirectUri) {
    return { kind: "missing_env", code };
  }

  if (!verifier || !state || !storedState || state !== storedState) {
    return { kind: "session_expired", code };
  }

  const result = await exchangeConstantContactPkceCode({
    code,
    codeVerifier: verifier,
    clientId,
    redirectUri,
  });

  if (result.ok) {
    return {
      kind: "success",
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
      expiresIn: result.expires_in,
    };
  }

  return { kind: "exchange_failed", error: result.error, code };
}
