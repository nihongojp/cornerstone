import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { resolveReferenceAudio } from "./pronunciation-reference";

/*
 * The hop that broke pronunciation scoring in production, and did it two
 * services away from where the 500 appeared.
 *
 * The container fetches the reference audio itself. Phase 1 moved media from
 * absolute public Cloudinary URLs to app-relative, access-gated Payload
 * uploads, so what it was handed stopped being fetchable — Node's fetch cannot
 * parse a relative URL at all. The container's catch answered 500, the proxy
 * passed that status through, and the proxy's own logging never fired because
 * *its* request had succeeded. Nothing in the app logged a cause.
 *
 * So the cases below are about what this hands downstream, including the ones
 * that must not silently forward something unusable.
 */

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const request = (origin = "https://learn.nihongojp.com", cookie = "better-auth.session=abc") =>
  new Request(`${origin}/api/pronunciation/check`, {
    method: "POST",
    headers: { cookie },
  });

/** Stubs fetch and records what it was called with. */
function stubFetch(handler: (url: URL, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (input: URL | RequestInfo, init: RequestInit = {}) => {
    const url = input instanceof URL ? input : new URL(String(input));
    calls.push({ url: url.toString(), init });
    return handler(url, init);
  }) as typeof fetch;
  return calls;
}

const redirectTo = (location: string) =>
  new Response(null, { status: 302, headers: { location } });

test("an app-relative path resolves to the signed URL the media route redirects to", async () => {
  const signed = "https://blob.vercel-storage.com/kore.mp3?sig=deadbeef";
  const calls = stubFetch(() => redirectTo(signed));

  const out = await resolveReferenceAudio("/api/media/file/kore.mp3", request());

  assert.deepEqual(out, { url: signed });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://learn.nihongojp.com/api/media/file/kore.mp3");
});

test("it asks its own origin, not a configured one", async () => {
  // On a preview deployment a configured URL names production, which is the
  // same trap the preview URL builder had.
  const calls = stubFetch(() => redirectTo("https://blob.vercel-storage.com/x.mp3?sig=1"));

  await resolveReferenceAudio("/api/media/file/x.mp3", request("https://cornerstone-git-abc.vercel.app"));

  assert.ok(calls[0].url.startsWith("https://cornerstone-git-abc.vercel.app/"));
});

test("it carries the learner's cookie, which is what passes the media gate", async () => {
  const calls = stubFetch(() => redirectTo("https://blob.vercel-storage.com/x.mp3?sig=1"));

  await resolveReferenceAudio("/api/media/file/x.mp3", request(undefined, "better-auth.session=xyz"));

  assert.equal((calls[0].init.headers as Record<string, string>).cookie, "better-auth.session=xyz");
});

test("it does not follow the redirect itself — the bytes are the container's job", async () => {
  const calls = stubFetch(() => redirectTo("https://blob.vercel-storage.com/x.mp3?sig=1"));

  await resolveReferenceAudio("/api/media/file/x.mp3", request());

  assert.equal(calls[0].init.redirect, "manual");
});

test("an already-absolute URL is passed through untouched, and fetches nothing", async () => {
  // Cloudinary links predating Phase 1 still resolve on their own.
  const calls = stubFetch(() => redirectTo("should-not-be-called"));
  const url = "https://res.cloudinary.com/demo/video/upload/kore.mp3";

  assert.deepEqual(await resolveReferenceAudio(url, request()), { url });
  assert.equal(calls.length, 0);
});

test("a denied read reports 403 rather than forwarding an unusable URL", async () => {
  stubFetch(() => new Response("Forbidden", { status: 403 }));

  const out = await resolveReferenceAudio("/api/media/file/kore.mp3", request());

  assert.deepEqual(out, { error: "Not allowed to read the reference audio", status: 403 });
});

test("any other non-redirect is a 502, not a pass-through", async () => {
  stubFetch(() => new Response("nope", { status: 404 }));

  const out = await resolveReferenceAudio("/api/media/file/gone.mp3", request());

  assert.equal("error" in out && out.status, 502);
});

test("a 302 with no Location does not resolve to undefined", async () => {
  stubFetch(() => new Response(null, { status: 302 }));

  const out = await resolveReferenceAudio("/api/media/file/kore.mp3", request());

  assert.ok("error" in out);
});

test("an unreachable media route is a 502", async () => {
  globalThis.fetch = (async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch;

  const out = await resolveReferenceAudio("/api/media/file/kore.mp3", request());

  assert.equal("error" in out && out.status, 502);
});

test("something that is neither a URL nor a path is rejected, not forwarded", async () => {
  const calls = stubFetch(() => redirectTo("x"));

  const out = await resolveReferenceAudio("PLACEHOLDER_AUDIO_URL", request());

  assert.equal("error" in out && out.status, 400);
  assert.equal(calls.length, 0);
});
