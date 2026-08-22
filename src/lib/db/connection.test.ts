import assert from "node:assert/strict";
import { test } from "node:test";

import { pinSslMode } from "./connection";

const neon = (sslmode: string) =>
  `postgresql://user:secret@ep-x.neon.tech/neondb?sslmode=${sslmode}&channel_binding=require`;

test("require becomes verify-full, other query params stay", () => {
  assert.equal(
    pinSslMode(neon("require")),
    neon("verify-full"),
  );
});

test("prefer and allow become verify-full", () => {
  assert.equal(pinSslMode(neon("prefer")), neon("verify-full"));
  assert.equal(pinSslMode(neon("allow")), neon("verify-full"));
});

test("the mode is matched case-insensitively", () => {
  assert.equal(pinSslMode(neon("REQUIRE")), neon("verify-full"));
});

test("a URL with no sslmode is unchanged, including the local default", () => {
  const local = "postgresql://localhost:5432/cornerstone_dev";
  assert.equal(pinSslMode(local), local);
});

test("verify-full, verify-ca, and disable are left alone", () => {
  assert.equal(pinSslMode(neon("verify-full")), neon("verify-full"));
  assert.equal(pinSslMode(neon("verify-ca")), neon("verify-ca"));
  assert.equal(pinSslMode(neon("disable")), neon("disable"));
});

test("a percent-encoded password is not round-tripped through URL", () => {
  const input =
    "postgresql://user:p%40ss@host/db?sslmode=require&channel_binding=require";
  assert.equal(
    pinSslMode(input),
    "postgresql://user:p%40ss@host/db?sslmode=verify-full&channel_binding=require",
  );
});

test("an unparseable string is returned unchanged", () => {
  assert.equal(pinSslMode("not a url"), "not a url");
});
