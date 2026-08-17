import { config } from "dotenv";

/*
 * Structural checks over the published content. Read-only; exits non-zero on
 * a failure.
 *
 *   npm run content:verify
 *
 * This replaces a string convention with a test. "Is this media slot filled?"
 * used to be answered by looking for "PLACEHOLDER" inside a URL, in seven
 * near-copies of the same helper. Now a slot is filled if the relationship
 * resolves, and that is checkable from outside the app — which is the point:
 * the failure mode of an `upload` relationship is silence. Too shallow a
 * `depth`, or an access rule that denies the populate, and every media field
 * comes back null with nothing logged and a lesson that renders blank.
 *
 * It reads at exactly the depth and populate the app uses (`lib/content/depth.ts`)
 * so a regression here is a regression there.
 *
 * ── Rich text has its own references, and its own silence ────────────────────
 *
 * Since Phase 3 a reference can also live inside a Lexical document, where the
 * key is `value` rather than `image`/`audio`/`video` and nothing about the shape
 * says "relationship". Two of those matter:
 *
 *  - an `upload` node whose file did not populate renders no image
 *  - a `termRef` whose term did not populate renders *nothing at all* —
 *    `renderableTerm` returns null rather than printing a database id, which is
 *    right for a learner and invisible to everyone else
 *
 * A `termRef` needs two hops (the term, then the term's audio), which is why
 * `CONTENT_DEPTH` is 2 — so these checks are what stop it silently going back.
 *
 * Resources are verified as well as lessons now. A link's description is rich
 * text, so it can hold both kinds of reference, and its read moved off `depth: 0`
 * for that reason.
 *
 * Doubles as the "which lessons are incomplete" report — the placeholder and
 * empty-slot counts are editorial to-dos, reported but not failures.
 */

config({ path: ".env.local" });

import { CONTENT_DEPTH, MEDIA_POPULATE } from "../../src/lib/content/depth";

type Problem = { doc: string; where: string; detail: string };

const PLACEHOLDER = /placeholder/i;

/** Media fields as `payload/fields/media.ts` names them. */
const MEDIA_FIELDS = ["image", "audio", "video"] as const;

/** `termRef` display modes that put the term's Japanese script on screen. */
const NEEDS_SCRIPT = ["furigana", "plain"];

