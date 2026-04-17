type ConstantContactUpsertInput = {
  email: string;
  firstName?: string | null;
  source: "signup" | "account_settings";
};

function getConfig() {
  const accessToken = process.env.CONSTANT_CONTACT_ACCESS_TOKEN?.trim() ?? "";
  const listId = process.env.CONSTANT_CONTACT_LIST_ID?.trim() ?? "";
  const apiBase = process.env.CONSTANT_CONTACT_API_BASE?.trim() || "https://api.cc.email/v3";
  return { accessToken, listId, apiBase };
}

function isConfigured(): boolean {
  const { accessToken, listId } = getConfig();
  return Boolean(accessToken && listId);
}

function normEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function ccFetch(path: string, init: RequestInit): Promise<Response> {
  const { accessToken, apiBase } = getConfig();
  const headers = new Headers(init.headers ?? {});
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Content-Type", "application/json");
  return fetch(`${apiBase}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}

function payloadForUpsert(input: ConstantContactUpsertInput, listId: string): Record<string, unknown> {
  return {
    email_address: { address: normEmail(input.email), permission_to_send: "explicit" },
    list_memberships: [listId],
    first_name: (input.firstName ?? "").trim() || undefined,
    create_source: "Contact",
  };
}

export async function syncMarketingOptInToConstantContact(input: ConstantContactUpsertInput): Promise<{
  ok: boolean;
  skipped?: boolean;
  reason?: string;
}> {
  if (!isConfigured()) {
    return { ok: true, skipped: true, reason: "constant-contact-not-configured" };
  }
  const { listId } = getConfig();
  const email = normEmail(input.email);
  if (!email) return { ok: false, reason: "missing-email" };

  try {
    // Search for existing contact by email.
    const searchRes = await ccFetch(`/contacts?email=${encodeURIComponent(email)}`, {
      method: "GET",
    });
    if (!searchRes.ok) {
      return { ok: false, reason: `search-failed-${searchRes.status}` };
    }
    const searchJson = (await searchRes.json()) as {
      contacts?: Array<{ contact_id?: string; list_memberships?: string[] }>;
    };
    const existing = searchJson.contacts?.[0];
    const payload = payloadForUpsert(input, listId);

    if (existing?.contact_id) {
      const mergedMemberships = Array.from(new Set([...(existing.list_memberships ?? []), listId]));
      const updateRes = await ccFetch(`/contacts/${encodeURIComponent(existing.contact_id)}`, {
        method: "PUT",
        body: JSON.stringify({
          ...payload,
          list_memberships: mergedMemberships,
        }),
      });
      if (!updateRes.ok) {
        return { ok: false, reason: `update-failed-${updateRes.status}` };
      }
      return { ok: true };
    }

    const createRes = await ccFetch("/contacts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!createRes.ok) {
      return { ok: false, reason: `create-failed-${createRes.status}` };
    }
    return { ok: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: `exception-${msg}` };
  }
}
