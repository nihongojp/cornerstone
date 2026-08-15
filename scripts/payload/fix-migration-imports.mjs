#!/usr/bin/env node
/*
 * Rewrites Payload's generated migration files so Node can load them.
 *
 * Payload emits:
 *
 *     import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'
 *
 * `MigrateUpArgs` and `MigrateDownArgs` are types. Node's native TypeScript
 * support strips annotations without type-checking, so it cannot tell that a
 * named import is type-only — it emits a real ESM import for all three names
 * and the module fails to load:
 *
 *     SyntaxError: ... does not provide an export named 'MigrateDownArgs'
 *
 * On Node 22 this was behind --experimental-strip-types. This project is on
 * Node 24, where stripping is on by default, so `payload migrate` fails on the
 * default path — locally and on Vercel. (Disabling stripping does not help:
 * Payload's bundled tsx then throws ERR_UNKNOWN_FILE_EXTENSION.)
 *
 * The fix is `import type` for the type-only names, which the stripper removes
 * outright. This script applies it. Run it after every `payload migrate:create`
 * — `npm run payload:migrate:create` chains it — and `--check` in CI to prove
 * no unfixed file slipped in.
 *
 * Usage:
 *   node scripts/payload/fix-migration-imports.mjs [--check]
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, "../../src/payload/migrations");

/** Names exported by the adapter that exist only in the type system. */
const TYPE_ONLY = new Set(["MigrateUpArgs", "MigrateDownArgs"]);

/** `import { a, b } from '<pkg>'` — the single-line form Payload generates. */
const IMPORT_RE =
  /^import\s+\{([^}]*)\}\s+from\s+(['"])(@payloadcms\/[^'"]+|payload)\2;?[ \t]*$/gm;

/**
 * Splits any value import of `@payloadcms/*` into a type-only import and a
 * value import, dropping either half when it would be empty. Already-correct
 * files are left byte-identical, so this is safe to run repeatedly.
 */
export function fixSource(source) {
  return source.replace(IMPORT_RE, (whole, specifiers, quote, pkg) => {
    const names = specifiers
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // `import type { ... }` never matches here (the regex requires no `type`
    // keyword), but a mixed `import { type Foo, bar }` would — leave it alone.
    if (names.some((n) => n.startsWith("type "))) return whole;

    const types = names.filter((n) => TYPE_ONLY.has(n));
    const values = names.filter((n) => !TYPE_ONLY.has(n));
    if (types.length === 0) return whole;

    const lines = [`import type { ${types.join(", ")} } from ${quote}${pkg}${quote}`];
    if (values.length > 0) {
      lines.push(`import { ${values.join(", ")} } from ${quote}${pkg}${quote}`);
    }
    return lines.join("\n");
  });
}

async function main() {
  const check = process.argv.includes("--check");

  let entries;
  try {
    entries = await readdir(MIGRATIONS_DIR);
  } catch (err) {
    if (err.code === "ENOENT") {
      console.log(`no migrations directory at ${MIGRATIONS_DIR} — nothing to do`);
      return;
    }
    throw err;
  }

  const files = entries.filter((f) => f.endsWith(".ts")).sort();
  const changed = [];

  for (const file of files) {
    const full = path.join(MIGRATIONS_DIR, file);
    const before = await readFile(full, "utf8");
    const after = fixSource(before);
    if (after === before) continue;
    changed.push(file);
    if (!check) await writeFile(full, after);
  }

  if (check && changed.length > 0) {
    console.error(
      `✗ ${changed.length} migration file(s) still use a value import for ` +
        `MigrateUpArgs/MigrateDownArgs and will not load under Node 24:\n` +
        changed.map((f) => `    ${f}`).join("\n") +
        `\n\nRun: npm run payload:fix-migrations\n`
    );
    process.exit(1);
  }

  console.log(
    changed.length === 0
      ? `✓ ${files.length} migration file(s) already load-safe`
      : `✓ rewrote ${changed.length} of ${files.length} migration file(s) to \`import type\``
  );
}

await main();
