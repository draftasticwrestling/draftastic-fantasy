/**
 * Server-only: exchange OAuth authorization code + PKCE verifier for access/refresh tokens.
 * @see https://v3.developer.constantcontact.com/api_guide/pkce_flow.html
 */
export async function exchangeConstantContactPkceCode(input: {
  code: string;
  codeVerifier: string;
  clientId: string;
  redirectUri: string;
}): Promise<
  | { ok: true; access_token: string; refresh_token?: string; expires_in?: number }
  | { ok: false; error: string; httpStatus?: number }
> {
  const tokenUrl = new URL("https://authz.constantcontact.com/oauth2/default/v1/token");
  tokenUrl.searchParams.set("client_id", input.clientId);
  tokenUrl.searchParams.set("redirect_uri", input.redirectUri);
  tokenUrl.searchParams.set("code", input.code);
  tokenUrl.searchParams.set("code_verifier", input.codeVerifier);
  tokenUrl.searchParams.set("grant_type", "authorization_code");

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
    return { ok: false, error: text || `HTTP ${res.status}`, httpStatus: res.status };
  }

  try {
    const json = JSON.parse(text) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!json.access_token) {
      return { ok: false, error: "No access_token in token response." };
    }
    return {
      ok: true,
      access_token: json.access_token,
      refresh_token: json.refresh_token,
      expires_in: json.expires_in,
    };
  } catch {
    return { ok: false, error: "Token server did not return valid JSON." };
  }
}
