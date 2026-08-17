import { cloudStoragePlugin } from "@payloadcms/plugin-cloud-storage";
import type {
  Adapter,
  GeneratedAdapter,
  PluginOptions as CloudStoragePluginOptions,
} from "@payloadcms/plugin-cloud-storage/types";
import { getFileKey, getFilePrefix } from "@payloadcms/plugin-cloud-storage/utilities";
import { del, issueSignedToken, presignUrl, type IssuedSignedToken } from "@vercel/blob";
import type { Config, Plugin, UploadCollectionSlug } from "payload";
import { put } from "@vercel/blob";

/*
 * Storage adapter for a Vercel Blob store created with **private** access.
 *
 * Why this exists rather than `@payloadcms/storage-vercel-blob`: that package
 * hard-types its option as `access?: 'public'` and always passes `'public'` to
 * `put()`, which a private store rejects outright with "Cannot use public
 * access on a private store". Upstream support is an unmerged PR
 * (payloadcms/payload#16457), so instead of patching node_modules we build on
 * `cloudStoragePlugin`, the documented extension point the official adapters
 * themselves are built on.
 *
 * How reads work. Private blobs 401 to an unauthenticated fetch, so the raw
 * blob URL is useless to a browser. Payload's own upload route
 * (`GET /api/media/file/:filename`) runs the collection's `access.read` first,
 * and only then calls `staticHandler` below — which mints a short-lived signed
 * URL and 302s to it. So authorization is Payload's, delivery is the CDN's, and
 * no media bytes flow through a serverless function.
 *
 * Note we deliberately do NOT implement `generateURL`, and never set
 * `disablePayloadAccessControl`. The plugin only calls `generateURL` when
 * access control is disabled; leaving both alone is what keeps `media.url` as
 * `/api/media/file/<filename>` — the gated route — instead of a raw blob URL
 * that would bypass the gate entirely.
 */

export type VercelPrivateBlobOptions = {
  collections: Partial<Record<UploadCollectionSlug, true | { prefix?: string }>>;
  /** See `alwaysInsertFields` in `@payloadcms/plugin-cloud-storage`. */
  alwaysInsertFields?: boolean;
  /** Falsy disables the adapter and Payload falls back to local disk. */
  token?: string;
  /**
   * How long a redirect's signed URL stays valid. Minutes, not hours: a signed
   * URL is a bearer capability with no revocation mechanism, so its lifetime is
   * the only thing bounding a leaked link.
   */
  signedUrlTTLSeconds?: number;
  /** `Cache-Control: max-age` on the stored object, in seconds. */
  cacheControlMaxAge?: number;
};

const DEFAULT_SIGNED_URL_TTL_SECONDS = 300;

/* The delegation is a network round-trip; presigning against it is local HMAC.
 * Issue one whole-store read delegation and reuse it, or every media request
 * pays for a call to the Blob control API. */
const DELEGATION_TTL_MS = 60 * 60 * 1000;

type DelegationCache = {
  inFlight: Promise<IssuedSignedToken> | null;
  token: IssuedSignedToken | null;
};

/* Keyed by the read-write token rather than a single slot: one store per app is
 * the only case today, but a shared cache would silently hand store A's
 * delegation to store B, and the resulting 403s would be baffling. */
const delegationCaches = new Map<string, DelegationCache>();

/**
 * The store id is embedded in the token (`vercel_blob_rw_<storeId>_<secret>`),
 * so logs can name the store they failed against without touching the secret.
 */
function storeIdFromToken(token: string): string {
  return token.split("_")[3] ?? "unknown";
}

function cacheFor(token: string): DelegationCache {
  let cache = delegationCaches.get(token);
  if (!cache) {
    cache = { inFlight: null, token: null };
    delegationCaches.set(token, cache);
  }
  return cache;
}

