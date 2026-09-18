"use client";

import React from "react";
import { Box, Typography } from "@mui/material";

import { kanaTilesToRomaji } from "@/utils/kana";
import type {
  BuildSentenceBlock,
  DialogueBlock,
  GrammarPointBlock,
  Lesson,
  ListenAndChooseBlock,
  MatchPairsBlock,
  MediaFigureBlock,
  MultipleChoiceBlock,
  ProseBlock,
  SpeakAndScoreBlock,
  Term,
  VideoLessonBlock,
  VocabListBlock,
} from "@/payload/payload-types";

import CharacterSpotlight from "./CharacterSpotlight";
import DragDropCombination from "./DragDropCombination";
import Fact from "@/components/Fact";
import FlashcardReview, { type FlashcardReviewTerm } from "./FlashcardReview";
import MatchAudioExercisePlaceholder from "./MatchAudioExercisePlaceholder";
import DotMatch, { type DotMatchPair } from "./MatchDots";
import MatchDotsMedia, { type MediaMatchPair } from "./MatchDotsMedia";
import PronunciationExercise, {
  type PronunciationExerciseData,
} from "./PronunciationExercise";
import MediaAudio from "@/components/media/MediaAudio";
import MediaImage from "@/components/media/MediaImage";
import MediaVideo from "@/components/media/MediaVideo";
import RichText from "@/components/richtext/RichText";
import Ruby from "@/components/richtext/Ruby";

import MultipleChoice from "./MultipleChoice";
import { term, termAudio, termImage, termText } from "./termText";
import { renderableTerm } from "@/lib/content/furigana";

/*
 * One block from the library, rendered straight from the Payload document.
 *
 * No intermediate contract. `adapters.ts` and `lib/types/lessons.ts` flatten the
 * old blocks into `NewLessonItem = { type: string; [key: string]: unknown }` and
 * the players then discriminate on which fields happen to be present — three
 * parallel type systems, so adding a block meant touching all of them. Here the
 * switch is on `blockType` and the payload is the generated type, so a renamed
 * field is a type error rather than a screen that renders blank.
 *
 * ── The interactive blocks reuse the components that already exist ───────────
 *
 * `matchPairs` feeds `MatchDots`, `buildSentence` feeds `DragDropCombination`,
 * and so on. Those components are not rewritten here on purpose: Phase 4b
 * collapses `NewLessonPlayer` (453 lines) and `LessonPlayer` (971) into one
 * runner and reworks the screens, and doing it here as well would mean doing it
 * twice. What this file establishes is the shape — blocks in, JSX out, no
 * flattening — which is what 4b builds on.
 */

export type BlockOf = NonNullable<
  NonNullable<Lesson["steps"]>[number]["components"]
>[number];

export type ResultCallback = (r: { result: "correct" | "incorrect" }) => void;

export const RenderBlock: React.FC<{
  block: BlockOf;
  /** Every term the lesson references — see the `buildSentence` case below. */
  lessonTerms?: Term[];
  onResult?: ResultCallback;
}> = ({ block, lessonTerms, onResult }) => {
  switch (block.blockType) {
    case "prose":
      return <ProseView {...block} />;
    case "dialogue":
      return <DialogueView {...block} />;
    case "videoLesson":
      return <VideoLessonView {...block} />;
    case "grammarPoint":
      return <GrammarPointView {...block} />;
    case "vocabList":
      return <VocabListView {...block} />;
    case "mediaFigure":
      return <MediaFigureView {...block} />;
    case "matchPairs":
      return <MatchPairsView {...block} onResult={onResult} />;
    case "listenAndChoose":
      return <ListenAndChooseView {...block} onResult={onResult} />;
    case "buildSentence":
      return <BuildSentenceView {...block} lessonTerms={lessonTerms} onResult={onResult} />;
    case "speakAndScore":
      return <SpeakAndScoreView {...block} />;
    case "multipleChoice":
      return <MultipleChoice {...block} onResult={onResult} />;
    default:
      /*
       * An old block, or `legacyJson`. Nothing renders: during Phase 4a the old
       * blocks still go through `adapters.ts` and the old player screens, and
       * this path only ever sees library blocks. Returning null rather than a
       * placeholder means a mistake here is invisible to a learner — which is
       * why `content:verify` reports the block types it finds.
       */
      return null;
  }
};

// ── Content ──────────────────────────────────────────────────────────────────

