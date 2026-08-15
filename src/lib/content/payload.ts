import "server-only";
import { getPayload } from "payload";
import config from "@payload-config";
import type { Payload } from "payload";

/*
 * The Payload local API, shared by every content read.
 *
 * `getPayload` memoises per config, so calling this on each request does not
 * open a new connection pool — but it is awaited lazily rather than at module
 * scope so importing this file never starts a database connection during a
 * build that will not read content.
 */
export function payloadClient(): Promise<Payload> {
  return getPayload({ config });
}
