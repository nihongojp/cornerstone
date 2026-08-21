/*
 * The one naming rule this codebase actually had to invent: everything else
 * in CONTEXT.md's Routing section is "follow Next.js's/Payload's own docs."
 * Uniqueness is already each field's own `unique: true` — this only adds the
 * shape check, the same way `Terms.japanese` validates its own field inline
 * rather than through a collection hook.
 */
const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function validateSlugFormat(value: unknown): true | string {
  if (typeof value !== "string" || !value.trim()) return true;
  return KEBAB_CASE.test(value) || "Lowercase letters, numbers and hyphens only, e.g. \"grammar-l1-v1\".";
}
