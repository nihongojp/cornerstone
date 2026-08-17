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

const derived: DerivedTerm[] = JSON.parse(readFileSync(path.resolve("content/terms.json"), "utf8"));

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
};

/**
 * One old block → zero or more library blocks.
 *
 * Returning an empty array means "quarantined" — the context has already been
 * told why. Every `default` and every early return goes through it, so a shape
 * this does not handle cannot pass through as nothing.
 */
const DELETE: Block[] = [];

function convert(block: Block, ctx: Context): Block[] {
  const type = String(block.blockType);

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
      const dialogue = (Array.isArray(block.videoForm) ? block.videoForm : []) as string[];

      if (!block.video) {
        /*
         * 16 of the 20 pages of this type have no video, and their entire content
         * is `videoForm` — a two-speaker dialogue, alternating lines.
         *
         * The plan said to drop `videoForm` because "nothing renders off it", and
         * the block's own field description said the same. Both were wrong:
         * `NewLessonPageItem.tsx:279` branches on it and lays the lines out as a
         * conversation. Converting these to `videoLesson` and dropping the field
         * would delete the content of 16 screens.
         *
         * There is no block in the library for a dialogue, and inventing an
         * eleventh one is a design decision rather than a transform, so these are
         * held. See the note in the report.
         */
        ctx.quarantine(
          dialogue.length
            ? `not a video page at all — no video, and its content is a ${dialogue.length}-line ` +
              `dialogue in \`videoForm\`, which DOES render. Needs a dialogue block, or the lines ` +
              `re-authored as prose: ${JSON.stringify(dialogue)}`
            : "a video page with neither a video nor a dialogue — nothing to show"
        );
        return [];
      }
      if (dialogue.length) {
        ctx.quarantine(
          `kept as videoLesson, but its ${dialogue.length}-line dialogue in \`videoForm\` has no ` +
            `home in the library and is not carried: ${JSON.stringify(dialogue)}`
        );
      }
      return [
        {
          blockType: "videoLesson",
          title: block.title ?? "Video",
          video: block.video,
          audio: block.audio ?? null,
          content: joinProse(block.description, block.content),
        },
      ];
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
     * ── `matchingExercise` is not a matching exercise ─────────────────────────
     *
     * It is a *checkpoint marker*. `utils/expandLessonItems.ts:302` keys off it to
     * capture the terms introduced since the last checkpoint and then *generates*
     * the matchAudio, pronunciation and drag-and-drop batches that follow it. That
     * expansion moved to import time (decision #27), which is why the snapshot
     * already holds 24 matchAudioExercise and 24 pronunciationExercise blocks as
     * real rows — the generated children are already there.
     *
     * So a checkpoint has no `englishTranslation` on its items and never did: it
     * was never rendered as a pairing. Mapping it to `matchPairs` would invent an
     * exercise, and dropping it would lose the authored grouping that says which
     * words belong to which checkpoint — which is what the plan turns into an
     * authored `distractors` relationship on the practice blocks.
     *
     * That is a cross-block transform and an authoring decision, not a 1:1 map,
     * so these are held.
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
       * is why the same word had a different gloss in different lessons; the
       * catalogue is where it belongs, and `matchPairs` reads it from there.
       */
      items.forEach((item, i) => {
        const gloss = item.englishTranslation;
        const t = resolved[i];
        if (t && !t.meaning && typeof gloss === "string" && gloss.trim()) {
          t.meaning = gloss.trim();
          glossesAdopted.push(`${t.key} ← "${gloss.trim()}"`);
        }
      });

      ctx.quarantine(
        `a checkpoint marker over ${refs.length} term(s) (${resolved.map((t) => t?.key).join(", ")}), ` +
          "not a pairing — the practice it used to generate is already in the data as separate " +
          "blocks. Decide whether these terms become an authored matchPairs, or the distractor " +
          "pool for the practice blocks that follow it."
      );
      return [];
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
      return [
        {
          blockType: "listenAndChoose",
          instructions: null,
          term: ref(t.key),
          distractors: [],
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
      if (!block.audio) {
        ctx.quarantine(
          `"${String(block.phrase)}" has no reference audio — there is nothing to score against`
        );
        return [];
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

const glossesAdopted: string[] = [];

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

  console.log(`\n${WRITE ? "Migrating" : "Dry run —"} old blocks → the library${ONLY ? ` (lesson ${ONLY})` : ""}\n`);

  for (const doc of lessons) {
    if (ONLY && doc.key !== ONLY) continue;

    for (const state of [doc.latest, doc.published]) {
      if (!state) continue;
      const exercises = (Array.isArray(state.exercises) ? state.exercises : []) as Block[];

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

  if (glossesAdopted.length) {
    console.log(`\n  ${glossesAdopted.length} English gloss(es) moved from an exercise onto the term:`);
    for (const g of glossesAdopted.slice(0, 10)) console.log(`    ${g}`);
    if (glossesAdopted.length > 10) console.log(`    … and ${glossesAdopted.length - 10} more`);
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

  // The catalogue gains the glosses that were living on exercises.
  writeFileSync(path.resolve("content/terms.json"), `${JSON.stringify(derived, null, 2)}\n`);

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
