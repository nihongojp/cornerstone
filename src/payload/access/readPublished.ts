import type { Access } from "payload";

/*
 * Read access for the content collections: everything to a signed-in CMS user,
 * published documents only to everyone else.
 *
 * The three content collections used to declare `read: () => true`, which is
 * not "public read" — it is *no filter at all*. Payload's REST API is mounted
 * publicly at /api/<collection>, and with `versions.drafts` on, the collection
 * table holds the latest saved state of every document, draft included. So an
 * unauthenticated `GET /api/lessons` returned unpublished lessons outright, and
 * `?draft=true` additionally routed the query through `queryDrafts`. The app
 * itself never saw them because `lib/content/content.ts` ANDs in
 * `_status: published` on every read — but that made the app's own query the
 * only thing standing between a draft and the internet.
 *
 * Returning a `Where` instead of a boolean is how Payload expresses "some of
 * them": the constraint is merged into the query before it runs, on both the
 * published and the drafts path, so it cannot be bypassed with a query
 * parameter. The explicit filters in `content.ts` are now redundant rather than
 * load-bearing, and are kept — the same rule stated in both places is cheap,
 * and neither should be the only one.
 *
 * `req.user` is a `cms_admins` user, not a learner: this is the CMS identity,
 * which is why the draft readers in `content.ts` pass the authenticated editor
 * through as `user` rather than switching `overrideAccess` off.
 *
 * This `Where` also applies to Payload's default `findByID`, so
 * `GET /api/lessons/<numeric-id>` is reachable alongside the slug-based
 * lookups the app itself uses — intentionally left open rather than closed
 * with bespoke access logic. The filter is on publish status, not on lookup
 * key, so an id-based request can't reach anything a slug-based one
 * couldn't; app code never uses it, so it's an unused surface, not a
 * privilege gap.
 */
export const readPublishedOrEditor: Access = ({ req }) =>
  req.user ? true : { _status: { equals: "published" } };
