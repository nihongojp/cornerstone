/*
 * Old blocks → the ten-block library, as a transform over the content snapshot.
 *
 *   npm run content:migrate-blocks                    # dry run: a report
 *   npm run content:migrate-blocks -- --lesson l1-v1  # one lesson at a time
 *   npm run content:migrate-blocks -- --lesson l1-v1 --yes
 *
 * Then `npm run content:import -- --yes` and `npm run content:verify`.
 *
 * ── Why a snapshot transform and not SQL ────────────────────────────────────
 *
 * This moves 141 block rows across 15 shapes into 10 new ones. As SQL that is a
 * hand-written INSERT..SELECT per pair across 17 live tables *and* their
 * `_lessons_v_blocks_*` mirrors, with the relationship rows to match. As a JSON
 * transform it is a function from one shape to another, reviewable as a diff, and
 * re-runnable. Making that possible is the whole reason Phase 0b exists.
 *
 * ── Nothing is force-fit ────────────────────────────────────────────────────
 *
 * The standing decision on this rework is that content too malformed to model
 * gets set aside for a review with Sachi rather than bent into a shape it does
 * not fit — some of it was never meant to publish. So every block either maps
 * cleanly or goes to `content/quarantine.json` with its lesson, its position, its
 * original shape and the reason. A partial mapping that silently drops a field is
 * the failure this avoids: the old block is deleted in 4b, so anything lost here
 * is lost for good.
 *
 * ── The one piece of data this improves rather than moves ────────────────────
 *
 * `matchingExercise.items[].englishTranslation` is a translation stored on an
 * exercise. It belongs on the term, and `matchPairs` reads it from there. Where a
 * term has no `meaning` and the exercise has the translation, it is written to
 * the term — which is the whole argument for the catalogue, applied once more.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { textToLexical, type PlainTextLexical } from "../../src/lib/content/textToLexical";

import { LIBRARY_BLOCK_SLUGS } from "../../src/payload/blocks/librarySlugs";

import { CONTENT_COLLECTIONS, type SnapshotDoc } from "./lib/snapshot";

const DIR = path.resolve("content/snapshot");
const QUARANTINE = path.resolve("content/quarantine.json");

const args = process.argv.slice(2);
const WRITE = args.includes("--yes");
const ONLY = args.includes("--lesson") ? args[args.indexOf("--lesson") + 1] : null;

type Block = Record<string, unknown>;
type Ref = { $ref: string; $collection: string };

const ref = (key: string): Ref => ({ $ref: key, $collection: "terms" });
const isRef = (v: unknown): v is Ref => Boolean(v) && typeof v === "object" && "$ref" in (v as object);

type Quarantined = {
  lesson: string;
  where: string;
  blockType: string;
  reason: string;
  block: Block;
};

// ── The term index ───────────────────────────────────────────────────────────
/*
 * `content/terms.json` is the reviewed derivation of the catalogue from the
 * strings that were embedded in these very blocks, and `mergedFrom` records
 * exactly which strings became which term. That is the mapping this transform
 * needs, so it is read rather than re-derived — re-running the fuzzy matcher here
 * would be a second, independently-drifting copy of a decision already reviewed.
 */
type DerivedTerm = {
  key: string;
  kind: string;
  japanese?: string;
  katakana?: string;
  meaning?: string;
  romaji?: string;
  mergedFrom?: string[];
};

/*
 * Two files hold terms and only one of them is the catalogue.
 *
 * `content/terms.json` is the one-time *derivation* from the legacy strings, and
 * its `mergedFrom` is the string → key mapping this transform reads.
 * `content/snapshot/terms.json` is the snapshot of the collection, and it is what
 * `content:import` actually writes to the database. So a change to a term has to
 * go into the snapshot; writing the derivation file would look like it worked and
 * change nothing. (It did, on the first version of this script.)
 */
const derived: DerivedTerm[] = JSON.parse(readFileSync(path.resolve("content/terms.json"), "utf8"));

