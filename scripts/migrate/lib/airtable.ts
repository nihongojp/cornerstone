/**
 * Write-side Airtable helper for the one-off migration scripts.
 *
 * Separate from src/lib/airtable/client.ts on purpose: that one is read-only,
 * cached by Next, and ships with the app. This one writes, throttles, and only
 * ever runs from a developer's machine.
 */

const API_ROOT = "https://api.airtable.com/v0";

// Airtable allows 5 requests/second per base and starts returning 429s above
// that. 250ms between calls keeps us at 4/s with room to spare.
const REQUEST_INTERVAL_MS = 250;

// Airtable's own cap for create/update batches.
const BATCH_SIZE = 10;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function credentials() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) {
    throw new Error("AIRTABLE_API_KEY and AIRTABLE_BASE_ID must be set (see .env.example)");
  }
  return { apiKey, baseId };
}

export type AirtableRecord = { id: string; fields: Record<string, unknown> };

async function request(
  table: string,
  init: RequestInit & { query?: string }
): Promise<any> {
  const { apiKey, baseId } = credentials();
  const url = `${API_ROOT}/${baseId}/${encodeURIComponent(table)}${init.query ?? ""}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    throw new Error(`Airtable ${init.method ?? "GET"} ${table} failed: ${res.status} ${await res.text()}`);
  }

  await sleep(REQUEST_INTERVAL_MS);
  return res.json();
}

/**
 * Creates or updates records, matching existing ones on `mergeOn`.
 *
 * Using Airtable's upsert means the scripts are idempotent: the rehearsal run
 * and the final cutover run against the same source produce the same records
 * instead of duplicates.
 */
export async function upsertRecords(
  table: string,
  mergeOn: string[],
  records: Array<{ fields: Record<string, unknown> }>
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const body = await request(table, {
      method: "PATCH",
      body: JSON.stringify({
        performUpsert: { fieldsToMergeOn: mergeOn },
        records: batch,
        typecast: true,
      }),
    });

    created += body.createdRecords?.length ?? 0;
    updated += body.updatedRecords?.length ?? 0;
  }

  return { created, updated };
}

/** Reads every record in a table, following pagination. */
export async function listAllRecords(table: string): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const search = new URLSearchParams();
    if (offset) search.set("offset", offset);
    const body = await request(table, { query: `?${search}` });
    records.push(...body.records);
    offset = body.offset;
  } while (offset);

  return records;
}

/**
 * Airtable long-text fields hold ~100k characters. A lesson whose JSON exceeds
 * that would be silently truncated, so the scripts refuse to write it and say
 * which record is at fault.
 */
export const MAX_LONG_TEXT = 95_000;

export function assertFits(label: string, field: string, value: string) {
  if (value.length > MAX_LONG_TEXT) {
    throw new Error(
      `${label}: field "${field}" is ${value.length} chars, over the ${MAX_LONG_TEXT} limit. ` +
        `Split it across two fields (e.g. Items + Items2) and concatenate in the adapter.`
    );
  }
}

/** JSON for an Airtable long-text field, omitted entirely when empty. */
export function jsonField(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value) && value.length === 0) return undefined;
  return JSON.stringify(value, null, 2);
}
