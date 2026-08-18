/*
 * Reference audio, made fetchable by a service that has no session.
 *
 * `referenceAudioUrl` is whatever `termAudio()` resolved, which since Phase 1
 * is a Payload upload's `url` — an app-relative, access-gated path like
 * `/api/media/file/kore.mp3`. It used to be an absolute, public Cloudinary URL,
 * and the container still assumes it can just fetch it: `pronunciationController`
 * calls `fetch(audioUrl)` directly. Node's fetch cannot parse a relative URL, so
 * it throws, the container's catch answers 500, and this route passes that
 * status straight through — a 500 on /api/pronunciation/check whose cause is
 * two services away and whose only trace is in the response body.
 *
 * Making the path absolute is not enough on its own. `/api/media/file/*` 403s
 * anonymous requests by design (the `isReadingStaticFile` split in the Media
 * collection), so the container would fail the same way with a different
 * message.
 *
 * What that route *does* do, for a request that passes the gate, is 302 to a
 * short-lived signed Blob URL — see `payload/storage/vercelPrivateBlob.ts`,
 * which redirects and never proxies bytes. So this asks for the redirect while
 * holding the learner's cookie, and hands the container the signed URL. The
 * access check still happens, exactly once, in the place that owns it; the
 * container fetches a capability that expires in five minutes and is never
 * broadened.
 *
 * An already-absolute URL is passed through untouched — Cloudinary links
 * predating Phase 1 still resolve, and nothing here should be in the business
 * of rewriting them.
 */
export type Resolved = { url: string } | { error: string; status: number };

export async function resolveReferenceAudio(
  referenceAudioUrl: string,
  request: Request,
): Promise<Resolved> {
  if (/^https?:\/\//i.test(referenceAudioUrl)) {
    return { url: referenceAudioUrl };
  }

  if (!referenceAudioUrl.startsWith("/")) {
    return {
      error: "referenceAudioUrl must be an absolute URL or an app-relative path",
      status: 400,
    };
  }

  // Same origin as the request that arrived, rather than a configured one:
  // this route is asking its own deployment for a redirect, and on a preview
  // deployment the configured value names production. The preview URL builder
  // learned the same lesson.
  const target = new URL(referenceAudioUrl, new URL(request.url).origin);

  let res: Response;
  try {
    res = await fetch(target, {
      // The 302 is the whole payload — the bytes go to the container, not here.
      redirect: "manual",
      headers: { cookie: request.headers.get("cookie") ?? "" },
    });
  } catch (err) {
    console.error("[pronunciation] could not reach the media route:", err);
    return { error: "Could not resolve the reference audio", status: 502 };
  }

  const location = res.headers.get("location");
  if (res.status === 302 && location) {
    return { url: location };
  }

  // 403 here means the learner's cookie did not survive the hop, which is a
  // different bug from the one above and worth saying so rather than letting
  // the container report a generic failure.
  console.error(
    `[pronunciation] media route did not redirect: ${res.status} for ${referenceAudioUrl}`,
  );
  return {
    error:
      res.status === 403
        ? "Not allowed to read the reference audio"
        : "Reference audio could not be resolved",
    status: res.status === 403 ? 403 : 502,
  };
}