const termSnapshot: SnapshotDoc[] = JSON.parse(
  readFileSync(path.join(DIR, "terms.json"), "utf8")
);

/** The snapshot states for a term key — latest, and the published one if it differs. */
function snapshotStatesFor(key: string): Array<Record<string, unknown>> {
  const entry = termSnapshot.find((t) => t.key === key);
  if (!entry) return [];
  return [entry.latest, entry.published].filter(
    (state): state is Record<string, unknown> => Boolean(state)
  );
}

/**
 * Move a value off an exercise and onto the term, when the term has none.
 *
 * This is the whole argument for the catalogue, applied once: audio and images
 * were attached to whichever *copy* of a word the author happened to be editing,
 * and `utils/termMedia.ts` then guessed at render time which copies meant the
 * same word. The new blocks read `term.audio`, so anything still sitting on an
 * exercise has to move now or it is lost when the old block is deleted in 4b.
 *
 * Never overwrites: a term that already has audio keeps it. Reported, so 30 terms
 * gaining audio is visible rather than implicit.
 */
function adopt(key: string, field: "audio" | "image" | "meaning", value: unknown): void {
  if (value === null || value === undefined || value === "") return;
  const states = snapshotStatesFor(key);
  if (!states.length) return;
  if (states[0][field]) return;
  for (const state of states) state[field] = structuredClone(value);
  adopted.push(`${key}.${field}`);
}

const adopted: string[] = [];

const normalise = (s: string) => s.trim().toLowerCase().replace(/[.,!?~\s]+/g, " ").trim();

const byString = new Map<string, DerivedTerm>();
for (const t of derived) {
  for (const source of t.mergedFrom ?? []) byString.set(normalise(source), t);
  byString.set(normalise(t.key), t);
  if (t.romaji) byString.set(normalise(t.romaji), t);
  if (t.japanese) byString.set(normalise(t.japanese), t);
}

/** The catalogue entry a legacy string refers to, or null. */
function lookup(value: unknown): DerivedTerm | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return byString.get(normalise(value)) ?? null;
}

/*
 * A kana card was written `"あ/ア"` and split on the slash in four places — the
 * delimiter *was* the schema. The catalogue holds the pair as `japanese` plus
 * `katakana`, so a card resolves by its hiragana half.
 */
function lookupKana(value: unknown): DerivedTerm | null {
  if (typeof value !== "string") return null;
  const [hiragana] = value.split("/").map((s) => s.trim());
  if (!hiragana) return null;
  return (
    derived.find((t) => t.kind === "kana" && t.japanese === hiragana) ?? lookup(hiragana)
  );
}

// ── Prose ────────────────────────────────────────────────────────────────────

const isDoc = (v: unknown): v is PlainTextLexical =>
  Boolean(v) && typeof v === "object" && "root" in (v as object);

/**
 * A prose value from the snapshot, which by now is already a Lexical document
 * (`content:upgrade-snapshot` ran in Phase 3). A string is still accepted so this
 * works on an older snapshot rather than silently producing nothing.
 */
function prose(value: unknown): PlainTextLexical | null {
  if (isDoc(value)) return value;
  if (typeof value === "string" && value.trim()) return textToLexical(value);
  return null;
}

/** Two prose values as one document — for the old `description` + `content` pair. */
function joinProse(...values: unknown[]): PlainTextLexical | null {
  const docs = values.map(prose).filter((d): d is PlainTextLexical => d !== null);
  if (!docs.length) return null;
  return {
    root: { ...docs[0].root, children: docs.flatMap((d) => d.root.children) },
  };
}

// ── The mapping ──────────────────────────────────────────────────────────────

type Context = {
  lesson: string;
  where: string;
  quarantine: (reason: string) => void;
  /** This block has no successor and should simply go away. */
  drop: () => void;
  /**
   * The words a checkpoint has introduced so far in this lesson, accumulated as
   * the blocks are walked in order. `listenAndChoose` is authored with these as
   * its distractors — the replacement for the render-time `checkpointPool`.
   */
  pool: Ref[];
};