/*
 * Refresh once the remaining life no longer covers a full signed URL, since
 * `presignUrl` caps each URL at the delegation's own expiry — an unrefreshed
 * delegation would silently start handing out ever-shorter links, and finally
 * links that expire mid-playback.
 */
function delegationIsUsable(token: IssuedSignedToken | null, ttlSeconds: number): boolean {
  if (!token) {
    return false;
  }
  const marginMs = ttlSeconds * 1000 + 60_000;
  return token.validUntil - Date.now() > marginMs;
}

async function getDelegation(token: string, ttlSeconds: number): Promise<IssuedSignedToken> {
  const cache = cacheFor(token);
  if (delegationIsUsable(cache.token, ttlSeconds)) {
    return cache.token as IssuedSignedToken;
  }
  // Collapse concurrent refreshes: a cold start under load would otherwise
  // fire one control-API call per in-flight media request.
  if (!cache.inFlight) {
    cache.inFlight = issueSignedToken({
      pathname: "*",
      operations: ["get"],
      validUntil: Date.now() + DELEGATION_TTL_MS,
      token,
    })
      .then((issued) => {
        cache.token = issued;
        return issued;
      })
      .finally(() => {
        cache.inFlight = null;
      });
  }
  return cache.inFlight;
}

function createAdapter({
  cacheControlMaxAge,
  signedUrlTTLSeconds,
  token,
}: {
  cacheControlMaxAge?: number;
  signedUrlTTLSeconds: number;
  token: string;
}): Adapter {
  return ({ collection, prefix }): GeneratedAdapter => ({
    name: "vercel-private-blob",

    handleUpload: async ({ data, file }) => {
      const { fileKey } = getFileKey({
        collectionPrefix: prefix,
        docPrefix: data.prefix,
        filename: file.filename,
      });

      await put(fileKey, file.buffer, {
        access: "private",
        // Payload writes image sizes and re-uploads on replace; without this a
        // second save of the same filename fails instead of overwriting.
        allowOverwrite: true,
        contentType: file.mimeType,
        token,
        ...(cacheControlMaxAge !== undefined && { cacheControlMaxAge }),
      });

      // Nothing to merge back onto the document: `url` is produced by Payload's
      // own beforeChange hook as the gated `/api/<slug>/file/<filename>` route.
      // Returning a value here would trigger a redundant nested update.
    },

    handleDelete: async ({ doc, filename }) => {
      const { fileKey } = getFileKey({
        collectionPrefix: prefix,
        docPrefix: (doc as { prefix?: string }).prefix,
        filename,
      });
      await del(fileKey, { token });
    },

    staticHandler: async (req, { params }) => {
      const docPrefix = await getFilePrefix({
        collection,
        filename: params.filename,
        prefixQueryParam: params.prefix,
        req,
      });
      const { fileKey } = getFileKey({
        collectionPrefix: prefix,
        docPrefix,
        filename: params.filename,
      });

      try {
        const delegation = await getDelegation(token, signedUrlTTLSeconds);
        const { presignedUrl } = await presignUrl(delegation, {
          access: "private",
          operation: "get",
          pathname: fileKey,
          validUntil: Date.now() + signedUrlTTLSeconds * 1000,
        });


        /*
         * `no-store` is load-bearing, not boilerplate. Media elements re-follow
         * this redirect for every Range request while seeking; if a client
         * cached the 302, it would keep following one signed URL until that URL
         * expired and then 403 mid-playback. Not caching means each request
         * re-runs the access check and gets a freshly signed link — which is
         * also the cheaper half of the trade, since the function only signs and
         * redirects, never proxies bytes.
         */
        return new Response(null, {
          status: 302,
          headers: {
            "Cache-Control": "private, no-store",
            Location: presignedUrl,
          },
        });
      } catch (err) {
        /*
         * Deliberately 503, not 404. Everything reaching this branch is a
         * server-side signing failure — a missing or rotated token, a store that
         * was disconnected or recreated, or the Blob control API being down. The
         * file itself is very likely fine.
         *
         * A genuinely missing object never gets here: we redirect without
         * checking existence, so the CDN answers that 404 after the redirect. So
         * a 404 in the logs means "that one file is gone" while a 503 means "the
         * store is not reachable" — worth keeping distinguishable, because the
         * two have completely different fixes and the second one affects every
         * asset at once.
         */
        req.payload.logger.error({
          err,
          key: fileKey,
          storeId: storeIdFromToken(token),
          msg:
            "Could not sign a Vercel Blob URL — check BLOB_READ_WRITE_TOKEN is set " +
            "and still matches the connected store",
        });
        return new Response(null, { status: 503, statusText: "Service Unavailable" });
      }
    },
  });
}

