import assert from "node:assert/strict";
import test from "node:test";

import { hasAdminRole } from "./isAdmin";

/*
 * The predicate behind every delete gate in the CMS.
 *
 * It is tested because its inputs are looser than they look. `req.user` is
 * `null` for anonymous requests and for every learner (they are better-auth
 * accounts, which Payload knows nothing about), `roles` is absent on any row
 * written before the field existed, and Payload hands back a plain array of
 * strings rather than anything typed. A truthiness check over any of those
 * reads as "admin" — so the negative cases are the point of this file, not
 * padding around the positive one.
 */

test("a user holding the admin role passes", () => {
  assert.equal(hasAdminRole({ roles: ["admin"] }), true);
  assert.equal(hasAdminRole({ roles: ["editor", "admin"] }), true);
});

test("an editor does not pass", () => {
  assert.equal(hasAdminRole({ roles: ["editor"] }), false);
});

test("an empty or absent roles array does not pass", () => {
  // A row written before the field existed. The migration backfills these, but
  // the predicate must not depend on the migration having run.
  assert.equal(hasAdminRole({ roles: [] }), false);
  assert.equal(hasAdminRole({}), false);
  assert.equal(hasAdminRole({ roles: null }), false);
});

test("no user at all does not pass", () => {
  // Anonymous requests, and every learner request: Payload's `req.user` is the
  // CMS identity, and a learner never has one.
  assert.equal(hasAdminRole(null), false);
  assert.equal(hasAdminRole(undefined), false);
});

test("a non-array roles value does not pass", () => {
  // Guards the shape rather than trusting it: `roles: "admin"` is the obvious
  // way for this to arrive wrong, and `includes` on a string would match.
  assert.equal(hasAdminRole({ roles: "admin" }), false);
  assert.equal(hasAdminRole({ roles: { admin: true } }), false);
});
