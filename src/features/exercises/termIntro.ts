import { mediaSrc } from "../../lib/content/media";
import { proseToPlainText } from "../../lib/content/prose";
import type {
  DialogueBlock,
  Lesson,
  Media,
  MediaFigureBlock,
  VideoLessonBlock,
} from "../../payload/payload-types";

/*
 * Deciding whether a screen is a term introduction, kept apart from the
 * component that draws one so it can be tested without a DOM — the same split
 * as `dragDropPlacement.ts` and `DragDropCombination`.
 */

// Structurally the same type `RenderBlock` exports as `BlockOf`; restated so
// this module does not import a client component to get at a type.
type Block = NonNullable<NonNullable<Lesson["steps"]>[number]["components"]>[number];

export type TermIntroDialogueProps = {
  term: string;
  /** Plain-text detail shown after an em dash when present. */
  note?: string;
  audioUrl?: string;
  video?: Media | number | null;
  image?: Media | number | null;
  /** Absent when the screen is just the term, its audio and the picture. */
  dialogue?: DialogueBlock;
};

/** Block types that can participate in a term-intro composite screen. */
const TERM_INTRO_BLOCK_TYPES = new Set(["dialogue", "videoLesson", "mediaFigure"]);

/**
 * When a screen is one of the term-intro shapes and a term name can be
 * resolved, return the props for `TermIntroDialogue`. Otherwise null —
 * `RenderExercise` falls back to stacking blocks.
 *
 * Content patterns (from the snapshot):
 * - dialogue + videoLesson → term/note/audio/video from videoLesson
 * - dialogue + mediaFigure → term from dialogue.title; audio/media from mediaFigure
 * - dialogue only (titled) → term from dialogue.title; placeholder media
 * - an image figure + an audio figure, no dialogue → see `resolvePictureWithClip`
 *
 * With a dialogue the composite draws one dialogue, one video lesson and one
 * media figure, and has no slot for a figure's caption. A screen with more than
 * that is not this layout: it stacks instead, because picking the first of each
 * would drop the rest from the player with nothing to report it.
 */
export function resolveTermIntro(blocks: Block[], label?: string): TermIntroDialogueProps | null {
  if (blocks.length === 0) return null;
  if (!blocks.every((b) => TERM_INTRO_BLOCK_TYPES.has(b.blockType))) return null;

  const dialogues = blocks.filter((b): b is DialogueBlock & Block => b.blockType === "dialogue");
  const videoLessons = blocks.filter(
    (b): b is VideoLessonBlock & Block => b.blockType === "videoLesson"
  );
  const mediaFigures = blocks.filter(
    (b): b is MediaFigureBlock & Block => b.blockType === "mediaFigure"
  );

  if (dialogues.length === 0) return resolvePictureWithClip(videoLessons, mediaFigures, label);
  if (dialogues.length !== 1 || videoLessons.length > 1 || mediaFigures.length > 1) return null;

  const dialogue = dialogues[0];
  const videoLesson = videoLessons.at(0);
  const mediaFigure = mediaFigures.at(0);
  if (mediaFigure?.caption?.trim()) return null;

  if (videoLesson) {
    const title = videoLesson.title?.trim();
    if (!title) return null;
    const note = proseToPlainText(videoLesson.content).trim();
    return {
      term: title,
      note: note || undefined,
      audioUrl: mediaSrc(videoLesson.audio) ?? mediaSrc(mediaFigure?.audio),
      video: videoLesson.video ?? dialogue.video ?? null,
      image: mediaFigure?.image ?? null,
      dialogue,
    };
  }

  const title = dialogue.title?.trim();
  if (!title) return null;

  return {
    term: title,
    audioUrl: mediaSrc(mediaFigure?.audio),
    video: mediaFigure?.video ?? dialogue.video ?? null,
    image: mediaFigure?.image ?? null,
    dialogue,
  };
}

/**
 * The one dialogue-less shape: a picture and a recording, named by the step's
 * label — vocabulary where the picture already shows the situation, so an A/B
 * exchange would only repeat the word. A figure holds exactly one asset, so this
 * is two figures: one image, one audio, nothing else on the screen. Anything
 * different (a lone image, two images, a video lesson, a caption, no label)
 * keeps stacking as it always did.
 */
function resolvePictureWithClip(
  videoLessons: VideoLessonBlock[],
  mediaFigures: MediaFigureBlock[],
  label?: string
): TermIntroDialogueProps | null {
  if (videoLessons.length !== 0 || mediaFigures.length !== 2) return null;
  if (mediaFigures.some((f) => f.caption?.trim())) return null;

  const picture = mediaFigures.find((f) => f.image && !f.audio && !f.video);
  const clip = mediaFigures.find((f) => f.audio && !f.image && !f.video);
  const term = label?.trim();
  if (!picture || !clip || !term) return null;

  return { term, audioUrl: mediaSrc(clip.audio), video: null, image: picture.image ?? null };
}
