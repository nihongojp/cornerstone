import type { CollectionConfig, LivePreviewConfig, PayloadRequest } from "payload";

import { previewPath } from "../lib/content/routes";

/*
 * The two doors into Draft Mode, and the only two.
 *
 * `livePreviewURL` feeds `admin.livePreview.url` — the iframe that renders the
 * front end beside the editing form. `generatePreviewURL` feeds each
 * collection's `admin.preview` — the "Preview" button that opens the same page
 * in a tab. Both point at /api/preview rather than at the page itself, because
 * Draft Mode can only be switched on by a route handler, and that handler is
 * where the request gets checked.
 *
 * No `server-only` import: `payload.config.ts` pulls this in, and the Payload
 * CLI loads that config in plain Node for `generate:types` and `migrate:create`.
 *
 * Reading PREVIEW_SECRET here does not ship it to the browser. Payload strips
 * `livePreview.url` and `admin.preview` when it builds the client config — they
 * are server-only properties — so the function never crosses the bundle
 * boundary. The URL it returns does, as the iframe's `src`, which is exactly
 * why /api/preview treats the secret as a filter and checks the editor's
 * session separately.
 */

/*
 * Where to send the browser — taken from the request that is rendering the
 * admin, not from configuration.
 *
 * /api/preview is a route in this same Next application, mounted on the same
 * origin as /admin. So the request already carries the one correct answer, and
 * every configured answer is a second copy of it that can drift. All three ways
 * it drifted are real:
 *
 *  - It defaulted to `http://localhost:3000`, which is right only on a machine
 *    serving the admin from that port. `next dev` picks another port whenever
 *    3000 is taken — by another worktree, usually — and the button then points
 *    at whatever *does* own 3000.
 *  - Unset on a deployment, that default sent editors to their own laptop.
 *  - Set to the production URL, a Vercel *preview* deployment sends an editor
 *    previewing a draft to the live site instead.
 *
 * Each of those surfaces identically: the request arrives at an origin holding
 * no `payload-token` for it, `payload.auth()` finds no user, and /api/preview
 * answers "You are not allowed to preview this page" — a permissions message
 * for what is really a wrong hostname.
 *
 * `NEXT_PUBLIC_SERVER_URL` stays as a fallback for the deployment that really
 * does serve the admin from somewhere else, and for any call Payload makes
 * without a request. With neither available this returns null, which hides the
 * Preview button and the Live Preview panel rather than offering one that
 * always 403s — the same way a missing PREVIEW_SECRET already behaved.
 */
function serverURL(req?: PayloadRequest): string | null {
  const fromRequest = req?.origin?.trim();
  if (fromRequest) return fromRequest;
  return process.env.NEXT_PUBLIC_SERVER_URL?.trim() || null;
}

function buildPreviewURL(
  collection: string,
  doc: Record<string, unknown> | null | undefined,
  req?: PayloadRequest
): string | null {
  const path = previewPath(collection, doc);
  if (!path) return null;

  const origin = serverURL(req);
  if (!origin) return null;

  // Fail closed. /api/preview refuses every request when the secret is unset,
  // so returning null here hides preview in the admin rather than offering a
  // button that always 403s.
  const secret = process.env.PREVIEW_SECRET;
  if (!secret) return null;

  const url = new URL("/api/preview", origin);
  url.searchParams.set("previewSecret", secret);
  url.searchParams.set("collection", collection);
  url.searchParams.set("path", path);
  return url.toString();
}

export const livePreviewURL: NonNullable<LivePreviewConfig["url"]> = ({
  data,
  collectionConfig,
  req,
}) =>
  collectionConfig
    ? buildPreviewURL(collectionConfig.slug, data as Record<string, unknown>, req)
    : null;

/** `admin.preview` for one collection — the Preview button, same destination. */
export function generatePreviewURL(
  collection: string
): NonNullable<NonNullable<CollectionConfig["admin"]>["preview"]> {
  return (doc, { req }) =>
    buildPreviewURL(collection, doc as Record<string, unknown>, req);
}