const CARD_SX = {
  borderRadius: "20px",
  border: "1px solid rgba(0,0,0,0.08)",
  bgcolor: "#FFFFFF",
  boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
  px: { xs: 2.5, sm: 3 },
  py: { xs: 2.5, sm: 3 },
} as const;

/*
 * The four old prose blocks differed only in the box. `tone` is that box, so all
 * four collapse to a switch here rather than four blocks in the schema.
 */
const ProseView: React.FC<ProseBlock> = ({ tone, title, content }) => {
  if (tone === "fact" || tone === "lifeTip") {
    return (
      <Fact
        title={title || (tone === "fact" ? "Fun Fact" : "Life Tip 🌟")}
        description={<RichText data={content} />}
      />
    );
  }

  const body = (
    <>
      {title && (
        <Typography sx={{ fontWeight: 800, fontSize: "1.2rem", mb: 1.5, color: "#1C1917" }}>
          {title}
        </Typography>
      )}
      <Box sx={{ lineHeight: 1.7, color: "#374151", fontSize: { xs: "1rem", sm: "1.1rem" } }}>
        <RichText data={content} />
      </Box>
    </>
  );

  return (
    <Box sx={{ width: "100%", maxWidth: 560, mx: "auto", px: { xs: 1, sm: 2 } }}>
      {tone === "card" ? <Box sx={CARD_SX}>{body}</Box> : body}
    </Box>
  );
};

/*
 * A two-speaker conversation.
 *
 * The old `videoPage.videoForm` rendering coloured a line by whether its index was
 * even, so the speaker was a property of position — inserting a line silently
 * reassigned every line after it. Here the speaker is on the line.
 *
 * `compact` is for term-intro screens (`TermIntroDialogue`): same speaker labels
 * and lines, tighter spacing so the transcript sits under media without
 * forcing the lesson viewport to scroll.
 */
export const DialogueTranscript: React.FC<{
  speakerA: string;
  speakerB: string;
  lines: DialogueBlock["lines"];
  compact?: boolean;
}> = ({ speakerA, speakerB, lines, compact = false }) => (
  <Box
    sx={{
      ...CARD_SX,
      display: "flex",
      flexDirection: "column",
      gap: compact ? 0.75 : 1.5,
      ...(compact
        ? {
            px: { xs: 1.75, sm: 2.25 },
            py: { xs: 1.5, sm: 1.75 },
            borderRadius: "16px",
          }
        : null),
    }}
  >
    {(lines ?? []).map((line, index) => (
      <Box
        key={line.id ?? index}
        sx={{ display: "flex", gap: compact ? 1 : 1.5, alignItems: "flex-start" }}
      >
        <Typography
          sx={{
            fontSize: compact ? "0.65rem" : "0.72rem",
            fontWeight: 800,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            pt: compact ? 0.25 : 0.5,
            minWidth: compact ? 48 : 56,
            color: line.speaker === "a" ? "#B43D20" : "#6366f1",
          }}
        >
          {line.speaker === "a" ? speakerA : speakerB}
        </Typography>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box
            sx={{
              fontSize: compact
                ? { xs: "0.92rem", sm: "1rem" }
                : { xs: "1rem", sm: "1.1rem" },
              lineHeight: compact ? 1.35 : 1.7,
            }}
          >
            <RichText data={line.japanese} disableContainer />
          </Box>
          {line.romaji && (
            <Typography
              sx={{
                fontSize: compact ? "0.78rem" : "0.85rem",
                color: "text.secondary",
                fontStyle: "italic",
                lineHeight: compact ? 1.3 : undefined,
              }}
            >
              {line.romaji}
            </Typography>
          )}
          {line.english && (
            <Typography
              sx={{
                fontSize: compact ? "0.82rem" : "0.9rem",
                color: "#374151",
                lineHeight: compact ? 1.3 : undefined,
              }}
            >
              {line.english}
            </Typography>
          )}
          {line.audio && <MediaAudio value={line.audio} />}
        </Box>
      </Box>
    ))}
  </Box>
);

const DialogueView: React.FC<DialogueBlock> = ({
  title,
  speakerA,
  speakerB,
  video,
  lines,
}) => (
  <Box sx={{ width: "100%", maxWidth: 560, mx: "auto", px: { xs: 1, sm: 2 } }}>
    {title && (
      <Typography sx={{ fontWeight: 800, fontSize: "1.2rem", mb: 1.5 }}>{title}</Typography>
    )}
    {video && (
      <Box sx={{ mb: 2 }}>
        <MediaVideo value={video} />
      </Box>
    )}
    <DialogueTranscript speakerA={speakerA} speakerB={speakerB} lines={lines} />
  </Box>
);

