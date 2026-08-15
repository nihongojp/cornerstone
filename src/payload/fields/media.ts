import type { TextField } from "payload";

/*
 * Media on components is a plain URL string, not an `upload` relationship.
 *
 * Decided in #12: the existing Cloudinary URLs are grandfathered and carried
 * across verbatim by the import, so every component media field has to be able
 * to hold an arbitrary absolute URL. The `media` collection (Vercel Blob) is
 * for *new* uploads — paste the uploaded file's URL into one of these fields.
 *
 * Placeholder sentinels ("PLACEHOLDER_AUDIO_URL", …) are dropped to empty at
 * import so an unfilled slot reads as unfilled rather than as a broken URL.
 */

const HOW_TO_FILL =
  "Paste an absolute URL. Existing Cloudinary URLs work as-is; " +
  "for new files, upload to Media first and paste the resulting URL here.";

type MediaUrlOptions = {
  name: string;
  label?: string;
  description?: string;
};

export function mediaUrl({ name, label, description }: MediaUrlOptions): TextField {
  return {
    name,
    type: "text",
    label,
    admin: {
      description: description ? `${description} ${HOW_TO_FILL}` : HOW_TO_FILL,
    },
  };
}

export const audioUrl = (description?: string) =>
  mediaUrl({ name: "audioUrl", label: "Audio URL", description });

export const imageUrl = (description?: string) =>
  mediaUrl({ name: "imageUrl", label: "Image URL", description });

export const videoUrl = (description?: string) =>
  mediaUrl({ name: "videoUrl", label: "Video URL", description });