export function vercelPrivateBlobStorage(options: VercelPrivateBlobOptions): Plugin {
  const { alwaysInsertFields, cacheControlMaxAge, collections, token } = options;
  const signedUrlTTLSeconds = options.signedUrlTTLSeconds ?? DEFAULT_SIGNED_URL_TTL_SECONDS;

  const collectionOptions = (adapter: Adapter | null): CloudStoragePluginOptions["collections"] =>
    Object.fromEntries(
      Object.entries(collections).map(([slug, value]) => [
        slug,
        {
          adapter,
          disableLocalStorage: adapter !== null,
          /*
           * `prefix: ""` exists to keep the schema stable, and it is load-bearing
           * despite looking like a no-op.
           *
           * `alwaysInsertFields` is documented as inserting fields regardless of
           * whether the plugin is enabled, but plugin.js only honours it on the
           * disabled branch — the enabled branch calls getFields() without it, and
           * getFields only adds the `prefix` field when a prefix is defined. So
           * with a Blob token present the field vanishes from the schema, and
           * `payload migrate:create` would helpfully offer to DROP
           * payload.media.prefix. Setting an empty prefix satisfies getFields'
           * `typeof prefix !== 'undefined'` check without changing any file key:
           * sanitizePrefix("") is "", and joining that is a no-op.
           *
           * This predates the private-blob work — the stock adapter passed the
           * same options — and only became visible once a token existed locally.
           */
          prefix: "",
          ...(typeof value === "object" ? value : {}),
        },
      ]),
    );

  /*
   * On Vercel, a missing token is never intentional. Falling back to local disk
   * there would "work" — uploads would write to an ephemeral filesystem that
   * disappears, and every existing asset would 404 because Payload would look
   * for it on a disk it was never on. That is a silent, confusing failure, and
   * the misconfiguration it hides (store disconnected, env var dropped, token
   * rotated) is one someone has to fix anyway. Refuse to start instead.
   *
   * `VERCEL` is set during both build and runtime on Vercel and nowhere else, so
   * this cannot fire on a laptop or in the GitHub migration workflow, where the
   * disk fallback is the intended behaviour.
   */
  if (!token && process.env.VERCEL) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is missing on Vercel. Media cannot be stored or served. " +
        "Check that the Blob store is still connected to the project " +
        "(Vercel → Storage), and that the token is present in this environment. " +
        "Falling back to local disk here would silently lose every upload.",
    );
  }

  /*
   * No token off Vercel means no Blob store — local development. Hand the plugin
   * a null adapter with `enabled: false` so uploads fall back to local disk,
   * while `alwaysInsertFields` still injects the `prefix` column. That last part
   * is why this branch exists at all: without it a developer without Blob access
   * generates different migrations than CI does.
   */
  if (!token) {
    return (incomingConfig: Config) =>
      cloudStoragePlugin({
        alwaysInsertFields,
        collections: collectionOptions(null),
        enabled: false,
      })(incomingConfig);
  }

  const adapter = createAdapter({ cacheControlMaxAge, signedUrlTTLSeconds, token });

  return (incomingConfig: Config) =>
    cloudStoragePlugin({
      alwaysInsertFields,
      collections: collectionOptions(adapter),
    })(incomingConfig);
}
