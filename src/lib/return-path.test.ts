import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULT_RETURN_PATH, safeReturnPath } from "./return-path";

test("a same-origin path is returned unchanged", () => {
  assert.equal(safeReturnPath("/lessons"), "/lessons");
  assert.equal(safeReturnPath("/lessons/grammar-l1-v1"), "/lessons/grammar-l1-v1");
  assert.equal(safeReturnPath("/characters/momotaro"), "/characters/momotaro");
});

test("a query string survives — the proxy sends one", () => {
  assert.equal(safeReturnPath("/lessons?unit=3"), "/lessons?unit=3");
  assert.equal(safeReturnPath("/auth?mode=signup"), "/auth?mode=signup");
});

/*
 * The reason this module exists. Each of these, handed to `router.push`, is a
 * hard navigation off-site immediately after a successful sign-in.
 */
test("an absolute URL is refused", () => {
  assert.equal(safeReturnPath("https://evil.com"), DEFAULT_RETURN_PATH);
  assert.equal(safeReturnPath("http://evil.com/x"), DEFAULT_RETURN_PATH);
});

test("a protocol-relative URL is refused", () => {
  // `//evil.com` is the one that passes a naive `startsWith('/')` check.
  assert.equal(safeReturnPath("//evil.com"), DEFAULT_RETURN_PATH);
  assert.equal(safeReturnPath("//evil.com/path"), DEFAULT_RETURN_PATH);
});

test("a backslash is refused", () => {
  assert.equal(safeReturnPath("/\\evil.com"), DEFAULT_RETURN_PATH);
  assert.equal(safeReturnPath("\\\\evil.com"), DEFAULT_RETURN_PATH);
});

test("percent-encoded separators are refused, in either case", () => {
  assert.equal(safeReturnPath("/%2fevil.com"), DEFAULT_RETURN_PATH);
  assert.equal(safeReturnPath("/%2Fevil.com"), DEFAULT_RETURN_PATH);
  assert.equal(safeReturnPath("/%5cevil.com"), DEFAULT_RETURN_PATH);
});

test("a value that is not a path at all is refused", () => {
  assert.equal(safeReturnPath("lessons"), DEFAULT_RETURN_PATH);
  assert.equal(safeReturnPath("javascript:alert(1)"), DEFAULT_RETURN_PATH);
});

test("absent, empty and non-string values take the fallback", () => {
  assert.equal(safeReturnPath(null), DEFAULT_RETURN_PATH);
  assert.equal(safeReturnPath(undefined), DEFAULT_RETURN_PATH);
  assert.equal(safeReturnPath(""), DEFAULT_RETURN_PATH);
});

test("the fallback is overridable", () => {
  assert.equal(safeReturnPath("https://evil.com", "/dashboard"), "/dashboard");
  assert.equal(safeReturnPath(null, "/dashboard"), "/dashboard");
});
