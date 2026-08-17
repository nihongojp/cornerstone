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
 * Doubles as the "which lessons are incomplete" report — the placeholder and
 * empty-slot counts are editorial to-dos, reported but not failures.
 */

config({ path: ".env.local" });

import { LESSON_DEPTH, MEDIA_POPULATE } from "../../src/lib/content/depth";

type Problem = { lesson: string; where: string; detail: string };

const PLACEHOLDER = /placeholder/i;

/** Media fields as `payload/fields/media.ts` names them. */
const MEDIA_FIELDS = ["image", "audio", "video"] as const;

async function main() {
  const { getPayload } = await import("payload");
  const { default: configPromise } = await import("../../src/payload.config");
  const payload = await getPayload({ config: configPromise });

  const { docs: lessons } = await payload.find({
    collection: "lessons",
    where: { _status: { equals: "published" } },
    depth: LESSON_DEPTH,
    populate: MEDIA_POPULATE,
    limit: 0,
    pagination: false,
    overrideAccess: true,
  });

  const failures: Problem[] = [];
  const todos: Problem[] = [];
  let resolved = 0;
  let empty = 0;

  for (const lesson of lessons) {
    const slug = String(lesson.slug);
    const exercises = Array.isArray(lesson.exercises) ? lesson.exercises : [];

    exercises.forEach((exercise, index) => {
      const components = Array.isArray(exercise?.components) ? exercise.components : [];

      const walk = (node: unknown, path: string): void => {
        if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${path}[${i}]`));
        if (!node || typeof node !== "object") return;

        for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
          const here = `${path}.${key}`;

          if ((MEDIA_FIELDS as readonly string[]).includes(key) && value !== null && value !== undefined) {
            /*
             * A number here means the relationship did not populate. That is
             * the depth bug, and it is invisible from the app — `mediaSrc`
             * returns undefined and the page renders without the asset.
             */
            if (typeof value === "number" || typeof value === "string") {
              failures.push({
                lesson: slug,
                where: here,
                detail: `unpopulated upload (got a bare id: ${value}). Read depth is ${LESSON_DEPTH}; it is not enough.`,
              });
            } else {
              const media = value as { url?: string | null; filename?: string | null };
              if (!media.url) {
                failures.push({
                  lesson: slug,
                  where: here,
                  detail: `media "${media.filename ?? "?"}" populated but has no url`,
                });
              } else {
                resolved++;
              }
            }
            continue;
          }

          if (typeof value === "string" && PLACEHOLDER.test(value)) {
            todos.push({ lesson: slug, where: here, detail: `placeholder copy: "${value}"` });
          }

          if (value && typeof value === "object") walk(value, here);
        }
      };

      components.forEach((block: unknown, b: number) => {
        const blockType = String((block as { blockType?: string })?.blockType ?? "?");
        if (blockType === "legacyJson") {
          todos.push({
            lesson: slug,
            where: `exercise[${index}].components[${b}]`,
            detail: "legacyJson block — has never rendered; re-author or delete it",
          });
        }
        walk(block, `exercise[${index}].components[${b}]:${blockType}`);
      });
    });
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

  console.log(`\nVerifying ${lessons.length} published lesson(s)\n`);
  console.log(`  media relationships resolved: ${resolved}`);
  console.log(`  media slots left empty:       ${empty}`);

  if (todos.length) {
    console.log(`\n  ${todos.length} editorial to-do(s) — not failures:`);
    for (const t of todos.slice(0, 15)) console.log(`    ${t.lesson}  ${t.where}\n      ${t.detail}`);
    if (todos.length > 15) console.log(`    … and ${todos.length - 15} more`);
  }

  if (failures.length) {
    console.error(`\n✗ ${failures.length} structural failure(s):\n`);
    for (const f of failures.slice(0, 20)) console.error(`    ${f.lesson}  ${f.where}\n      ${f.detail}`);
    if (failures.length > 20) console.error(`    … and ${failures.length - 20} more`);
    console.error();
    process.exit(1);
  }

  console.log("\n✓ every media relationship resolves\n");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
