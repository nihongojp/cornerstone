import type { TextField } from "payload";

/*
 * Media on components is a plain URL string, not an `upload` relationship.
 *
 * Decided in #12, when the existing Cloudinary URLs were grandfathered and
 * carried across verbatim by the import, so every field had to hold an
 * arbitrary absolute URL. Those assets have since been migrated into the
 * private Blob store (`scripts/migrate/06-cloudinary-to-blob.ts`), so what these
 * fields hold in practice is now Payload's own `/api/media/file/<filename>`
 * route — but they remain free-text, and an absolute third-party URL still
 * works. Upload to `media`, then paste the resulting URL here.
 *
 * Placeholder sentinels ("PLACEHOLDER_AUDIO_URL", …) are dropped to empty at
 * import so an unfilled slot reads as unfilled rather than as a broken URL.
 */

const HOW_TO_FILL =
  "Upload to Media first, then paste the resulting URL here. " +
  "An absolute URL to an external file also works.";

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