const VideoLessonView: React.FC<VideoLessonBlock> = ({ title, video, audio, content }) => (
  <Box sx={{ width: "100%", maxWidth: 720, mx: "auto", px: { xs: 1, sm: 2 } }}>
    <Typography sx={{ fontWeight: 800, fontSize: "1.2rem", mb: 1.5 }}>{title}</Typography>
    <MediaVideo value={video} />
    {audio && (
      <Box sx={{ mt: 1.5 }}>
        <MediaAudio value={audio} />
      </Box>
    )}
    {content && (
      <Box sx={{ mt: 2, lineHeight: 1.7, color: "#374151" }}>
        <RichText data={content} />
      </Box>
    )}
  </Box>
);

const GrammarPointView: React.FC<GrammarPointBlock> = ({ title, points }) => (
  <Box sx={{ width: "100%", maxWidth: 640, mx: "auto", px: { xs: 1, sm: 2 } }}>
    {title && (
      <Typography sx={{ fontWeight: 800, fontSize: "1.2rem", mb: 2 }}>{title}</Typography>
    )}
    {(points ?? []).map((point, index) => (
      <Box key={point.id ?? index} sx={{ ...CARD_SX, mb: 2 }}>
        <Typography
          sx={{ fontWeight: 800, fontSize: "1.15rem", mb: 1, color: "#B43D20" }}
        >
          {point.pattern}
        </Typography>
        <Box sx={{ lineHeight: 1.7, color: "#374151" }}>
          {/* Worked examples are `exampleSentence` blocks inside this, which is
              why there is no separate examples array to render. */}
          <RichText data={point.explanation} />
        </Box>
      </Box>
    ))}
  </Box>
);

