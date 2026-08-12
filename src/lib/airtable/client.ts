import "server-only";

/*
 * Minimal Airtable REST client.
 *
 * Deliberately plain `fetch` rather than the `airtable` npm package: that
 * package uses its own HTTP client, which bypasses Next's data cache entirely.
 * Going through fetch means every content read is cached and revalidated by
 * Next, which is what keeps us far under Airtable's 5 requests/second limit —
 * a cached table is read roughly once per revalidate window, not once per
 * visitor.
 */

const API_ROOT = "https://api.airtable.com/v0";

/** Default cache lifetime for content reads. Author edits arrive sooner via
 *  on-demand revalidation (see src/app/api/revalidate/route.ts). */
export const DEFAULT_REVALIDATE = 300;

export type AirtableRecord = {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
};

type ListOptions = {
  /** filterByFormula, sort, maxRecords, etc. */
  params?: Record<string, string | number | undefined>;
  /** Cache tags for on-demand revalidation. */
  tags?: string[];
  revalidate?: number;
};

function credentials() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) {
    throw new Error(
      "AIRTABLE_API_KEY / AIRTABLE_BASE_ID are not set — see .env.example"
    );
  }
  return { apiKey, baseId };
}

/**
 * Fetches every record in a table, following Airtable's `offset` pagination.
 * Airtable caps each page at 100 records.
 */
export async function listRecords(
  table: string,
  { params = {}, tags = [], revalidate = DEFAULT_REVALIDATE }: ListOptions = {}
): Promise<AirtableRecord[]> {
  const { apiKey, baseId } = credentials();
  const records: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") search.set(key, String(value));
    }
    if (offset) search.set("offset", offset);

    const url = `${API_ROOT}/${baseId}/${encodeURIComponent(table)}?${search}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate, tags },
    });

    if (!res.ok) {
      throw new Error(
        `Airtable ${table} request failed: ${res.status} ${await res.text()}`
      );
    }

    const page = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    records.push(...page.records);
    offset = page.offset;
  } while (offset);

  return records;
}

/** Escapes a value for use inside a filterByFormula string literal. */
export function formulaValue(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}
