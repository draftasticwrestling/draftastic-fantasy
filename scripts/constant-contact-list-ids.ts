/**
 * Lists Constant Contact list_id (UUID) + name using CONSTANT_CONTACT_ACCESS_TOKEN from .env.
 * Avoids curl/shell quoting issues with long Bearer tokens.
 *
 * Usage (from repo root): npm run cc:list-ids
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(repoRoot, ".env") });
config({ path: path.join(repoRoot, ".env.local"), override: true });

function normalizeAccessToken(raw: string | undefined): string {
  let t = raw?.trim() ?? "";
  if (t.toLowerCase().startsWith("bearer ")) {
    t = t.slice(7).trim();
  }
  return t;
}

async function main() {
  const token = normalizeAccessToken(process.env.CONSTANT_CONTACT_ACCESS_TOKEN);
  if (!token) {
    console.error(
      "Missing CONSTANT_CONTACT_ACCESS_TOKEN. Add it to .env in the repo root (same folder as package.json), then run:\n  npm run cc:list-ids\nIf you use .env.local, ensure it does not set this variable to an empty value (that overrides .env)."
    );
    process.exit(1);
  }

  const apiBase = process.env.CONSTANT_CONTACT_API_BASE?.trim() || "https://api.cc.email/v3";
  const url = `${apiBase}/contact_lists?limit=500`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const body = await res.text();
  if (!res.ok) {
    console.error(`HTTP ${res.status}`);
    console.error(body);
    if (res.status === 401) {
      console.error(
        "\n401: Constant Contact rejected this Bearer token. V3 **access_token** values are long JWTs (usually start with eyJ). If your value is short, you may have pasted **refresh_token** into CONSTANT_CONTACT_ACCESS_TOKEN — run: npm run cc:refresh-token (after setting CONSTANT_CONTACT_REFRESH_TOKEN). Otherwise re-run OAuth token exchange and copy access_token from the JSON."
      );
    }
    process.exit(1);
  }

  type ListsResponse = {
    lists?: Array<{ list_id?: string; name?: string }>;
  };

  let json: ListsResponse;
  try {
    json = JSON.parse(body) as ListsResponse;
  } catch {
    console.error("Response was not JSON:");
    console.error(body.slice(0, 500));
    process.exit(1);
  }

  const lists = json.lists ?? [];
  if (lists.length === 0) {
    console.log("No lists returned. Create a list in Constant Contact (Contacts → Lists), then run again.");
    process.exit(0);
  }

  console.log("list_id\tname");
  console.log("-".repeat(72));
  for (const row of lists) {
    const id = row.list_id ?? "";
    const name = row.name ?? "";
    console.log(`${id}\t${name}`);
  }
  console.log("\nSet CONSTANT_CONTACT_LIST_ID in .env to the list_id you want for Draftastic.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
