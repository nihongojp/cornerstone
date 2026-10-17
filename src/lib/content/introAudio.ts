import { mediaSrc } from "./media";
import type { Lesson } from "../../payload/payload-types";

type Step = NonNullable<Lesson["steps"]>[number];

/*
 * The recordings a lesson already carries on its intro screens, by the name of the
 * term the screen introduces.
 *
 * A grammar lesson usually teaches a phrase on an intro screen — a picture and a
 * recording, labelled with the phrase — and later has the learner build it from
 * tiles. The recording was attached to the intro screen's Figure block, but the
 * tile exercise reads its reference audio from the *term* it points at, so unless
 * the same recording was also uploaded to the term the exercise had nothing to play
 * and the learner never heard the answer they had just built.
 *
 * This lets the exercise fall back to the intro screen's recording when its term has
 * none. The term's own audio always wins; this only fills a gap.
 */

/** Names compared without case, punctuation or spacing: "Yukkuri, onegaishimasu" = "yukkuri onegaishimasu". */
export function nameKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * name → recording, from every step that has one. A step is named by its label, a
 * video's title or a dialogue's title; the first recording seen for a name wins.
 */
export function introAudioByName(steps: readonly Step[] | null | undefined): Record<string, string> {
  const found: Record<string, string> = {};

  for (const step of steps ?? []) {
    const names: string[] = [];
    let audio: string | undefined;

    if (step.label) names.push(step.label);

    for (const block of step.components ?? []) {
      if (block.blockType === "videoLesson") {
        audio ??= mediaSrc(block.audio);
        if (block.title) names.push(block.title);
      } else if (block.blockType === "mediaFigure") {
        audio ??= mediaSrc(block.audio);
      } else if (block.blockType === "dialogue" && block.title) {
        names.push(block.title);
      }
    }

    if (!audio) continue;
    for (const name of names) {
      const key = nameKey(name);
      if (key && !(key in found)) found[key] = audio;
    }
  }

  return found;
}
