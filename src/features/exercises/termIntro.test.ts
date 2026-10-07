import assert from "node:assert/strict";
import test from "node:test";

import { textToLexical } from "../../lib/content/textToLexical";
import type { Media } from "../../payload/payload-types";
import { resolveTermIntro } from "./termIntro";

/*
 * The composite replaces a screen's blocks with one layout, so anything it
 * does not draw is simply gone from the player — no error, no empty box.
 * These pin the three shapes it was built for and, more importantly, that
 * every other shape falls back to stacking.
 */

type Blocks = Parameters<typeof resolveTermIntro>[0];
type Block = Blocks[number];

const media = (url: string) => ({ id: 1, url }) as unknown as Media;

const dialogue = (over: Record<string, unknown> = {}) =>
  ({ blockType: "dialogue", speakerA: "A", speakerB: "B", lines: [], ...over }) as unknown as Block;
const videoLesson = (over: Record<string, unknown> = {}) =>
  ({ blockType: "videoLesson", title: "Konnichiwa", ...over }) as unknown as Block;
const mediaFigure = (over: Record<string, unknown> = {}) =>
  ({ blockType: "mediaFigure", ...over }) as unknown as Block;

test("dialogue + videoLesson takes term, note, audio and video from the video lesson", () => {
  const video = media("/v.mp4");
  const result = resolveTermIntro([
    dialogue(),
    videoLesson({ video, audio: media("/a.mp3"), content: textToLexical("Hello") }),
  ]);
  assert.equal(result?.term, "Konnichiwa");
  assert.equal(result?.note, "Hello");
  assert.equal(result?.audioUrl, "/a.mp3");
  assert.equal(result?.video, video);
});

test("dialogue + mediaFigure takes the term from the dialogue and media from the figure", () => {
  const image = media("/i.png");
  const result = resolveTermIntro([
    dialogue({ title: " Sumimasen " }),
    mediaFigure({ audio: media("/a.mp3"), image }),
  ]);
  assert.equal(result?.term, "Sumimasen");
  assert.equal(result?.audioUrl, "/a.mp3");
  assert.equal(result?.image, image);
});

test("a titled dialogue alone resolves with no media", () => {
  const result = resolveTermIntro([dialogue({ title: "Kore" })]);
  assert.equal(result?.term, "Kore");
  assert.equal(result?.audioUrl, undefined);
  assert.equal(result?.video, null);
  assert.equal(result?.image, null);
});

test("a video lesson with no audio falls back to the figure's", () => {
  const result = resolveTermIntro([
    dialogue(),
    videoLesson(),
    mediaFigure({ audio: media("/figure.mp3") }),
  ]);
  assert.equal(result?.audioUrl, "/figure.mp3");
});

test("no term name means no composite", () => {
  assert.equal(resolveTermIntro([dialogue()]), null);
  assert.equal(resolveTermIntro([dialogue({ title: "  " })]), null);
  assert.equal(resolveTermIntro([dialogue({ title: "Kore" }), videoLesson({ title: " " })]), null);
});

test("a screen without a dialogue, or with any other block, stacks", () => {
  assert.equal(resolveTermIntro([]), null);
  assert.equal(resolveTermIntro([videoLesson()]), null);
  assert.equal(
    resolveTermIntro([dialogue({ title: "Kore" }), { blockType: "grammarPoint" } as unknown as Block]),
    null
  );
});

test("more than one block of a kind stacks rather than dropping the extras", () => {
  const titled = dialogue({ title: "Kore" });
  assert.equal(resolveTermIntro([titled, dialogue({ title: "Sore" })]), null);
  assert.equal(resolveTermIntro([titled, videoLesson(), videoLesson()]), null);
  assert.equal(resolveTermIntro([titled, mediaFigure(), mediaFigure({ image: media("/i.png") })]), null);
});

test("a captioned figure stacks, because the composite has nowhere to show the caption", () => {
  assert.equal(
    resolveTermIntro([dialogue({ title: "Kore" }), mediaFigure({ caption: "Pointing at a book" })]),
    null
  );
  assert.notEqual(resolveTermIntro([dialogue({ title: "Kore" }), mediaFigure({ caption: " " })]), null);
});