/**
 * One old block → zero or more library blocks.
 *
 * Returning an empty array means "quarantined" — the context has already been
 * told why. Every `default` and every early return goes through it, so a shape
 * this does not handle cannot pass through as nothing.
 */
const DELETE: Block[] = [];

/*
 * The library's slugs, read from the collection config rather than listed here —
 * a hand-copied list is how the eleventh block would end up being quarantined by
 * a script that had never heard of it.
 */
const LIBRARY_SLUGS = new Set<string>(LIBRARY_BLOCK_SLUGS);

function convert(block: Block, ctx: Context): Block[] {
  const type = String(block.blockType);

  /*
   * Already a library block — a lesson migrated on an earlier run, which is the
   * normal state while the five move one at a time. Passed through untouched, so
   * the script is safe to re-run and safe to point at a lesson twice. Without
   * this the `default` case would quarantine the transform's own output.
   */
  if (LIBRARY_SLUGS.has(type)) return [block];

  switch (type) {
    // ── The four prose blocks, which differed only in their box ──────────────
    case "contentPage": {
      const content = joinProse(block.description, block.content);
      if (!content) {
        // The one in the corpus has a title and nothing else. A screen with a
        // heading and no body is not content; it is an authoring stub.
        ctx.quarantine("a text-only page with no body — only a title was ever set");
        return [];
      }
      return [{ blockType: "prose", tone: "page", title: block.title ?? null, content }];
    }
    case "infoBreak":
      return proseBlock(block, "card", ctx);
    case "lifeUsefulFact":
      return proseBlock(block, "lifeTip", ctx);
    case "factBreak": {
      const out = proseBlock(block, "fact", ctx, block.title);
      // `prompt` had no renderer on this block. Flagged rather than dropped.
      if (out.length && typeof block.prompt === "string" && block.prompt.trim()) {
        ctx.quarantine(`kept as prose, but its unrendered \`prompt\` is not carried: "${block.prompt}"`);
      }
      return out;
    }

    case "videoPage": {
      /*
       * Two shapes wearing one block type, which the field inventory only shows
       * once you count: 4 of the 20 rows have a video, 16 do not and carry a
       * two-speaker dialogue in `videoForm` instead. The plan said to drop that
       * field because nothing rendered it; `NewLessonPageItem.tsx:279` does, and
       * for those 16 it is the entire screen. So both halves are kept — a
       * `dialogue` block for the conversation, a `videoLesson` for the video, and
       * both when a row has both.
       */
      const dialogue = (Array.isArray(block.videoForm) ? block.videoForm : []) as string[];
      const lines = dialogue.filter((line) => typeof line === "string" && line.trim());
      const out: Block[] = [];

      if (lines.length) {
        out.push({
          blockType: "dialogue",
          title: block.video ? null : (block.title ?? null),
          /*
           * The old rendering coloured a line by index parity and had no names at
           * all, so "A" and "B" is exactly as much as the data actually says.
           * Naming them is an authoring job, and the field is required so it
           * cannot be silently left blank.
           */
          speakerA: "A",
          speakerB: "B",
          video: null,
          lines: lines.map((line, i) => ({
            speaker: i % 2 === 0 ? "a" : "b",
            japanese: textToLexical(line),
            romaji: null,
            english: null,
            audio: null,
          })),
        });
        // Not a failure, but the lines are worth a human read: several are the
        // literal string "[...]", which is a placeholder that reached the site.
        const placeholders = lines.filter((line) => /^\s*\[\.\.\.\]\s*$/.test(line));
        if (placeholders.length) {
          ctx.quarantine(
            `migrated to a dialogue, but ${placeholders.length} of its ${lines.length} line(s) are ` +
              'the literal placeholder "[...]" — the conversation is incomplete'
          );
        }
      }

      if (block.video) {
        out.push({
          blockType: "videoLesson",
          title: block.title ?? "Video",
          video: block.video,
          audio: block.audio ?? null,
          content: joinProse(block.description, block.content),
        });
      } else {
        // No video. Copy and audio would otherwise be dropped, and they are
        // different shapes: prose needs a body (`content` is required, and an
        // empty document fails validation), a bare clip is a figure.
        const copy = joinProse(block.description, block.content);
        if (copy) {
          out.push({
            blockType: "prose",
            tone: "page",
            title: lines.length ? null : (block.title ?? null),
            content: copy,
          });
        }
        if (block.audio) {
          out.push({
            blockType: "mediaFigure",
            image: null,
            audio: block.audio,
            video: null,
            caption: lines.length ? null : (block.title ?? null),
          });
        }
      }

      if (!out.length) {
        ctx.quarantine("a video page with no video, no dialogue and no copy — nothing to show");
        return [];
      }
      return out;
    }

    case "grammarPage": {
      const points = (Array.isArray(block.grammarPoints) ? block.grammarPoints : []) as Block[];
      if (!points.length) {
        ctx.quarantine("a grammar page with no points");
        return [];
      }
      return [
        {
          blockType: "grammarPoint",
          title: block.title ?? null,
          points: points.map((point) => ({
            pattern: point.pattern,
            /*
             * The old `examples` were a `text hasMany` — one sentence per entry,
             * no reading, no audio. They become `exampleSentence` blocks inside
             * the explanation, which is where they gain furigana and audio.
             */
            explanation: explanationFor(point),
          })),
        },
      ];
    }

    case "termsPage": {
      const rows = (Array.isArray(block.terms) ? block.terms : []) as Block[];
      const { refs, missing } = resolveTerms(rows.map((r) => r.term));
      if (missing.length) {
        ctx.quarantine(`terms not in the catalogue: ${missing.join(", ")}`);
        return [];
      }
      return [
        {
          blockType: "vocabList",
          title: block.title ?? null,
          intro: joinProse(block.description, block.content),
          terms: refs,
          // `format` was free text ("Flashcard", …) the renderer guessed at.
          layout: /flash/i.test(String(block.format ?? "")) ? "flashcards" : "list",
        },
      ];
    }

    case "flashcardDeck": {
      const cards = (Array.isArray(block.cards) ? block.cards : []) as Block[];
      const found = cards.map((c) => lookupKana(c.card));
      const missing = cards.filter((_, i) => !found[i]).map((c) => String(c.card));
      if (missing.length) {
        ctx.quarantine(`flashcards with no catalogue term: ${missing.join(", ")}`);
        return [];
      }
      return [
        {
          blockType: "vocabList",
          title: block.title ?? null,
          intro: null,
          terms: found.map((t) => ref(t!.key)),
          layout: "flashcards",
        },
      ];
    }

    // ── The media seed, whose only job the term now does ─────────────────────
    case "termMediaSeed": {
      const t = lookup(block.term);
      if (!t) {
        ctx.quarantine(`media seed for "${String(block.term)}", which is not in the catalogue`);
        return [];
      }
      // This block's entire purpose. Harvest it before deleting it.
      adopt(t.key, "audio", block.audio);
      adopt(t.key, "image", block.image);
      /*
       * Deleted, not converted, and not held either. This block existed *only* to
       * attach audio and an image to a word so the render-time expander could find
       * it — which is exactly what the term holds now. `derive-terms` moved that
       * media onto the term in Phase 2, so there is nothing left to carry.
       *
       * Counted as a deletion rather than a conversion so the report says 17 rows
       * went away on purpose, instead of leaving them looking like 17 failures.
       */
      ctx.drop();
      return DELETE;
    }

    // ── Practice ────────────────────────────────────────────────────────────
    /*
     * ── `matchingExercise` is a checkpoint, and this is where its pool goes ────
     *
     * It was never a pairing. `utils/expandLessonItems.ts:302` keys off it to
     * capture the terms introduced since the last checkpoint and then *generates*
     * the practice batches that follow it — which is why it has no
     * `englishTranslation` on its items and why the snapshot already holds 24
     * matchAudio and 24 pronunciation rows as real blocks: that expansion moved to
     * import time (decision #27).
     *
     * What the marker still carries is the grouping — which words this checkpoint
     * covers — and the plan's answer is an authored `distractors` relationship
     * instead of a pool derived at render. So the checkpoint contributes its terms
     * to `pool` and then goes away, and every `listenAndChoose` after it is
     * authored with those words as its wrong answers. That is what finally lets
     * the render-time expander be deleted in 4b.
     *
     * Cumulative, matching `buildCheckpointPool(cumulativeTerms)` in the expander:
     * a word from an earlier checkpoint stays available as a distractor.
     */
    case "matchingExercise": {
      const items = (Array.isArray(block.items) ? block.items : []) as Block[];
      const { refs, missing, resolved } = resolveTerms(items.map((i) => i.phrase));
      if (missing.length) {
        ctx.quarantine(`phrases not in the catalogue: ${missing.join(", ")}`);
        return [];
      }

      /*
       * The translation moves onto the term. It was stored on the exercise, which
       * is why the same word could have a different gloss in different lessons;
       * the catalogue is where it belongs. (Nothing in the current corpus has one,
       * so this adopts nothing today — it is here because the field exists and
       * dropping a populated one silently would be the failure this avoids.)
       */
      items.forEach((item, i) => {
        const gloss = item.englishTranslation;
        const t = resolved[i];
        if (t && typeof gloss === "string" && gloss.trim()) adopt(t.key, "meaning", gloss.trim());
      });

      for (const r of refs) {
        if (!ctx.pool.some((p) => p.$ref === r.$ref)) ctx.pool.push(r);
      }
      ctx.drop();
      return DELETE;
    }

    case "connectTheDots": {
      const items = (Array.isArray(block.items) ? block.items : []) as string[];
      const found = items.map(lookupKana);
      const missing = items.filter((_, i) => !found[i]);
      if (missing.length) {
        ctx.quarantine(`kana pairs with no catalogue term: ${missing.join(", ")}`);
        return [];
      }
      const withoutKatakana = found.filter((t) => !t?.katakana).map((t) => t?.key ?? "?");
      if (withoutKatakana.length) {
        ctx.quarantine(`pairs hiragana with katakana, but these terms have no katakana: ${withoutKatakana.join(", ")}`);
        return [];
      }
      return [
        {
          blockType: "matchPairs",
          instructions: block.prompt ?? "Match each hiragana to its katakana",
          terms: found.map((t) => ref(t!.key)),
          pairing: "kana",
        },
      ];
    }

    case "matchAudioExercise": {
      const t = lookup(block.phrase);
      if (!t) {
        ctx.quarantine(`"${String(block.phrase)}" is not in the catalogue`);
        return [];
      }
      // The clip and the picture were on the exercise. They belong to the word.
      adopt(t.key, "audio", block.audio);
      adopt(t.key, "image", block.image);
      return [
        {
          blockType: "listenAndChoose",
          instructions: null,
          term: ref(t.key),
          // Authored from the checkpoint that introduced these words, instead of
          // derived at render time from a fuzzy term-media registry.
          distractors: ctx.pool.filter((p) => p.$ref !== t.key),
          // The old block carried its own image for the answer tiles.
          answerWith: block.image ? "image" : "text",
        },
      ];
    }

    case "matchAudioLetter": {
      const items = (Array.isArray(block.items) ? block.items : []) as string[];
      const answers = (Array.isArray(block.correctAnswers) ? block.correctAnswers : []) as string[];
      if (answers.length !== 1) {
        ctx.quarantine(`${answers.length} correct answers — the player only ever handled one`);
        return [];
      }
      const correct = lookupKana(answers[0]);
      if (!correct) {
        ctx.quarantine(`the answer "${answers[0]}" is not in the catalogue`);
        return [];
      }
      const distractors = items
        .filter((i) => i !== answers[0])
        .map(lookupKana)
        .filter((t): t is DerivedTerm => t !== null);
      return [
        {
          blockType: "listenAndChoose",
          instructions: block.prompt ?? null,
          term: ref(correct.key),
          distractors: distractors.map((t) => ref(t.key)),
          answerWith: "text",
        },
      ];
    }

    case "dragAndDropPuzzle": {
      const t = lookup(block.term);
      if (t) {
        adopt(t.key, "audio", block.audio);
        adopt(t.key, "image", block.image);
      }
      const tiles = (Array.isArray(block.options) ? block.options : []) as string[];
      const sequence = (Array.isArray(block.correctSequence) ? block.correctSequence : []) as string[];
      const absent = sequence.filter((s) => !tiles.includes(s));
      if (absent.length) {
        ctx.quarantine(`correctSequence has tiles that are not in \`options\`: ${absent.join(", ")}`);
        return [];
      }
      return [
        {
          blockType: "buildSentence",
          instructions: null,
          term: t ? ref(t.key) : null,
          tiles,
          correctSequence: sequence,
          tileScript: "asAuthored",
        },
      ];
    }

    case "vocabularyDragDrop": {
      const tiles = (Array.isArray(block.characterBank) ? block.characterBank : []) as string[];
      const answer = String(block.correctAnswer ?? "");
      /*
       * `correctAnswer` is the assembled word as one string and the tiles are its
       * characters, so the sequence has to be recovered by matching tiles against
       * it left to right. A character the pool does not contain means the two
       * fields disagree — which nothing checked before.
       */
      const sequence = splitIntoTiles(answer, tiles);
      if (!sequence) {
        ctx.quarantine(`"${answer}" cannot be assembled from its own tiles: ${JSON.stringify(tiles)}`);
        return [];
      }
      return [
        {
          blockType: "buildSentence",
          instructions: block.prompt ?? null,
          term: lookup(answer) ? ref(lookup(answer)!.key) : null,
          tiles,
          correctSequence: sequence,
          // The `bonus` batch is the one that was converted to romaji at render
          // time, on a code path chosen by this flag. Now it is stated.
          tileScript: block.bonus === true ? "romaji" : "asAuthored",
        },
      ];
    }

    case "pronunciationExercise": {
      const t = lookup(block.phrase);
      if (!t) {
        ctx.quarantine(`"${String(block.phrase)}" is not in the catalogue`);
        return [];
      }
      adopt(t.key, "audio", block.audio);
      if (!block.audio) {
        /*
         * Migrated anyway, and reported. 13 of the 24 have no reference audio, so
         * they cannot have been scoring anything under the old block either — the
         * gap is editorial, not structural, and holding them back would only mean
         * 13 screens stayed on a block type that is about to be deleted.
         * `content:verify` reports it as a to-do against the term.
         */
        ctx.quarantine(
          `migrated, but "${String(block.phrase)}" has no reference audio — the scorer has ` +
            "nothing to grade a recording against until the term gets a recording"
        );
      }
      return [
        {
          blockType: "speakAndScore",
          instructions: null,
          term: ref(t.key),
          transcript: block.transcript ?? null,
          video: block.video ?? null,
        },
      ];
    }

    case "legacyJson":
      ctx.quarantine("unmigrated content — it has never rendered anything");
      return [];

    default:
      ctx.quarantine(`no mapping for this block type`);
      return [];
  }
}

