/*
 * The stroke-order screens, from generated to authored.
 *
 *   npm run content:author-spotlights          # dry run: a report
 *   npm run content:author-spotlights -- --yes
 *
 * Then `npm run content:import -- --yes` and `npm run content:verify`.
 *
 * ── What this moves ─────────────────────────────────────────────────────────
 *
 * `LessonPlayer` built a screen per character by walking the lesson's flashcard
 * strings and looking each one up in `src/data/kanaStrokeOrder.ts`, a hardcoded
 * table of ten media URLs. Those screens were in no lesson: an author could not
 * see them, reorder them or remove them, and they had no Payload row id — which
 * is what Phase 4b keys learner progress on, so they could not have one.
 *
 * The catalogue already carries the same data (`strokes` and `strokeOrder` on a
 * kana term, seeded from that very table by `derive-terms`). So each generated
 * screen becomes a real step holding `vocabList` with `layout: "spotlight"`,
 * inserted immediately before the flashcard deck it used to precede — the order
 * the learner already sees. Then the table is deleted.
 *
 * One-shot: it will not insert a spotlight for a term that already has one, so
 * re-running it is safe and a second run reports nothing to do.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { SnapshotDoc } from "./lib/snapshot";

const DIR = path.resolve("content/snapshot");
const WRITE = process.argv.slice(2).includes("--yes");

type Block = Record<string, unknown>;
type Step = { id?: string; label?: string | null; components?: Block[] };
type Ref = { $ref: string; $collection: string };

const isRef = (v: unknown): v is Ref =>
  Boolean(v) && typeof v === "object" && "$ref" in (v as object);

/*
 * References travel as natural keys in the snapshot (Phase 0b), so a term is a
 * `{$ref: key}` here rather than a numeric id — which is exactly why the new
 * steps can be written as plain JSON and imported without knowing what row
 * ids the database will assign.
 */
const termSnapshot: SnapshotDoc[] = JSON.parse(
  readFileSync(path.join(DIR, "terms.json"), "utf8")
);

/** Whether a term is a character with a stroke-order diagram to spotlight. */
function hasStrokeOrder(key: string): boolean {
  const entry = termSnapshot.find((t) => t.key === key);
  const state = entry?.latest as Record<string, unknown> | undefined;
  return Boolean(state && state.kind === "kana" && state.strokeOrder);
}

function spotlightStep(termRef: Ref, character: string): Step {
  return {
    // No `id`: Payload assigns the row id on import, and that id is what
    // progress is keyed on from 4b onward.
    label: `Spotlight ${character}`,
    components: [
      {
        blockType: "vocabList",
        title: null,
        intro: null,
        terms: [termRef],
        layout: "spotlight",
      },
    ],
  };
}

function main() {
  const lessons: SnapshotDoc[] = JSON.parse(
    readFileSync(path.join(DIR, "lessons.json"), "utf8")
  );

  let inserted = 0;
  let skippedNoDiagram = 0;
  const report: string[] = [];

  for (const doc of lessons) {
    for (const state of [doc.latest, doc.published]) {
      if (!state) continue;
      const steps = (Array.isArray(state.steps) ? state.steps : []) as Step[];

      // Which characters already have a spotlight, so a second run is a no-op.
      const already = new Set<string>();
      for (const step of steps) {
        for (const block of step.components ?? []) {
          if (block.blockType !== "vocabList" || block.layout !== "spotlight") continue;
          for (const term of (block.terms as unknown[]) ?? []) {
            if (isRef(term)) already.add(term.$ref);
          }
        }
      }

      const next: Step[] = [];

      for (const step of steps) {
        const deck = (step.components ?? []).find(
          (block) => block.blockType === "vocabList" && block.layout === "flashcards"
        );

        if (deck) {
          for (const term of (deck.terms as unknown[]) ?? []) {
            if (!isRef(term) || already.has(term.$ref)) continue;
            if (!hasStrokeOrder(term.$ref)) {
              // Only kana carry a diagram. A vocabulary deck is not a set of
              // characters to spotlight, and generating a screen showing a word
              // at 9rem with no picture is not the same content.
              skippedNoDiagram++;
              continue;
            }
            already.add(term.$ref);
            next.push(spotlightStep(term, term.$ref));
            inserted++;
            report.push(`${doc.key}: spotlight ${term.$ref} before "${step.label ?? "deck"}"`);
          }
        }

        next.push(step);
      }

      state.steps = next;
    }
  }

  console.log(`\n${WRITE ? "Authoring" : "Dry run —"} the stroke-order screens\n`);
  for (const line of report) console.log(`  ${line}`);
  console.log(
    `\n  ${inserted} spotlight step(s) inserted; ` +
      `${skippedNoDiagram} deck term(s) skipped — no stroke-order diagram, so nothing to spotlight.`
  );

  if (!inserted) {
    console.log(
      "\n  Nothing to do. Either this has already run, or no flashcard deck holds a kana term\n" +
        "  with a stroke-order diagram.\n"
    );
    return;
  }

  if (!WRITE) {
    console.log(`\nDry run — nothing written. Re-run with --yes.\n`);
    return;
  }

  writeFileSync(path.join(DIR, "lessons.json"), `${JSON.stringify(lessons, null, 2)}\n`);
  console.log(
    `\n✓ written. Next: \`npm run content:import -- --yes\` then \`npm run content:verify\`.\n`
  );
}

main();
