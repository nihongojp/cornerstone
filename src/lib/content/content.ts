import "server-only";
import { unstable_cache } from "next/cache";
import type { Where } from "payload";
import { payloadClient } from "./payload";
import { TAGS } from "./tags";
import {
  toLessonDoc,
  toLessonListItem,
  toNewLessonDoc,
  toNewLessonListItem,
  toResourceGroup,
} from "./adapters";
import type { Lesson } from "../../payload/payload-types";
import type {
  LessonDoc,
  LessonListItem,
  NewLessonDoc,
  NewLessonListItem,
  ResourceGroup,
} from "../types/lessons";

/*
 * The content API — the only module the app reads content through.
 *
 * The five exported lookups keep the signatures and return types they had when
 * this was backed by Airtable, and before that by the Express controllers that
 * served /api/lessons, /api/newlessons and /api/resources. Everything about
 * the storage change lives behind them.
 *
 * Reads go through Payload's local API — an in-process database query, not an
 * HTTP call — so there is no `fetch` for Next to cache and the caching is
 * explicit here instead. Each lookup is wrapped once, tagged, and invalidated
 * by the collection hooks in `src/payload/hooks/revalidate.ts` the moment an
 * editor saves. `revalidate` is the backstop for anything that misses a hook.
 *
 * `overrideAccess: false` keeps these reads on the same public access rules the
 * REST API enforces, so an unpublished lesson cannot leak through the app even
 * if a query below forgets to filter for it.
 */

export { TAGS } from "./tags";

/** An hour. Content edits arrive by tag; this only covers a missed hook. */
const REVALIDATE = 3600;

/**
 * Which player renders a lesson. The two lists, the two URL families and the
 * dashboard map all key off it — see `format` on the Lessons collection.
 */
const FLASHCARD: Where = { format: { equals: "flashcard" } };
const STEP: Where = { format: { equals: "step" } };
const PUBLISHED: Where = { _status: { equals: "published" } };

function and(...clauses: Where[]): Where {
  return { and: clauses };
}

/** Slug first, then the Mongo id old links still carry. */
function byKey(key: string): Where {
  return { or: [{ slug: { equals: key } }, { sourceId: { equals: key } }] };
}

async function findLessons(where: Where, limit = 0): Promise<Lesson[]> {
  const payload = await payloadClient();
  const result = await payload.find({
    collection: "lessons",
    where,
    limit,
    // Blocks are stored inline, so nothing here needs a relationship resolved —
    // `course` is only ever used as an id, by the next-lesson lookup below.
    depth: 0,
    sort: ["order", "createdAt"],
    overrideAccess: false,
    pagination: false,
  });
  return result.docs;
}

// ── Lessons: the flashcard player ────────────────────────────────────────────

const cachedListLessons = unstable_cache(
  async (prefecture: string, includeInactive: boolean): Promise<LessonListItem[]> => {
    const clauses: Where[] = [FLASHCARD];
    if (prefecture) clauses.push({ prefecture: { equals: prefecture } });
    if (!includeInactive) clauses.push(PUBLISHED);

    return (await findLessons(and(...clauses))).map(toLessonListItem);
  },
  ["content", "listLessons"],
  { tags: [TAGS.lessons], revalidate: REVALIDATE }
);

export function listLessons(params?: {
  prefecture?: string;
  includeInactive?: boolean;
}): Promise<LessonListItem[]> {
  return cachedListLessons(
    (params?.prefecture || "").trim(),
    params?.includeInactive === true
  );
}

/**
 * Looks up by slug, then falls back to the original Mongo id so links like
 * /lesson/<ObjectId> that people already bookmarked keep working.
 */
export function getLessonBySlug(slugOrLegacyId: string): Promise<LessonDoc | null> {
  const key = String(slugOrLegacyId || "").trim();
  if (!key) return Promise.resolve(null);

  // Built per call, because the per-slug tag depends on the argument and
  // `unstable_cache` fixes its tags when the wrapper is created, not when it
  // runs. The key goes in `keyParts` so each slug gets its own entry.
  return unstable_cache(
    async (): Promise<LessonDoc | null> => {
      const [lesson] = await findLessons(and(FLASHCARD, PUBLISHED, byKey(key)), 1);
      return lesson ? toLessonDoc(lesson) : null;
    },
    ["content", "getLessonBySlug", key],
    { tags: [TAGS.lessons, TAGS.lesson(key)], revalidate: REVALIDATE }
  )();
}

