import type { UploadField } from "payload";

/*
 * Media on a component is an `upload` relationship to the `media` collection.
 *
 * It used to be a `text` field holding a URL an author pasted in by hand,
 * decided in #12 when the Cloudinary catalogue was grandfathered in and every
 * field had to accept an arbitrary absolute URL. Those assets moved into the
 * private Blob store (`scripts/migrate/06-cloudinary-to-blob.ts`) and the
 * fields stayed free text, which cost three things worth naming:
 *
 *  - "No asset yet" was a string convention. A slot was empty if its value
 *    contained "PLACEHOLDER", a test that existed in seven separate copies
 *    across the codebase and disagreed with itself in two of them. Absence of
 *    a relationship says the same thing structurally, once.
 *  - Nothing connected a file to its uses. Renaming or replacing one broke
 *    every block that had pasted its URL, silently, with no way to find them.
 *  - Alt text had nowhere to live. The `media` row had it; the `<img>` was
 *    built from a string that did not.
 *
 * Three helpers rather than one polymorphic field, because the renderer has to
 * know statically whether it is emitting `<img>`, `<audio>` or `<video>` — and
 * because `filterOptions` then constrains the picker to the right kind of file
 * and is enforced on the server, not just in the admin UI.
 *
 * The `Url` suffix is gone from the field names: `audioUrl` holding a document
 * reference would be a lie. That rename is the bulk of the migration.
 */

type MediaFieldOptions = {
  /** Defaults to the kind — `image`, `audio`, `video`. */
  name?: string;
  label?: string;
  description?: string;
  required?: boolean;
};

type Kind = "image" | "audio" | "video";

const LABEL: Record<Kind, string> = {
  image: "Image",
  audio: "Audio",
  video: "Video",
};

function mediaField(kind: Kind, options: MediaFieldOptions = {}): UploadField {
  return {
    name: options.name ?? kind,
    type: "upload",
    relationTo: "media",
    label: options.label ?? LABEL[kind],
    required: options.required,
    /*
     * Server-enforced, unlike an admin-only hint: Payload validates the chosen
     * document against this on write, so an audio file cannot end up in an
     * image slot via the API either.
     */
    filterOptions: { mimeType: { contains: kind } },
    admin: {
      description: options.description,
    },
  };
}

export const imageField = (options?: MediaFieldOptions) => mediaField("image", options);
export const audioField = (options?: MediaFieldOptions) => mediaField("audio", options);
export const videoField = (options?: MediaFieldOptions) => mediaField("video", options);
