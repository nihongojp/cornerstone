import { config } from "dotenv";

/*
 * Build the vocabulary catalogue out of the strings already embedded in the
 * lessons.
 *
 *   npm run content:derive-terms            # write content/terms.json
 *   npm run content:derive-terms -- --seed  # …and upsert it into Payload
 *
 * Reads `content/snapshot/lessons.json` rather than the database, so it is
 * reproducible and reviewable without a connection.
 *
 * ── The merge, and why a human has to look at it ────────────────────────────
 *
 * The same phrase was retyped into five different blocks, and the copies do not
 * always agree: `Konnnichiwa` and `Konnichiwa`, `Okagesamade` and
 * `Okagesama de`, `~ desu ka` and `~ desu ka.`, `Dore` and `dore`. Merging them
 * is the entire point — but the rule that merges them (`fuzzyKey`, from
 * `utils/termMedia.ts`, which collapses doubled letters) is a heuristic built
 * for Compass typos, and applied across a whole vocabulary it will eventually
 * merge two words that are genuinely different. Japanese has real minimal pairs
 * on exactly that axis: おばさん (aunt) and おばあさん (grandmother) differ by a
 * held vowel.
 *
 * So every merge is recorded in `mergedFrom` and the run prints them. Read that
 * list once, fix anything wrong in `content/terms.json`, and commit the file —
 * from then on the JSON is the source and the heuristic is never consulted
 * again. This script runs to completion either way; it does not fail on a
 * merge, because a merge is not an error, it is a question.
 *
 * This is the last time `fuzzyKey` is used for anything. Once blocks reference
 * terms by relationship (Phase 4) `utils/termMedia.ts` goes away entirely.
 */

config({ path: ".env.local" });

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

import { kanaToRomaji } from "../../src/utils/kana";
import { kanaStrokeOrder } from "../../src/data/kanaStrokeOrder";

const SNAPSHOT = path.resolve("content/snapshot/lessons.json");
const OUT = path.resolve("content/terms.json");
const SEED = process.argv.includes("--seed");

/** Block fields that hold a term-like string. */
const TERM_FIELDS = ["term", "phrase", "card", "correctAnswer"];

const PLACEHOLDER = /placeholder/i;
const KANA = /^[぀-ゟ]+$/;
const KATAKANA_PAIR = /^([぀-ゟ]+)\/([゠-ヿ]+)$/;

type DerivedTerm = {
  key: string;
  kind: "kana" | "kanji" | "vocab" | "phrase";
  japanese?: string;
  katakana?: string;
  reading?: string;
  romaji?: string;
  strokes?: number;
  /** Media filenames; resolved to ids at seed time. */
  audio?: string;
  image?: string;
  strokeOrder?: string;
  /** Every raw spelling this entry absorbed. Review this. */
  mergedFrom: string[];
  /** Where it was found, for tracing back. */
  usedIn: string[];
};

/**
 * The merge key. Lowercased, stripped of spaces and trailing punctuation, with
 * doubled letters collapsed — `konnnichiwa` and `konnichiwa` both become
 * `konichiwa`.
 */
function mergeKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,!?]+$/g, "")
    .replace(/\s+/g, "")
    .replace(/(.)\1+/g, "$1");
}

/** A readable, stable identifier. */
function slugKey(raw: string): string {
  const base = raw
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return base || `term-${Buffer.from(raw).toString("hex").slice(0, 8)}`;
}

function classify(raw: string): { kind: DerivedTerm["kind"]; fields: Partial<DerivedTerm> } {
  const pair = raw.match(KATAKANA_PAIR);
  if (pair) {
    // "あ/ア" — the slash was the schema. Now it is two fields.
    const [, hira, kata] = pair;
    return {
      kind: "kana",
      fields: {
        japanese: hira,
        katakana: kata,
        romaji: kanaToRomaji(hira),
        strokes: kanaStrokeOrder[hira]?.strokes,
        strokeOrder: kanaStrokeOrder[hira]?.imageUrl.replace("/api/media/file/", ""),
      },
    };
  }

  if (KANA.test(raw)) {
    return { kind: "vocab", fields: { japanese: raw, reading: raw, romaji: kanaToRomaji(raw) } };
  }

  // Everything else in the imported content is romaji: a phrase if it has a
  // space or a pattern marker, a word otherwise. No Japanese script — that is
  // the editorial backlog the Terms collection header describes.
  const isPhrase = /\s/.test(raw) || raw.includes("~");
  return { kind: isPhrase ? "phrase" : "vocab", fields: { romaji: raw } };
}

