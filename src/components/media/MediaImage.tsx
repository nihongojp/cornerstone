"use client";

import React from "react";
import { Box } from "@mui/material";

import { renderableImage, type MediaSize } from "../../lib/content/media";
import type { Media } from "../../payload/payload-types";

/*
 * An image from the `media` collection.
 *
 * ── Not `next/image`, and this is not an oversight ───────────────────────────
 *
 * The Blob store is private and `/api/media/file/*` is auth-gated. Next's image
 * optimizer fetches the source itself, server-side, without the learner's
 * cookie — so every gated image comes back 403 and the optimizer serves an error
 * instead of a picture. A plain `<img loading="lazy">` is fetched by the browser,
 * which does carry the cookie. See `payload/storage/vercelPrivateBlob.ts`.
 *
 * ── Absence renders nothing ─────────────────────────────────────────────────
 *
 * `null` for an unset relationship, and `null` for one that came back as a bare
 * id because the read did not ask for enough `depth`. Rendering a broken `<img>`
 * for either would be worse than rendering nothing, and `npm run content:verify`
 * is what turns the second case into a failure rather than a shrug.
 */
export const MediaImage: React.FC<{
  value: Media | number | null | undefined;
  /** Which generated variant to prefer. Files predating `imageSizes` have none. */
  size?: MediaSize;
  /** Overrides the file's own alt text. Rarely right — alt belongs on the file. */
  alt?: string;
  className?: string;
}> = ({ value, size, alt, className }) => {
  const image = renderableImage(value, size);
  if (!image) return null;

  return (
    <Box
      component="img"
      className={className}
      src={image.src}
      alt={alt ?? image.alt}
      /*
       * Explicit dimensions from the Media document so the layout does not jump
       * when the image arrives. `sx` sets the rendered size; the attributes are
       * there for the aspect ratio.
       */
      width={image.width}
      height={image.height}
      loading="lazy"
      sx={{ maxWidth: "100%", height: "auto", borderRadius: "12px" }}
    />
  );
};

export default MediaImage;
