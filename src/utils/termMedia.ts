import { NewLessonItem } from "../lib/types/lessons";

// Shared media a term can carry — the same term (e.g. "Hajimemashite") may
// need its audio in a matchAudioExercise, its image in a matchingExercise,
// and its video in a page's "New terms" list.
export type TermMedia = {
  audioUrl?: string;
  videoUrl?: string;
  imageUrl?: string;
};

const MEDIA_KEYS: Array<keyof TermMedia> = ["audioUrl", "videoUrl", "imageUrl"];

export function isPlaceholderUrl(url?: unknown): boolean {
  if (typeof url !== "string" || !url) return true;
  return url.toUpperCase().includes("PLACEHOLDER");
}

function pickReal(url?: unknown): string | undefined {
  return typeof url === "string" && url && !isPlaceholderUrl(url) ? url : undefined;
}

// Case/punctuation-insensitive key so authored variants of the same term
// (e.g. "~ desu ka" vs "~desu ka.") resolve to the same registry entry.
function exactKey(term: string): string {
  return term.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Looser fallback key that also collapses runs of the same letter, so typo'd
// duplicates entered separately in MongoDB (e.g. "Konnnichiwa" vs
// "Konnichiwa", "Sumimasenn" vs "Sumimasen") still resolve to one term.
function fuzzyKey(term: string): string {
  return exactKey(term).replace(/(.)\1+/g, "$1");
}

// Same normalized-term comparison the registry uses internally, exposed so
// other lesson-processing code (e.g. checkpoint scoping) can group/match
// terms the same way media lookups do.
export function sameTerm(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  return exactKey(a) === exactKey(b) || fuzzyKey(a) === fuzzyKey(b);
}

function mergeMedia(base: TermMedia, extra: TermMedia): TermMedia {
  const merged: TermMedia = { ...base };
  for (const key of MEDIA_KEYS) {
    if (!merged[key] && extra[key]) merged[key] = extra[key];
  }
  return merged;
}

// "page" entries come from the intro/dialogue video pages where a term is
// first taught; "exercise" entries come from matchAudio/pronunciation/drag-
// and-drop/matching exercises that quiz that term later. The two are kept
// distinct because a term's exercise audio is often a separate, cleaner
// recording than its intro-page dialogue clip — see EntrySource priority
// note on buildTermMediaRegistry below.
type EntrySource = "page" | "exercise";

/**
 * Every (term, media) pair a single lesson item can contribute. An item may
 * introduce more than one term — a page contributes its own title plus each
 * of its `newTerms`/`terms`; a matchingExercise contributes one term per dot.
 */
function extractEntries(item: NewLessonItem): Array<{ term: string; media: TermMedia; source: EntrySource }> {
  const type = item.type as string;
  const any = item as any;
  const entries: Array<{ term: string; media: TermMedia; source: EntrySource }> = [];

  if (type === "page") {
    if (any.title) {
      entries.push({
        term: String(any.title),
        media: {
          audioUrl: any.audioUrl ?? any.audioURL ?? any.audio,
          videoUrl: any.videoUrl ?? any.videoURL ?? any.video,
        },
        source: "page",
      });
    }
    if (Array.isArray(any.newTerms)) {
      for (const t of any.newTerms) {
        if (!t || typeof t !== "object") continue;
        const term = t.term ?? t.word ?? t.text ?? t.Title ?? t.title;
        if (!term) continue;
        entries.push({
          term: String(term),
          media: { audioUrl: t.audioUrl ?? t.audio, videoUrl: t.videoUrl ?? t.video, imageUrl: t.imageUrl ?? t.image },
          source: "page",
        });
      }
    }
    if (Array.isArray(any.terms)) {
      for (const t of any.terms) {
        if (!t || typeof t !== "object" || !t.term) continue;
        entries.push({
          term: String(t.term),
          media: { audioUrl: t.audioUrl, videoUrl: t.videoUrl, imageUrl: t.imageUrl },
          source: "page",
        });
      }
    }
  }

  if (type === "matchingExercise" && Array.isArray(any.items)) {
    for (const m of any.items) {
      if (!m?.phrase) continue;
      entries.push({ term: String(m.phrase), media: { audioUrl: m.audioUrl, imageUrl: m.imageUrl }, source: "exercise" });
    }
  }

  if ((type === "matchAudioExercise" || type === "pronunciationExercise") && any.phrase) {
    entries.push({
      term: String(any.phrase),
      media: {
        audioUrl: any.audioUrl,
        // pronunciationExercise may also carry a dedicated practice video
        ...(type === "pronunciationExercise"
          ? { videoUrl: any.videoUrl ?? any.videoURL ?? any.video }
          : {}),
      },
      source: "exercise",
    });
  }

  if (type === "dragAndDropExercise") {
    const term = any.phrase ?? any._term ?? any.term;
    if (term) {
      entries.push({
        term: String(term),
        media: { audioUrl: any.audioUrl, imageUrl: any.imageUrl ?? any.image },
        source: "exercise",
      });
    }
  }

  return entries;
}

export type TermMediaRegistry = {
  exact: Map<string, TermMedia>;
  fuzzy: Map<string, TermMedia>;
};

/**
 * Scans every item in a lesson (in any order) and collects the real,
 * non-placeholder media already associated with each term, so it can be
 * reused wherever else that term appears.
 *
 * Exercise audio (matchAudio/pronunciation/dragAndDrop/matchingExercise)
 * takes priority over an intro page's dialogue audio when both exist for the
 * same term: exercise clips are usually a separate, purpose-recorded single-
 * phrase pronunciation, distinct from the fuller intro-page dialogue clip, so
 * they're the more useful default to reuse for quizzing that term elsewhere.
 * Processing exercise entries before page entries achieves this because
 * mergeMedia only fills keys that aren't already set.
 */
export function buildTermMediaRegistry(items: NewLessonItem[]): TermMediaRegistry {
  const exact = new Map<string, TermMedia>();
  const fuzzy = new Map<string, TermMedia>();

  const allEntries = items.flatMap((item) => extractEntries(item));
  const ordered = [
    ...allEntries.filter((e) => e.source === "exercise"),
    ...allEntries.filter((e) => e.source === "page"),
  ];

  for (const { term, media } of ordered) {
    const realMedia: TermMedia = {
      audioUrl: pickReal(media.audioUrl),
      videoUrl: pickReal(media.videoUrl),
      imageUrl: pickReal(media.imageUrl),
    };
    if (!realMedia.audioUrl && !realMedia.videoUrl && !realMedia.imageUrl) continue;

    const ek = exactKey(term);
    const fk = fuzzyKey(term);
    if (ek) exact.set(ek, mergeMedia(exact.get(ek) ?? {}, realMedia));
    if (fk) fuzzy.set(fk, mergeMedia(fuzzy.get(fk) ?? {}, realMedia));
  }

  return { exact, fuzzy };
}

export function resolveTermMedia(registry: TermMediaRegistry, term?: string): TermMedia | undefined {
  if (!term) return undefined;
  const ek = exactKey(term);
  if (ek && registry.exact.has(ek)) return registry.exact.get(ek);
  const fk = fuzzyKey(term);
  if (fk && registry.fuzzy.has(fk)) return registry.fuzzy.get(fk);
  return undefined;
}

/**
 * Fills placeholder/missing audio, video, and image fields on an item using
 * media already associated with the same term elsewhere in the lesson.
 * Never overwrites real media the item already carries. Returns a new item
 * (or the original reference when nothing changed) — the input is untouched.
 */
export function enrichItemWithTermMedia(item: NewLessonItem, registry: TermMediaRegistry): NewLessonItem {
  const type = item.type as string;
  const any = item as any;

  if (type === "page") {
    const title = any.title as string | undefined;
    const resolved = resolveTermMedia(registry, title);
    const next: any = { ...any };
    if (!pickReal(any.audioUrl) && !pickReal(any.audioURL) && !pickReal(any.audio) && resolved?.audioUrl) {
      next.audioUrl = resolved.audioUrl;
    }
    if (!pickReal(any.videoUrl) && !pickReal(any.videoURL) && !pickReal(any.video) && resolved?.videoUrl) {
      next.videoUrl = resolved.videoUrl;
    }
    if (Array.isArray(any.newTerms)) {
      next.newTerms = any.newTerms.map((t: any) => {
        if (!t || typeof t !== "object") return t;
        const term = t.term ?? t.word ?? t.text ?? t.Title ?? t.title;
        const r = resolveTermMedia(registry, term);
        return {
          ...t,
          audioUrl: pickReal(t.audioUrl ?? t.audio) ?? r?.audioUrl ?? t.audioUrl,
          videoUrl: pickReal(t.videoUrl ?? t.video) ?? r?.videoUrl ?? t.videoUrl,
        };
      });
    }
    if (Array.isArray(any.terms)) {
      next.terms = any.terms.map((t: any) => {
        if (!t || typeof t !== "object" || !t.term) return t;
        const r = resolveTermMedia(registry, t.term);
        return {
          ...t,
          audioUrl: pickReal(t.audioUrl) ?? r?.audioUrl ?? t.audioUrl,
          videoUrl: pickReal(t.videoUrl) ?? r?.videoUrl ?? t.videoUrl,
          imageUrl: pickReal(t.imageUrl) ?? r?.imageUrl ?? t.imageUrl,
        };
      });
    }
    return next;
  }

  if (type === "matchingExercise" && Array.isArray(any.items)) {
    return {
      ...any,
      items: any.items.map((m: any) => {
        const r = resolveTermMedia(registry, m?.phrase);
        return {
          ...m,
          audioUrl: pickReal(m?.audioUrl) ?? r?.audioUrl ?? m?.audioUrl,
          imageUrl: pickReal(m?.imageUrl) ?? r?.imageUrl ?? m?.imageUrl,
        };
      }),
    };
  }

  if ((type === "matchAudioExercise" || type === "pronunciationExercise") && any.phrase) {
    const r = resolveTermMedia(registry, any.phrase);
    // audioUrl is the dedicated reference clip for pronunciation — never
    // derived from a video track. Registry fill is an interim fallback only.
    const next: any = { ...any, audioUrl: pickReal(any.audioUrl) ?? r?.audioUrl ?? any.audioUrl };
    if (type === "matchAudioExercise") {
      next.imageUrl = pickReal(any.imageUrl) ?? r?.imageUrl ?? any.imageUrl;
    }
    if (type === "pronunciationExercise") {
      const existingVideo = pickReal(any.videoUrl) ?? pickReal(any.videoURL) ?? pickReal(any.video);
      next.videoUrl = existingVideo ?? r?.videoUrl ?? any.videoUrl;
      // Preserve an explicit Compass `transcript` when present; UI falls
      // back to `phrase` when this is absent.
      if (typeof any.transcript === "string" && any.transcript.trim()) {
        next.transcript = any.transcript;
      }
    }
    return next;
  }

  if (type === "dragAndDropExercise") {
    const term = any.phrase ?? any._term ?? any.term;
    if (!term) return item;
    const r = resolveTermMedia(registry, term);
    return {
      ...any,
      audioUrl: pickReal(any.audioUrl) ?? r?.audioUrl ?? any.audioUrl,
      imageUrl: pickReal(any.imageUrl ?? any.image) ?? r?.imageUrl ?? any.imageUrl,
    };
  }

  return item;
}
