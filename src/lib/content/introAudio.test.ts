import assert from "node:assert/strict";
import test from "node:test";

import type { Lesson, Media } from "../../payload/payload-types";
import { introAudioByName, nameKey } from "./introAudio";

type Step = NonNullable<Lesson["steps"]>[number];

const audio = (url: string) => ({ id: 1, url }) as unknown as Media;
const step = (label: string | null, components: Record<string, unknown>[]) =>
  ({ id: "s", label, components }) as unknown as Step;

test("names match without regard to case, punctuation or spacing", () => {
  assert.equal(nameKey("Yukkuri, onegaishimasu"), nameKey("  yukkuri onegaishimasu "));
  assert.notEqual(nameKey("Yukkuri onegaishimasu"), nameKey("Mouichido onegaishimasu"));
});

test("a step's label names the recording on its figure", () => {
  const found = introAudioByName([
    step("Yukkuri, onegaishimasu", [
      { blockType: "mediaFigure", image: { id: 2, url: "/i.png" } },
      { blockType: "mediaFigure", audio: audio("/yukkuri.mp3") },
    ]),
  ]);
  assert.equal(found[nameKey("Yukkuri, onegaishimasu")], "/yukkuri.mp3");
});

test("a video's or a dialogue's title names it when the step has no label", () => {
  const found = introAudioByName([
    step(null, [{ blockType: "videoLesson", title: "Konnichiwa", audio: audio("/k.mp3") }]),
    step("", [{ blockType: "dialogue", title: "Kore" }, { blockType: "mediaFigure", audio: audio("/kore.mp3") }]),
  ]);
  assert.equal(found[nameKey("Konnichiwa")], "/k.mp3");
  assert.equal(found[nameKey("Kore")], "/kore.mp3");
});

test("a step with no recording contributes nothing", () => {
  assert.deepEqual(introAudioByName([step("Sore", [{ blockType: "mediaFigure", image: { id: 2, url: "/i.png" } }])]), {});
});

test("the first recording for a name wins", () => {
  const found = introAudioByName([
    step("Are", [{ blockType: "mediaFigure", audio: audio("/first.mp3") }]),
    step("Are", [{ blockType: "mediaFigure", audio: audio("/second.mp3") }]),
  ]);
  assert.equal(found[nameKey("Are")], "/first.mp3");
});

test("no steps is an empty lookup", () => {
  assert.deepEqual(introAudioByName(null), {});
  assert.deepEqual(introAudioByName(undefined), {});
});