function main() {
  if (!existsSync(SNAPSHOT)) {
    console.error(`\n✗ ${path.relative(process.cwd(), SNAPSHOT)} not found — run \`npm run content:export\` first.\n`);
    process.exit(1);
  }

  const lessons = JSON.parse(readFileSync(SNAPSHOT, "utf8")) as Array<{
    key: string;
    latest: Record<string, unknown>;
  }>;

  // ── Collect ────────────────────────────────────────────────────────────────
  type Sighting = { raw: string; lesson: string; blockType: string; audio?: string; image?: string };
  const sightings: Sighting[] = [];

  for (const lesson of lessons) {
    const walk = (node: unknown, blockType: string): void => {
      if (Array.isArray(node)) return node.forEach((n) => walk(n, blockType));
      if (!node || typeof node !== "object") return;
      const record = node as Record<string, unknown>;
      const type = typeof record.blockType === "string" ? record.blockType : blockType;

      for (const field of TERM_FIELDS) {
        const value = record[field];
        if (typeof value !== "string" || !value.trim()) continue;
        if (PLACEHOLDER.test(value)) continue; // unfinished copy, not vocabulary
        sightings.push({
          raw: value.trim(),
          lesson: lesson.key,
          blockType: type,
          // Media sits beside the term on the same block, as a $ref by filename.
          audio: refFilename(record.audio),
          image: refFilename(record.image),
        });
      }
      for (const value of Object.values(record)) {
        if (value && typeof value === "object") walk(value, type);
      }
    };
    walk(lesson.latest, "(lesson)");
  }

  // ── Merge ──────────────────────────────────────────────────────────────────
  const byKey = new Map<string, DerivedTerm>();

  for (const sighting of sightings) {
    const mk = mergeKey(sighting.raw);
    const existing = byKey.get(mk);

    if (!existing) {
      const { kind, fields } = classify(sighting.raw);
      byKey.set(mk, {
        key: slugKey(sighting.raw),
        kind,
        ...fields,
        audio: sighting.audio,
        image: sighting.image,
        mergedFrom: [sighting.raw],
        usedIn: [`${sighting.lesson}:${sighting.blockType}`],
      });
      continue;
    }

    if (!existing.mergedFrom.includes(sighting.raw)) existing.mergedFrom.push(sighting.raw);
    const usage = `${sighting.lesson}:${sighting.blockType}`;
    if (!existing.usedIn.includes(usage)) existing.usedIn.push(usage);
    // First non-empty wins: media was attached to whichever copy the author
    // happened to be editing, so any copy that has it is the answer.
    existing.audio ??= sighting.audio;
    existing.image ??= sighting.image;
  }

  const terms = [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));

  // ── Report ─────────────────────────────────────────────────────────────────
  const merged = terms.filter((t) => t.mergedFrom.length > 1);
  const noJapanese = terms.filter((t) => !t.japanese);
  const withAudio = terms.filter((t) => t.audio).length;

  console.log(`\n${sightings.length} term-like string(s) → ${terms.length} term(s)\n`);
  console.log(`  by kind: ${["kana", "kanji", "vocab", "phrase"]
    .map((k) => `${k} ${terms.filter((t) => t.kind === k).length}`)
    .join("  ")}`);
  console.log(`  with audio: ${withAudio}   with stroke order: ${terms.filter((t) => t.strokeOrder).length}`);

  if (merged.length) {
    console.log(`\n  ${merged.length} entr${merged.length === 1 ? "y" : "ies"} absorbed more than one spelling — REVIEW THESE:`);
    for (const t of merged) console.log(`    ${t.key.padEnd(24)} ${t.mergedFrom.map((s) => JSON.stringify(s)).join("  ")}`);
    console.log(
      "\n    Each line merged two spellings into one term. If any pair is actually two\n" +
        "    different words, split it in content/terms.json — the heuristic collapses\n" +
        "    doubled letters and cannot tell おばさん from おばあさん."
    );
  }

  if (noJapanese.length) {
    console.log(
      `\n  ${noJapanese.length} term(s) have no Japanese script — romaji only, as imported.\n` +
        "    That is the authoring backlog, not a failure of this script."
    );
  }

  writeFileSync(OUT, `${JSON.stringify(terms, null, 2)}\n`);
  console.log(`\n✓ ${path.relative(process.cwd(), OUT)} written`);

  if (!SEED) {
    console.log("  Review it, then re-run with --seed to upsert into Payload.\n");
    process.exit(0);
  }

  void seed(terms);
}

/** A `$ref` written by the snapshot exporter, as a filename. */
function refFilename(value: unknown): string | undefined {
  if (value && typeof value === "object" && "$ref" in value) {
    const ref = value as { $ref: string; $collection?: string };
    if (ref.$collection === "media") return ref.$ref;
  }
  return undefined;
}

async function seed(terms: DerivedTerm[]) {
  const { getPayload } = await import("payload");
  const { default: cfg } = await import("../../src/payload.config");
  const payload = await getPayload({ config: cfg });

  const media = await payload.find({
    collection: "media",
    depth: 0,
    limit: 0,
    pagination: false,
    overrideAccess: true,
  });
  const mediaByFilename = new Map<string, number>();
  for (const doc of media.docs) {
    const filename = (doc as unknown as Record<string, unknown>).filename;
    if (typeof filename === "string") mediaByFilename.set(filename, doc.id as number);
  }

  let created = 0;
  let updated = 0;
  const missingMedia: string[] = [];

  for (const term of terms) {
    const resolve = (filename?: string) => {
      if (!filename) return undefined;
      const id = mediaByFilename.get(filename);
      if (id === undefined) missingMedia.push(filename);
      return id;
    };

    const data = {
      key: term.key,
      kind: term.kind,
      japanese: term.japanese,
      katakana: term.katakana,
      reading: term.reading,
      romaji: term.romaji,
      strokes: term.strokes,
      audio: resolve(term.audio),
      image: resolve(term.image),
      strokeOrder: resolve(term.strokeOrder),
    };

    const existing = await payload.find({
      collection: "terms",
      where: { key: { equals: term.key } },
      limit: 1,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    });

    if (existing.docs.length) {
      await payload.update({
        collection: "terms",
        id: existing.docs[0].id,
        data: data as never,
        depth: 0,
        overrideAccess: true,
      });
      updated++;
    } else {
      await payload.create({ collection: "terms", data: data as never, depth: 0, overrideAccess: true });
      created++;
    }
  }

  console.log(`\n  seeded: ${created} created, ${updated} updated`);
  if (missingMedia.length) {
    console.log(`  ${new Set(missingMedia).size} media filename(s) not found in this database:`);
    for (const f of [...new Set(missingMedia)].slice(0, 10)) console.log(`    ${f}`);
  }
  console.log();
  process.exit(0);
}

main();
