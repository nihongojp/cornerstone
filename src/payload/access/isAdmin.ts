import type { Access } from "payload";

/*
 * Role gating for the destructive operations.
 *
 * ── What this closes ────────────────────────────────────────────────────────
 *
 * Every collection declared `read` and nothing else. In Payload an undeclared
 * operation defaults to "any authenticated user", and the authenticated users
 * here are `cms_admins` — so every editor could delete every lesson, every
 * course, the whole media library, and each other. Nothing in the admin UI
 * suggested otherwise; the Delete button was simply there for everyone.
 *
 * `read` stays as it was on each collection. This is only about who can
 * destroy things, plus who can hand out the power to do so.
 *
 * ── Why `cms_admins` locks down further than the rest ───────────────────────
 *
 * Gating delete on a role is theatre if the role itself is editable by the
 * people it restrains: an editor who can update `cms_admins` can add "admin" to
 * their own row and then delete whatever they like. So create, update *and*
 * delete are admin-only on that collection, while the content collections gate
 * delete alone. Editors keep every ordinary authoring power — create, edit and
 * publish across all of the content — and lose only the irreversible one.
 *
 * ── The failure mode to know about ──────────────────────────────────────────
 *
 * If no row holds "admin", nobody can delete anything and nobody can grant the
 * role either, because granting it needs update on `cms_admins`. That is a
 * locked door with the key inside, recoverable only by SQL. It is why the
 * migration that adds the field backfills every existing account as an admin
 * rather than leaning on the field's default — see the Phase 5 migration.
 */

/*
 * Structural rather than typed against `CmsAdmin` on purpose: this also runs
 * against `req.user` on requests Payload has not populated a full user for, and
 * a `roles` array that is absent, null or empty must read as "not an admin"
 * rather than throw. Exported so the four-line truth table can be tested
 * without standing up a Payload request.
 */
export function hasAdminRole(user: unknown): boolean {
  const roles = (user as { roles?: unknown } | null | undefined)?.roles;
  return Array.isArray(roles) && roles.includes("admin");
}

export const isAdmin: Access = ({ req }) => hasAdminRole(req.user);
