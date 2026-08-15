import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { TAGS } from "../../../../lib/airtable/content";

/*
 * On-demand cache invalidation for content edits.
 *
 * Content reads are cached for DEFAULT_REVALIDATE seconds, so without this an
 * author's Airtable edit would take minutes to appear. Wire an Airtable
 * automation ("When record updated" → "Run script") to POST here and edits go
 * live in seconds.
 *
 *   POST /api/revalidate?secret=<REVALIDATE_SECRET>
 *   { "table": "Lessons" | "NewLessons" | "Resources", "slug": "l1-v1" }
 *
 * `slug` is optional; without it the whole table's cache is dropped.
 */

const TABLE_TAGS: Record<string, { all: string; one?: (slug: string) => string }> = {
  lessons: { all: TAGS.lessons, one: TAGS.lesson },
  newlessons: { all: TAGS.newLessons, one: TAGS.newLesson },
  resources: { all: TAGS.resources },
};

export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json({ message: "Revalidation is not configured" }, { status: 503 });
  }
  if (request.nextUrl.searchParams.get("secret") !== secret) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: { table?: string; slug?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Expected a JSON body" }, { status: 400 });
  }

  const entry = TABLE_TAGS[String(body.table || "").toLowerCase()];
  if (!entry) {
    return NextResponse.json(
      { message: `Unknown table "${body.table}". Expected one of: Lessons, NewLessons, Resources.` },
      { status: 400 }
    );
  }

  // Next 16 requires a cache-life profile. "max" gives stale-while-revalidate:
  // the next visitor is served the cached copy while the refresh happens behind
  // them, rather than waiting on Airtable.
  const revalidated = [entry.all];
  revalidateTag(entry.all, "max");

  if (body.slug && entry.one) {
    const tag = entry.one(body.slug);
    revalidateTag(tag, "max");
    revalidated.push(tag);
  }

  return NextResponse.json({ revalidated });
}
