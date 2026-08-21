"use client";

import React from "react";
import { Box, Typography } from "@mui/material";
import LightbulbRoundedIcon from "@mui/icons-material/LightbulbRounded";
import ReportProblemRoundedIcon from "@mui/icons-material/ReportProblemRounded";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import {
  RichText as LexicalRichText,
  type JSXConvertersFunction,
} from "@payloadcms/richtext-lexical/react";

import { resolveMedia } from "../../lib/content/media";
import type { Prose } from "../../lib/content/prose";
import type {
  CalloutProseBlock,
  ExampleSentenceProseBlock,
  Media,
  RubyInlineBlock,
  Term,
  TermRefInlineBlock,
} from "../../payload/payload-types";

import MediaAudio from "../media/MediaAudio";
import MediaImage from "../media/MediaImage";
import MediaVideo from "../media/MediaVideo";
import Ruby from "./Ruby";
import TermRef from "./TermRef";

/*
 * Rich text on the front end. `<Typography>{item.content}</Typography>` becomes
 * `<RichText data={item.content} />`, and that is the whole change at the ~seven
 * render sites.
 *
 * Four converters are overridden; everything else is Payload's default.
 *
 * ── `upload`, and why not `next/image` ──────────────────────────────────────
 *
 * The default upload converter renders `next/image`. That cannot work here: the
 * Blob store is private and `/api/media/file/*` is auth-gated, and Next's
 * optimizer fetches the source itself, server-side, with no learner cookie — so
 * every gated image 403s and the optimizer serves an error in place of a picture.
 * The override goes through `components/media/*`, which are plain elements the
 * browser fetches with the cookie attached.
 *
 * It also switches on `mimeType`. A Lexical upload node has no `filterOptions`
 * equivalent, so the picker offers every file in the collection — choosing an
 * audio file and getting a broken `<img>` would be the author's most likely
 * first mistake.
 *
 * ── `ruby` and `termRef` ────────────────────────────────────────────────────
 *
 * The two inline blocks that make furigana authorable. See
 * `payload/fields/prose.ts` for why they are inline blocks rather than a custom
 * Lexical node, and `lib/content/furigana.ts` for what a term actually shows.
 */

type UploadNodeValue = Media | number | null | undefined;

/** Which element a file wants, from its own mime type rather than the field it sat in. */
function mediaKind(value: UploadNodeValue): "audio" | "image" | "video" {
  const mimeType = resolveMedia(value)?.mimeType ?? "";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  // Images are the default rather than a fourth "unknown" case: the back
  // catalogue predates `mimeType` being reliably set, and an `<img>` that fails
  // to load degrades better than nothing rendering at all.
  return "image";
}

const converters: JSXConvertersFunction = ({ defaultConverters }) => ({
  ...defaultConverters,

  upload: ({ node }) => {
    const value = node.value as UploadNodeValue;
    const caption =
      typeof node.fields === "object" && node.fields !== null && "caption" in node.fields
        ? String((node.fields as { caption?: unknown }).caption ?? "")
        : "";

    const element =
      mediaKind(value) === "audio" ? (
        <MediaAudio value={value} />
      ) : mediaKind(value) === "video" ? (
        <MediaVideo value={value} />
      ) : (
        <MediaImage value={value} size="card" />
      );

    if (!caption.trim()) return <Box sx={{ my: 2 }}>{element}</Box>;

    return (
      <Box component="figure" sx={{ my: 2, mx: 0 }}>
        {element}
        <Typography
          component="figcaption"
          sx={{ mt: 0.75, fontSize: "0.85rem", color: "text.secondary" }}
        >
          {caption}
        </Typography>
      </Box>
    );
  },

  /*
   * The block converters are typed by their own generated interface rather than
   * inferred. Payload types these entries as `JSXConverter<any>` — the map is
   * keyed by a block slug it cannot know at this point — so without an
   * annotation `node` is implicitly `any` and a renamed field would go
   * unnoticed. Naming the interface puts the block schema and the renderer back
   * under one check.
   */
  inlineBlocks: {
    ruby: ({ node }: BlockNode<RubyInlineBlock>) => (
      <Ruby segments={[{ base: node.fields.base, ruby: node.fields.ruby }]} />
    ),
    termRef: ({ node }: BlockNode<TermRefInlineBlock>) => (
      <TermRef
        term={node.fields.term as Term | number}
        display={node.fields.display}
        showAudio={node.fields.showAudio}
      />
    ),
  },

  blocks: {
    callout: ({ node }: BlockNode<CalloutProseBlock>) => <Callout {...node.fields} />,
    exampleSentence: ({ node }: BlockNode<ExampleSentenceProseBlock>) => (
      <ExampleSentence {...node.fields} />
    ),
  },
});

/** A block or inline-block node carrying a known set of fields. */
type BlockNode<TFields> = { node: { fields: TFields } };

const CALLOUT_TONE = {
  note: { colour: "#2563EB", Icon: InfoRoundedIcon },
  tip: { colour: "#B43D20", Icon: LightbulbRoundedIcon },
  warning: { colour: "#B45309", Icon: ReportProblemRoundedIcon },
} as const;

const Callout: React.FC<CalloutProseBlock> = ({ tone, title, content }) => {
  const { colour, Icon } = CALLOUT_TONE[tone] ?? CALLOUT_TONE.note;

  return (
    <Box
      sx={{
        my: 2,
        px: 2,
        py: 1.5,
        borderRadius: "14px",
        borderLeft: `4px solid ${colour}`,
        bgcolor: `${colour}0D`,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: title ? 0.5 : 0 }}>
        <Icon sx={{ fontSize: "1.05rem", color: colour }} />
        {title && (
          <Typography sx={{ fontWeight: 700, fontSize: "0.9rem", color: colour }}>
            {title}
          </Typography>
        )}
      </Box>
      <RichText data={content} disableContainer />
    </Box>
  );
};

const ExampleSentence: React.FC<ExampleSentenceProseBlock> = ({
  japanese,
  romaji,
  english,
  audio,
}) => (
  <Box sx={{ my: 2, pl: 1.5, borderLeft: "3px solid rgba(0,0,0,0.08)" }}>
    <Box sx={{ fontSize: { xs: "1.1rem", sm: "1.25rem" } }}>
      <RichText data={japanese} disableContainer />
    </Box>
    {romaji && (
      <Typography sx={{ fontSize: "0.9rem", color: "text.secondary", fontStyle: "italic" }}>
        {romaji}
      </Typography>
    )}
    {english && (
      <Typography sx={{ fontSize: "0.95rem", color: "#374151" }}>{english}</Typography>
    )}
    {audio && (
      <Box sx={{ mt: 0.75 }}>
        <MediaAudio value={audio} />
      </Box>
    )}
  </Box>
);

/**
 * Renders a rich-text document, or nothing when there is nothing to render.
 *
 * The `!data` guard matters more than it looks: every caller reaches this
 * through a field that used to be a string, and several of them decide whether a
 * whole screen exists by testing that field for truthiness. `optProse` in
 * `lib/content/prose.ts` is what makes an empty document read as absent; this is
 * the second line of defence for the paths that do not go through the adapters.
 */
export const RichText: React.FC<{
  data: Prose | null | undefined;
  className?: string;
  /** Drops the wrapper div — for prose nested inside prose. */
  disableContainer?: boolean;
}> = ({ data, className, disableContainer }) => {
  if (!data) return null;

  return (
    <LexicalRichText
      data={data as never}
      converters={converters}
      className={className}
      disableContainer={disableContainer}
    />
  );
};

export default RichText;