const VocabListView: React.FC<VocabListBlock> = ({ title, intro, terms, layout }) => {
  const list = (terms ?? []).map((t) => term(t as Term | number)).filter((t): t is Term => t !== null);

  const header = (
    <>
      {title && (
        <Typography sx={{ fontWeight: 800, fontSize: "1.2rem", mb: 1 }}>{title}</Typography>
      )}
      {intro && (
        <Box sx={{ mb: 2, color: "#374151", lineHeight: 1.7 }}>
          <RichText data={intro} />
        </Box>
      )}
    </>
  );

  if (layout === "spotlight") {
    /*
     * One character per screen. The old flashcard player generated these from a
     * hardcoded table; they are authored exercises now, so the block renders
     * whatever terms it was given rather than one fixed set.
     */
    return (
      <Box sx={{ width: "100%", height: "100%" }}>
        {header}
        {list.map((t) => (
          <CharacterSpotlight key={t.id} term={t} />
        ))}
      </Box>
    );
  }

  if (layout === "flashcards") {
    /*
     * Replaces `flashcardDeck`, whose cards and audio were two index-coupled
     * parallel arrays that 9 of 11 surveyed lessons had fallen out of step on.
     * A term carries its own audio, so there is nothing to couple.
     */
    const cards: FlashcardReviewTerm[] = list.map((t) => ({
      term: termText(t, "plain"),
      audioUrl: termAudio(t),
      imageUrl: termImage(t),
      hasScript: Boolean(t.japanese?.trim() || t.katakana?.trim()),
    }));
    return (
      <Box sx={{ width: "100%", maxWidth: 720, mx: "auto", px: { xs: 1, sm: 2 } }}>
        {header}
        <FlashcardReview terms={cards} />
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", maxWidth: 640, mx: "auto", px: { xs: 1, sm: 2 } }}>
      {header}
      <Box
        sx={
          layout === "grid"
            ? { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 1.5 }
            : { display: "flex", flexDirection: "column", gap: 1 }
        }
      >
        {list.map((t) => (
          <TermRow key={t.id} term={t} withImage={layout === "grid"} />
        ))}
      </Box>
    </Box>
  );
};

/** One vocabulary entry: the written form with furigana, its reading and gloss. */
const TermRow: React.FC<{ term: Term; withImage?: boolean }> = ({ term: t, withImage }) => {
  const rendered = renderableTerm(t, "furigana");
  const audio = termAudio(t);

  return (
    <Box sx={{ ...CARD_SX, py: 1.5, display: "flex", flexDirection: "column", gap: 0.5 }}>
      {withImage && <MediaImage value={t.image} size="thumbnail" />}
      <Box sx={{ fontSize: "1.2rem", fontWeight: 700 }}>
        {rendered?.kind === "ruby" ? <Ruby segments={rendered.segments} /> : rendered?.text}
      </Box>
      {t.romaji && (
        <Typography sx={{ fontSize: "0.9rem", color: "text.secondary", fontStyle: "italic" }}>
          {t.romaji}
        </Typography>
      )}
      {t.meaning && <Typography sx={{ fontSize: "0.95rem" }}>{t.meaning}</Typography>}
      {audio && <MediaAudio value={t.audio} />}
    </Box>
  );
};

const MediaFigureView: React.FC<MediaFigureBlock> = ({ image, audio, video, caption }) => (
  <Box
    component="figure"
    sx={{ width: "100%", maxWidth: 560, mx: "auto", my: 2, px: { xs: 1, sm: 2 } }}
  >
    {/* Exactly one of the three is set — enforced by the block's own validate. */}
    <MediaImage value={image} size="wide" />
    <MediaAudio value={audio} />
    <MediaVideo value={video} />
    {caption && (
      <Typography
        component="figcaption"
        sx={{ mt: 0.75, fontSize: "0.85rem", color: "text.secondary" }}
      >
        {caption}
      </Typography>
    )}
  </Box>
);

// ── Practice ─────────────────────────────────────────────────────────────────

const MatchPairsView: React.FC<MatchPairsBlock & { onResult?: ResultCallback }> = ({
  instructions,
  terms,
  pairing,
  onResult,
}) => {
  const list = (terms ?? []).map((t) => term(t as Term | number)).filter((t): t is Term => t !== null);

  if (pairing === "audio") {
    const pairs: MediaMatchPair[] = list.map((t) => ({
      phrase: termText(t, "plain"),
      audioUrl: termAudio(t) ?? "",
      imageUrl: termImage(t) ?? "",
    }));
    return <MatchDotsMedia pairs={pairs} instructions={instructions ?? undefined} onResult={onResult} />;
  }

  /*
   * `DotMatchPair` calls its two sides `hiragana` and `katakana` — it was written
   * for the kana exercise and the names stuck. Structurally they are just the
   * left and right columns, which is why every pairing can use it. Renaming them
   * belongs with the 4b rewrite of that component, not here.
   */
  const pairs: DotMatchPair[] = list
    .map((t) => {
      const written = termText(t, "plain");
      const audio = termAudio(t);

      // Katakana is withheld for the moment, so "kana" no longer pairs
      // hiragana with katakana (t.katakana ?? ""). It now pairs the term's
      // audio (left, no label — see MatchDots's audio-only card) with its
      // hiragana form (right).
      if (pairing === "kana") return { hiragana: "", katakana: written, audio };

      return {
        hiragana: written,
        katakana: pairing === "reading" ? termText(t, "reading") : termText(t, "meaning"),
        audio,
      };
    })
    /*
     * Drop pairs whose two sides came out the same.
     *
     * `termText` falls back when a field is missing — deliberately, because a gap
     * mid-sentence is worse than showing the romaji. In a *matching* exercise
     * that fallback is actively wrong: a term with no `meaning` yields "match
     * Hajimemashite to Hajimemashite", which is not an exercise, and 24 of 41
     * terms are in exactly that state. Rendering it would look like a working
     * screen, so it is dropped here and `npm run content:verify` reports it as a
     * failure rather than leaving it to be noticed by a learner.
     *
     * The "kana" pairing has an empty `hiragana` by design (its left card is
     * audio-only), which makes the recording load-bearing rather than
     * decorative: the clip *is* the left card. A term without one renders a
     * greyed-out speaker with no label, and a second such term renders an
     * identical one — nothing distinguishes the rows, so the learner cannot
     * solve the screen rather than merely getting less out of it. Dropped for
     * the same reason an identical pair is, and reported by `content:verify`.
     */
    .filter((pair) =>
      pairing === "kana"
        ? pair.katakana !== "" && Boolean(pair.audio)
        : pair.hiragana !== "" && pair.katakana !== "" && pair.hiragana !== pair.katakana
    );

  // Fewer than two pairs is not a matching exercise. Nothing renders, which is
  // the same choice `RenderBlock` makes everywhere: better an absent screen than
  // a broken one, with the report coming from `content:verify`.
  if (pairs.length < 2) return null;

  /*
   * `DotMatch` defaults its heading to the kana wording it was written for,
   * which is wrong for the two pairings that also reach it. Blank instructions
   * get the heading for the pairing on screen instead of that one sentence.
   */
  const defaultHeading =
    pairing === "kana"
      ? "Match each audio clip to its hiragana"
      : pairing === "reading"
        ? "Match each word to its reading"
        : "Match each word to its meaning";

  return (
    <DotMatch
      pairs={pairs}
      heading={instructions?.trim() || defaultHeading}
      onResult={onResult}
      keepLeftOrder={pairing === "kana"}
    />
  );
};

const ListenAndChooseView: React.FC<ListenAndChooseBlock & { onResult?: ResultCallback }> = ({
  term: correct,
  distractors,
  onResult,
}) => {
  const pool = (distractors ?? [])
    .map((t) => term(t as Term | number))
    .filter((t): t is Term => t !== null)
    .map((t) => ({ phrase: termText(t, "plain"), imageUrl: termImage(t) }));

  return (
    <MatchAudioExercisePlaceholder
      item={{
        phrase: termText(correct, "plain"),
        // The clip is the term's own audio — there is no per-exercise audio
        // field that could point at a different word.
        audioUrl: termAudio(correct),
        imageUrl: termImage(correct),
        checkpointPool: pool.length ? pool : undefined,
      }}
      onResult={onResult}
    />
  );
};

const BuildSentenceView: React.FC<
  BuildSentenceBlock & { lessonTerms?: Term[]; onResult?: ResultCallback }
> = ({ instructions, term: subject, tiles, correctSequence, tileScript, lessonTerms, onResult }) => {
  /*
   * The romaji conversion used to happen at render time on a code path chosen by
   * a checkbox named `bonus` — so the same stored tiles produced two different
   * exercises depending on which content batch the lesson came from. `tileScript`
   * is that decision, authored.
   */
  const convert = (values: string[]) =>
    tileScript === "romaji" ? kanaTilesToRomaji(values) : values;

  /*
   * A tile is authored as a plain string — "あ", not a term reference — so
   * there is nothing on the block itself to play. Reading/writing lessons
   * introduce every kana as its own term earlier in the same lesson — in a
   * `vocabList`/`spotlight` step, or in prose as a `termRef`, both of which
   * `collectLessonTerms` walks — so a tile's own audio is found by matching
   * its written form against those.
   * A tile with no matching term, or a term with no recording yet, plays
   * nothing — same silent-gap handling as every other audio button here.
   */
  const audioForTile = (tile: string): string | undefined => {
    const match = (lessonTerms ?? []).find(
      (t) => t.japanese === tile || t.romaji === tile || termText(t, "plain") === tile
    );
    return termAudio(match);
  };

  /*
   * Some authored answers repeat a character — "おおい" needs お twice — but
   * the tile bank was authored with one of each, which makes the puzzle
   * impossible to actually place: the second お simply is not there to drag.
   * Padded rather than fixed in the content, because the same authoring
   * habit (one tile per distinct kana) is likely elsewhere too and this
   * makes every instance of it solvable rather than only the ones noticed.
   * Extra tiles are appended after the authored set so the original bank
   * order is otherwise unchanged.
   */
  const withEnoughTiles = (available: string[], needed: string[]): string[] => {
    const have = new Map<string, number>();
    for (const t of available) have.set(t, (have.get(t) ?? 0) + 1);

    const extra: string[] = [];
    const seen = new Map<string, number>();
    for (const n of needed) {
      const count = (seen.get(n) ?? 0) + 1;
      seen.set(n, count);
      if (count > (have.get(n) ?? 0)) extra.push(n);
    }
    return extra.length ? [...available, ...extra] : available;
  };

  const resolvedTiles = withEnoughTiles(tiles ?? [], correctSequence ?? []);

  return (
    <DragDropCombination
      prompt={instructions || "Drag the tiles into the correct order"}
      options={convert(resolvedTiles)}
      correctSequence={convert(correctSequence ?? [])}
      tileAudio={resolvedTiles.map(audioForTile)}
      imageUrl={termImage(subject)}
      audioUrl={termAudio(subject)}
      onResult={onResult}
    />
  );
};

const SpeakAndScoreView: React.FC<SpeakAndScoreBlock> = ({ term: target, transcript, video }) => {
  const exercise: PronunciationExerciseData = {
    type: "pronunciationExercise",
    number: 0,
    phrase: termText(target, "plain"),
    // Reference audio for scoring, from the term. Never the video's track — the
    // scorer has nothing to grade against without it.
    audioUrl: termAudio(target),
    videoUrl: video ? (typeof video === "object" ? (video.url ?? undefined) : undefined) : undefined,
    transcript: transcript ?? undefined,
  };

  return <PronunciationExercise exercise={exercise} />;
};

export default RenderBlock;