function proseBlock(block: Block, tone: string, ctx: Context, title?: unknown): Block[] {
  const content = prose(block.content);
  if (!content) {
    ctx.quarantine("prose with no body");
    return [];
  }
  return [{ blockType: "prose", tone, title: title ?? null, content }];
}

/** A point's explanation, with its old flat examples as `exampleSentence` blocks. */
function explanationFor(point: Block): PlainTextLexical {
  const examples = (Array.isArray(point.examples) ? point.examples : []) as string[];
  const base = prose(point.explanation) ?? textToLexical("");

  const blocks = examples
    .filter((e) => typeof e === "string" && e.trim())
    .map((sentence, i) => ({
      type: "block",
      version: 2,
      format: "",
      fields: {
        id: `ex${i}`,
        blockName: "",
        blockType: "exampleSentence",
        japanese: textToLexical(sentence),
        romaji: null,
        english: null,
        audio: null,
      },
    }));

  return {
    root: { ...base.root, children: [...base.root.children, ...(blocks as never[])] },
  };
}

function resolveTerms(values: unknown[]): {
  refs: Ref[];
  missing: string[];
  resolved: Array<DerivedTerm | null>;
} {
  const resolved = values.map(lookup);
  return {
    resolved,
    refs: resolved.filter((t): t is DerivedTerm => t !== null).map((t) => ref(t.key)),
    missing: values.filter((_, i) => !resolved[i]).map((v) => String(v)),
  };
}