async function main() {
  const { getPayload } = await import("payload");
  const { default: configPromise } = await import("../../src/payload.config");
  const payload = await getPayload({ config: configPromise });

  const read = {
    where: { _status: { equals: "published" } },
    depth: CONTENT_DEPTH,
    populate: MEDIA_POPULATE,
    limit: 0,
    pagination: false as const,
    overrideAccess: true,
  };

  const { docs: lessons } = await payload.find({ collection: "lessons", ...read });
  const { docs: resources } = await payload.find({ collection: "resources", ...read });

  const failures: Problem[] = [];
  const todos: Problem[] = [];
  let resolved = 0;
  let termRefs = 0;
  let empty = 0;

  /**
   * A populated upload, or a failure.
   *
   * A number here means the relationship did not populate. That is the depth
   * bug, and it is invisible from the app — `mediaSrc` returns undefined and the
   * page renders without the asset.
   */
  const checkMedia = (doc: string, value: unknown, where: string): void => {
    if (typeof value === "number" || typeof value === "string") {
      failures.push({
        doc,
        where,
        detail: `unpopulated upload (got a bare id: ${value}). Read depth is ${CONTENT_DEPTH}; it is not enough.`,
      });
      return;
    }
    const media = value as { url?: string | null; filename?: string | null };
    if (!media.url) {
      failures.push({
        doc,
        where,
        detail: `media "${media.filename ?? "?"}" populated but has no url`,
      });
      return;
    }
    resolved++;
  };

  /** The two kinds of reference a Lexical document can hold. */
  const checkLexicalNode = (doc: string, node: Record<string, unknown>, where: string): void => {
    if (node.type === "upload" && node.value !== null && node.value !== undefined) {
      checkMedia(doc, node.value, `${where}<upload>`);
      return;
    }

    const fields = node.fields as Record<string, unknown> | null | undefined;
    if (node.type !== "inlineBlock" || fields?.blockType !== "termRef") return;

    const here = `${where}<termRef>`;
    const term = fields.term;

    if (term === null || term === undefined) {
      failures.push({ doc, where: here, detail: "termRef has no term — it renders nothing" });
      return;
    }
    if (typeof term === "number" || typeof term === "string") {
      failures.push({
        doc,
        where: here,
        detail:
          `unpopulated term (got a bare id: ${term}). Read depth is ${CONTENT_DEPTH}; ` +
          "the word renders as nothing at all, with no error anywhere.",
      });
      return;
    }
    termRefs++;

    const record = term as Record<string, unknown>;
    const key = String(record.key ?? "?");

    /*
     * `showAudio` needs the *second* hop. At depth 1 the term itself populates
     * and its audio comes back as an id, so the play button silently disappears —
     * the one failure that looks identical to "this term has no audio yet".
     */
    if (fields.showAudio === true) {
      const audio = record.audio;
      if (typeof audio === "number" || typeof audio === "string") {
        failures.push({
          doc,
          where: here,
          detail:
            `term "${key}" has audio but it did not populate (bare id: ${audio}). ` +
            `Read depth is ${CONTENT_DEPTH}; a termRef needs 2 to reach the term's audio.`,
        });
      } else if (audio === null || audio === undefined) {
        todos.push({
          doc,
          where: here,
          detail: `termRef asks for audio but term "${key}" has none recorded`,
        });
      }
    }

    // Editorial, not structural: 24 of 41 terms are romaji only, so a `furigana`
    // or `plain` termRef falls back to the reading. It renders — it just does not
    // render Japanese, which is a content gap worth counting rather than hiding.
    if (NEEDS_SCRIPT.includes(String(fields.display)) && !record.japanese) {
      todos.push({
        doc,
        where: here,
        detail: `termRef shows "${String(fields.display)}" but term "${key}" has no Japanese script`,
      });
    }
  };

  /*
   * The rules a Payload `validate` cannot reach.
   *
   * A field validate runs before the relationship is populated, so it sees a
   * term as a bare id — it can require that a term is *picked*, never that the
   * term has audio, a meaning, or a katakana form. Every one of those makes an
   * exercise silently unplayable rather than broken: `RenderBlock` drops a pair
   * whose two sides came out identical and renders nothing when too few remain,
   * so the failure looks exactly like a screen that was never authored.
   *
   * This reads the populated content, so it can check them. It is the same
   * division of labour as `payload/fields/media.ts` and PLACEHOLDER: the schema
   * enforces what it can see, and this enforces the rest.
   */
  function checkLibraryBlock(doc: string, block: Record<string, unknown>, where: string): void {
    const blockType = block.blockType;

    if (blockType === "matchPairs") {
      const pairing = String(block.pairing ?? "");
      const list = (Array.isArray(block.terms) ? block.terms : [])
        .map((t) => (t && typeof t === "object" ? (t as Record<string, unknown>) : null))
        .filter((t): t is Record<string, unknown> => t !== null);

      /** The field each side of the pair actually reads. */
      const missing = list.filter((t) => {
        if (pairing === "meaning") return !t.meaning;
        if (pairing === "kana") return !t.katakana;
        if (pairing === "reading") return !t.reading && !t.romaji;
        if (pairing === "audio") return !t.audio;
        return false;
      });

      if (missing.length) {
        failures.push({
          doc,
          where,
          detail:
            `pairing is "${pairing}" but ${missing.length} of ${list.length} term(s) have nothing ` +
            `on that side (${missing.map((t) => String(t.key)).join(", ")}). Those pairs are ` +
            "dropped at render, and a screen with fewer than two left renders nothing at all.",
        });
      } else if (list.length - missing.length < 2) {
        failures.push({
          doc,
          where,
          detail: `only ${list.length - missing.length} usable pair(s) — a matching exercise needs two`,
        });
      }
    }

    if (blockType === "listenAndChoose" || blockType === "speakAndScore") {
      const t = block.term;
      if (t && typeof t === "object" && !(t as Record<string, unknown>).audio) {
        failures.push({
          doc,
          where,
          detail:
            `term "${String((t as Record<string, unknown>).key)}" has no audio. ` +
            (blockType === "listenAndChoose"
              ? "There is nothing for the learner to hear."
              : "The scorer has nothing to grade the recording against."),
        });
      }
    }

    if (blockType === "buildSentence") {
      const tiles = (Array.isArray(block.tiles) ? block.tiles : []).map(String);
      const sequence = (Array.isArray(block.correctSequence) ? block.correctSequence : []).map(String);
      const absent = sequence.filter((tile) => !tiles.includes(tile));
      if (absent.length) {
        failures.push({
          doc,
          where,
          detail: `correctSequence has tiles that are not in the pool: ${absent.join(", ")}`,
        });
      }
    }

    if (blockType === "multipleChoice") {
      const options = Array.isArray(block.options) ? block.options : [];
      const correct = options.filter((o) => (o as { isCorrect?: unknown })?.isCorrect === true);
      if (correct.length !== 1) {
        failures.push({
          doc,
          where,
          detail: `${correct.length} option(s) marked correct out of ${options.length} — exactly one is needed`,
        });
      }
    }

    if (blockType === "mediaFigure") {
      const set = ["image", "audio", "video"].filter((kind) => block[kind]);
      if (set.length !== 1) {
        failures.push({
          doc,
          where,
          detail: `a figure holds one file, and this one has ${set.length}${set.length ? ` (${set.join(", ")})` : ""}`,
        });
      }
    }
  }

  /**
   * Walks anything and checks every reference it finds, of either kind.
   *
   * One walk over the raw document rather than a traversal per field type: blocks
   * nest arrays inside blocks inside arrays and a rich-text field can appear at
   * any level, so the shape of that tree is not worth encoding a second time.
   */
  const walk = (doc: string, node: unknown, path: string): void => {
    if (Array.isArray(node)) return node.forEach((n, i) => walk(doc, n, `${path}[${i}]`));
    if (!node || typeof node !== "object") return;

    checkLexicalNode(doc, node as Record<string, unknown>, path);

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const here = `${path}.${key}`;

      if ((MEDIA_FIELDS as readonly string[]).includes(key) && value !== null && value !== undefined) {
        checkMedia(doc, value, here);
        continue;
      }

      if (typeof value === "string" && PLACEHOLDER.test(value)) {
        todos.push({ doc, where: here, detail: `placeholder copy: "${value}"` });
      }

      if (value && typeof value === "object") walk(doc, value, here);
    }
  };

  for (const lesson of lessons) {
    const slug = String(lesson.slug);
    const exercises = Array.isArray(lesson.exercises) ? lesson.exercises : [];

    // Lesson-level prose is rich text too, and can hold both kinds of reference.
    walk(slug, lesson.funFact, "funFact");
    walk(slug, lesson.notes, "notes");

    exercises.forEach((exercise, index) => {
      const components = Array.isArray(exercise?.components) ? exercise.components : [];
      components.forEach((block: unknown, b: number) => {
        const blockType = String((block as { blockType?: string })?.blockType ?? "?");
        const where = `exercise[${index}].components[${b}]`;
        if (blockType === "legacyJson") {
          todos.push({
            doc: slug,
            where,
            detail: "legacyJson block — has never rendered; re-author or delete it",
          });
        }
        checkLibraryBlock(slug, block as Record<string, unknown>, `${where}:${blockType}`);
        walk(slug, block, `${where}:${blockType}`);
      });
    });
  }

  for (const resource of resources) {
    walk(`resources/${String(resource.category)}`, resource.items, "items");
  }

  // Count unfilled slots separately: absent media is legitimate (most blocks
  // have optional image/audio), it is just worth knowing how much is missing.
  for (const lesson of lessons) {
    const exercises = Array.isArray(lesson.exercises) ? lesson.exercises : [];
    for (const exercise of exercises) {
      for (const block of exercise?.components ?? []) {
        for (const field of MEDIA_FIELDS) {
          if (field in (block as object) && (block as Record<string, unknown>)[field] == null) empty++;
        }
      }
    }
  }

  console.log(
    `\nVerifying ${lessons.length} published lesson(s) and ${resources.length} resource group(s)\n`
  );
  console.log(`  media relationships resolved: ${resolved}`);
  console.log(`  media slots left empty:       ${empty}`);
  console.log(`  term references resolved:     ${termRefs}`);

  if (todos.length) {
    console.log(`\n  ${todos.length} editorial to-do(s) — not failures:`);
    for (const t of todos.slice(0, 15)) console.log(`    ${t.doc}  ${t.where}\n      ${t.detail}`);
    if (todos.length > 15) console.log(`    … and ${todos.length - 15} more`);
  }

  if (failures.length) {
    console.error(`\n✗ ${failures.length} structural failure(s):\n`);
    for (const f of failures.slice(0, 20)) {
      console.error(`    ${f.doc}  ${f.where}\n      ${f.detail}`);
    }
    if (failures.length > 20) console.error(`    … and ${failures.length - 20} more`);
    console.error();
    process.exit(1);
  }

  console.log("\n✓ every media relationship and term reference resolves\n");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
