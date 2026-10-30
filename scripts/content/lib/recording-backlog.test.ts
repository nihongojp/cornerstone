import assert from "node:assert/strict";
import test from "node:test";
import { isKnownRecordingGap } from "./recording-backlog";

test("known production recording gaps remain editorial todos", () => {
  assert.equal(isKnownRecordingGap("grammar-l2-v1", "step[3].components[0]:matchPairs", "audio", ["sumimasen-wakarimasen"]), true);
  assert.equal(isKnownRecordingGap("hiragana-l6-v1-iwate", "step[6].components[0]:matchPairs", "audio", ["た-タ", "ち-チ", "つ-ツ", "て-テ", "と-ト"]), true);
});

test("additional missing recordings still fail even on a known screen", () => {
  assert.equal(isKnownRecordingGap("grammar-l2-v1", "step[3].components[0]:matchPairs", "audio", ["sumimasen-wakarimasen", "kore"]), false);
});

test("the exception never covers other screens, pairing types, or empty lists", () => {
  const keys = ["sumimasen-wakarimasen"];
  assert.equal(isKnownRecordingGap("another-lesson", "step[3].components[0]:matchPairs", "audio", keys), false);
  assert.equal(isKnownRecordingGap("grammar-l2-v1", "step[4].components[0]:matchPairs", "audio", keys), false);
  assert.equal(isKnownRecordingGap("grammar-l2-v1", "step[3].components[0]:matchPairs", "meaning", keys), false);
  assert.equal(isKnownRecordingGap("grammar-l2-v1", "step[3].components[0]:matchPairs", "audio", []), false);
});

test("partially recording a known kana set keeps the remaining debt visible", () => {
  assert.equal(isKnownRecordingGap("hiragana-l6-v1-iwate", "step[6].components[0]:matchPairs", "audio", ["て-テ"]), true);
});