/** Greedily split an assembled answer into tiles from its own pool. */
function splitIntoTiles(answer: string, tiles: string[]): string[] | null {
  const pool = [...tiles].sort((a, b) => b.length - a.length);
  const out: string[] = [];
  let rest = answer;
  while (rest.length) {
    const tile = pool.find((t) => t.length > 0 && rest.startsWith(t));
    if (!tile) return null;
    out.push(tile);
    rest = rest.slice(tile.length);
  }
  return out.length ? out : null;
}

// ── Run ──────────────────────────────────────────────────────────────────────

function main() {
  const lessons: SnapshotDoc[] = JSON.parse(readFileSync(path.join(DIR, "lessons.json"), "utf8"));
  const quarantine: Quarantined[] = [];
  let converted = 0;
  let produced = 0;
  const perType = new Map<string, { in: number; out: number; held: number; dropped: number }>();
  let drops = 0;
  let emptyExercises = 0;

  console.log(`\n${WRITE ? "Migrating" : "Dry run —"} old blocks → the library${ONLY ? ` (lesson ${ONLY})` : ""}\n`);

  for (const doc of lessons) {
    if (ONLY && doc.key !== ONLY) continue;

    for (const state of [doc.latest, doc.published]) {
      if (!state) continue;
      const exercises = (Array.isArray(state.exercises) ? state.exercises : []) as Block[];
      // Per lesson state, in play order: a checkpoint adds to it, the practice
      // after it reads from it.
      const pool: Ref[] = [];

      exercises.forEach((exercise, ei) => {
        const blocks = (Array.isArray(exercise.components) ? exercise.components : []) as Block[];
        const next: Block[] = [];

        blocks.forEach((block, bi) => {
          const type = String(block.blockType);
          const stat = perType.get(type) ?? { in: 0, out: 0, held: 0, dropped: 0 };
          stat.in++;

          let held = false;
          let dropped = false;
          const ctx: Context = {
            lesson: doc.key,
            where: `exercise[${ei}].components[${bi}]`,
            pool,
            drop: () => {
              dropped = true;
            },
            quarantine: (reason) => {
              held = true;
              quarantine.push({
                lesson: doc.key,
                where: `exercise[${ei}].components[${bi}]`,
                blockType: type,
                reason,
                block: structuredClone(block),
              });
            },
          };

          const result = convert(block, ctx);
          /*
           * Three outcomes, and conflating any two of them hides something:
           * converted (its successors replace it), dropped (its job is done and it
           * has no successor), or held (it could not be mapped, so the *old* block
           * stays in the snapshot and the reason goes to quarantine.json).
           *
           * A block can be converted *and* flagged — a videoPage with both a video
           * and a dialogue migrates, and the dialogue is reported as not carried.
           */
          if (result.length) {
            stat.out += result.length;
            next.push(...result);
            converted++;
            produced += result.length;
          } else if (dropped) {
            stat.dropped++;
            drops++;
          } else {
            stat.held++;
            next.push(block);
          }
          perType.set(type, stat);
        });

        exercise.components = next;
      });

      /*
       * An exercise whose every block was deleted has nothing left to render, and
       * `components` has `minRows: 1` so Payload refuses it outright. A screen
       * that was only ever a checkpoint marker is exactly that case: the marker's
       * job is now the `distractors` on the practice blocks, so the empty screen
       * goes with it rather than being imported as an invalid row.
       */
      const kept = exercises.filter((exercise) => {
        const components = Array.isArray(exercise.components) ? exercise.components : [];
        if (components.length) return true;
        emptyExercises++;
        return false;
      });
      if (kept.length !== exercises.length) state.exercises = kept;
    }
  }

  const width = 24;
  console.log("  block type".padEnd(width + 2) + "  in  out  gone  held");
  for (const [type, stat] of [...perType.entries()].sort((a, b) => b[1].in - a[1].in)) {
    console.log(
      `  ${type.padEnd(width)} ${String(stat.in).padStart(4)} ${String(stat.out).padStart(4)} ` +
        `${String(stat.dropped).padStart(5)} ${String(stat.held).padStart(5)}`
    );
  }
  console.log(
    `\n  ${converted} block(s) converted into ${produced}, ${drops} deleted on purpose, ` +
      `${quarantine.length} flagged`
  );
  if (emptyExercises) {
    console.log(
      `  ${emptyExercises} exercise(s) removed — every block in them was deleted, and an exercise ` +
        "with no components is not a screen"
    );
  }

  if (adopted.length) {
    console.log(
      `\n  ${adopted.length} value(s) moved off an exercise and onto the term they belong to:`
    );
    for (const a of adopted.slice(0, 12)) console.log(`    ${a}`);
    if (adopted.length > 12) console.log(`    … and ${adopted.length - 12} more`);
  }

  if (quarantine.length) {
    console.log(`\n  Flagged for review — not converted unless noted:`);
    const grouped = new Map<string, Quarantined[]>();
    for (const q of quarantine) {
      const list = grouped.get(`${q.blockType}: ${q.reason}`) ?? [];
      list.push(q);
      grouped.set(`${q.blockType}: ${q.reason}`, list);
    }
    for (const [reason, list] of grouped) {
      console.log(`    ×${String(list.length).padStart(3)}  ${reason}`);
    }
  }

  if (!WRITE) {
    console.log(`\nDry run — nothing written. Re-run with --yes.\n`);
    return;
  }

  writeFileSync(path.join(DIR, "lessons.json"), `${JSON.stringify(lessons, null, 2)}\n`);

  // The catalogue gains the media and glosses that were living on exercises.
  writeFileSync(path.join(DIR, "terms.json"), `${JSON.stringify(termSnapshot, null, 2)}\n`);

  const existing = (() => {
    try {
      return JSON.parse(readFileSync(QUARANTINE, "utf8")) as unknown[];
    } catch {
      return [];
    }
  })();
  writeFileSync(
    QUARANTINE,
    `${JSON.stringify([...(Array.isArray(existing) ? existing : []), ...quarantine], null, 2)}\n`
  );

  console.log(
    `\n✓ written. Next: \`npm run content:import -- --yes\` then \`npm run content:verify\`.\n` +
      `  ${quarantine.length} block(s) appended to content/quarantine.json — those are still the old\n` +
      `  block type in the snapshot, and stay that way until they are reviewed.\n`
  );
}

// Guard: the snapshot's collections are read by name above; if that list ever
// stops containing lessons this script is silently doing nothing.
if (!CONTENT_COLLECTIONS.includes("lessons")) throw new Error("lessons is not a snapshot collection");

main();
