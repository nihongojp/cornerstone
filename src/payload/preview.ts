import type { CollectionConfig, LivePreviewConfig } from "payload";

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
 * Fails closed, like the secret below, and for the same reason — it used to
 * default to `http://localhost:3000`.
 *
 * That default is only ever right on the machine that happens to be serving the
 * admin from port 3000. Anywhere else it sends the editor's browser to a
 * *different server*: on a deployment with the variable unset, to the editor's
 * own laptop. The request then arrives with no `payload-token` for that origin,
 * `payload.auth()` finds no user, and /api/preview answers
 * "You are not allowed to preview this page" — which reads as a permissions
 * problem and is really a wrong hostname.
 *
 * Returning null hides the Preview button and the Live Preview panel instead,
 * which is a question somebody can answer. `.env.example` carries the variable.
 *
 * Note this cannot fix the near-miss version: with the variable *set* to
 * localhost:3000 and `next dev` bound to some other port because 3000 was
 * taken, preview still points at whatever owns 3000. The value has to match the
 * port the admin is actually served from — there is no way to know that here,
 * because Payload builds these URLs on the server where there is no `window`.
 */
function serverURL(): string | null {
  return process.env.NEXT_PUBLIC_SERVER_URL?.trim() || null;
}

function buildPreviewURL(
  collection: string,
  doc: Record<string, unknown> | null | undefined
): string | null {
  const path = previewPath(collection, doc);
  if (!path) return null;

  const origin = serverURL();
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
}) =>
  collectionConfig
    ? buildPreviewURL(collectionConfig.slug, data as Record<string, unknown>)
    : null;

/** `admin.preview` for one collection — the Preview button, same destination. */
export function generatePreviewURL(
  collection: string
): NonNullable<NonNullable<CollectionConfig["admin"]>["preview"]> {
  return (doc) => buildPreviewURL(collection, doc as Record<string, unknown>);
}