// ── New lessons: the step-through player ─────────────────────────────────────

const cachedListNewLessons = unstable_cache(
  async (includeInactive: boolean): Promise<NewLessonListItem[]> => {
    const clauses: Where[] = [STEP];
    if (!includeInactive) clauses.push(PUBLISHED);

    return (await findLessons(and(...clauses))).map(toNewLessonListItem);
  },
  ["content", "listNewLessons"],
  { tags: [TAGS.newLessons], revalidate: REVALIDATE }
);

export function listNewLessons(params?: {
  includeInactive?: boolean;
}): Promise<NewLessonListItem[]> {
  return cachedListNewLessons(params?.includeInactive === true);
}

/*
 * `nextSlug` used to be a stored pointer to the lesson that follows. Course
 * order replaces it (#18): the next lesson is the next one along in the same
 * course. Resolved as its own one-row query rather than by loading the course
 * and its lessons, so a long course costs the same as a short one.
 */
async function nextSlugFor(lesson: Lesson): Promise<string | undefined> {
  const courseId = typeof lesson.course === "object" ? lesson.course?.id : lesson.course;
  if (courseId === null || courseId === undefined || lesson.order === null || lesson.order === undefined) {
    return undefined;
  }

  const payload = await payloadClient();
  const result = await payload.find({
    collection: "lessons",
    where: and(STEP, PUBLISHED, {
      course: { equals: courseId },
      order: { greater_than: lesson.order },
    }),
    limit: 1,
    depth: 0,
    sort: "order",
    overrideAccess: false,
  });

  return result.docs[0]?.slug;
}

export function getNewLessonBySlug(slug: string): Promise<NewLessonDoc | null> {
  const key = String(slug || "").trim();
  if (!key) return Promise.resolve(null);

  return unstable_cache(
    async (): Promise<NewLessonDoc | null> => {
      const [lesson] = await findLessons(and(STEP, PUBLISHED, byKey(key)), 1);
      if (!lesson) return null;
      return toNewLessonDoc(lesson, await nextSlugFor(lesson));
    },
    ["content", "getNewLessonBySlug", key],
    // Tagged with the lessons tag too: an edit to the *next* lesson changes
    // this document's `nextSlug`, and only the whole-collection tag catches it.
    { tags: [TAGS.newLessons, TAGS.newLesson(key)], revalidate: REVALIDATE }
  )();
}

// ── Resources ────────────────────────────────────────────────────────────────

export const getResources = unstable_cache(
  async (): Promise<ResourceGroup[]> => {
    const payload = await payloadClient();
    const result = await payload.find({
      collection: "resources",
      where: PUBLISHED,
      depth: 0,
      sort: "createdAt",
      overrideAccess: false,
      pagination: false,
    });
    return result.docs.map(toResourceGroup);
  },
  ["content", "getResources"],
  { tags: [TAGS.resources], revalidate: REVALIDATE }
);

// ── Resume ───────────────────────────────────────────────────────────────────

export type LessonRoute = {
  slug: string;
  title: string;
  version: string;
  prefecture: string;
  /** Where this lesson actually plays — the two formats live on different paths. */
  href: string;
};

/**
 * The lesson behind a progress row, whichever player it belongs to.
 *
 * Progress is recorded against a slug with no note of which system the lesson
 * came from, so resuming has to look across both — the old lookup only saw
 * flashcard lessons and sent everything else to /lesson/<slug>, which is the
 * wrong player for a step lesson (#20).
 */
export function getLessonRoute(slugOrLegacyId: string): Promise<LessonRoute | null> {
  const key = String(slugOrLegacyId || "").trim();
  if (!key) return Promise.resolve(null);

  return unstable_cache(
    async (): Promise<LessonRoute | null> => {
      const [lesson] = await findLessons(and(PUBLISHED, byKey(key)), 1);
      if (!lesson) return null;

      return {
        slug: lesson.slug,
        title: lesson.title,
        version: lesson.version ?? "",
        prefecture: lesson.prefecture ?? "",
        href:
          lesson.format === "flashcard"
            ? `/lesson/${lesson.slug}`
            : `/newlesson/${lesson.slug}`,
      };
    },
    ["content", "getLessonRoute", key],
    {
      tags: [TAGS.lessons, TAGS.newLessons, TAGS.lesson(key), TAGS.newLesson(key)],
      revalidate: REVALIDATE,
    }
  )();
}
