import "server-only";
import { unstable_cache } from "next/cache";
import type { TypedUser, Where } from "payload";
import { payloadClient } from "./payload";
import { TAGS } from "./tags";
import { lessonHref, lessonReviewHref } from "./routes";
import { CONTENT_DEPTH, MEDIA_POPULATE } from "./depth";
import type { Lesson, Resource } from "../../payload/payload-types";

/*
 * The content API — the only module the app reads content through.
 *
 * ── One type system ─────────────────────────────────────────────────────────
 *
 * These lookups return Payload's own generated documents. Until Phase 4b they
 * returned hand-written view models from `lib/types/lessons.ts`, built by
 * `lib/content/adapters.ts` — shapes inherited from the Airtable services and
 * the Express controllers before them, which flattened a lesson's blocks into
 * `{ type: string; [key: string]: unknown }` so the players could discriminate
 * on which fields happened to be present.
 *
 * That was three parallel type systems for the same content, and adding a block
 * meant touching all three. Both of those files are gone and `payload-types.ts`
 * is the only one left: a renamed field is now a type error rather than a screen
 * that renders blank.
 *
 * The one thing the adapters did that was worth keeping is gone with them: they
 * normalised Payload's `T | null | undefined` down to `T | undefined`. Callers
 * check for absence directly instead, which is a little more verbose at each
 * site and one fewer transformation to keep in step.
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
    depth: CONTENT_DEPTH,
    populate: MEDIA_POPULATE,
    sort: ["order", "createdAt"],
    overrideAccess: false,
    pagination: false,
  });
  return result.docs;
}

// ── Lessons: the flashcard player's own listing ──────────────────────────────

const cachedListLessons = unstable_cache(
  async (prefecture: string, includeInactive: boolean): Promise<Lesson[]> => {
    const clauses: Where[] = [FLASHCARD];
    if (prefecture) clauses.push({ prefecture: { equals: prefecture } });
    if (!includeInactive) clauses.push(PUBLISHED);

    return findLessons(and(...clauses));
  },
  ["content", "listLessons"],
  { tags: [TAGS.lessons], revalidate: REVALIDATE }
);

export function listLessons(params?: {
  prefecture?: string;
  includeInactive?: boolean;
}): Promise<Lesson[]> {
  return cachedListLessons(
    (params?.prefecture || "").trim(),
    params?.includeInactive === true
  );
}

// ── New lessons: the step-through player's own listing ───────────────────────

const cachedListNewLessons = unstable_cache(
  async (includeInactive: boolean): Promise<Lesson[]> => {
    const clauses: Where[] = [STEP];
    if (!includeInactive) clauses.push(PUBLISHED);

    return findLessons(and(...clauses));
  },
  ["content", "listNewLessons"],
  { tags: [TAGS.newLessons], revalidate: REVALIDATE }
);

export function listNewLessons(params?: {
  includeInactive?: boolean;
}): Promise<Lesson[]> {
  return cachedListNewLessons(params?.includeInactive === true);
}

// ── Lesson detail: one route, either format ──────────────────────────────────

/**
 * Looks up by slug, then falls back to the original Mongo id so links like
 * /lessons/<ObjectId> that people already bookmarked keep working. Spans
 * both formats — the merged /lessons/<slug> route serves either, and the
 * runner reads `lesson.format` itself to pick how it renders.
 */
export function getLessonBySlug(slugOrLegacyId: string): Promise<Lesson | null> {
  const key = String(slugOrLegacyId || "").trim();
  if (!key) return Promise.resolve(null);

  // Built per call, because the per-slug tag depends on the argument and
  // `unstable_cache` fixes its tags when the wrapper is created, not when it
  // runs. The key goes in `keyParts` so each slug gets its own entry.
  return unstable_cache(
    async (): Promise<Lesson | null> => {
      const [lesson] = await findLessons(and(PUBLISHED, byKey(key)), 1);
      return lesson ?? null;
    },
    ["content", "getLessonBySlug", key],
    { tags: [TAGS.lessons, TAGS.newLessons, TAGS.lesson(key), TAGS.newLesson(key)], revalidate: REVALIDATE }
  )();
}

// ── What comes next ──────────────────────────────────────────────────────────

/*
 * The lesson that follows, as a link.
 *
 * `nextSlug` used to be a stored pointer. Course order replaces it (#18): the
 * next lesson is the next one along in the same course. Resolved as its own
 * one-row query rather than by loading the course and its lessons, so a long
 * course costs the same as a short one.
 *
 * Two changes in 4b. It is a *href* rather than a slug, because the two formats
 * play on different paths and the caller was hardcoding `/newlesson/` — a
 * flashcard lesson followed by a flashcard lesson would have linked into the
 * wrong player. And it no longer filters to step lessons only, which is what
 * made that latent: both formats have course order, and both now use it.
 */
type Neighbor = "next" | "prev";

function coursePlacement(lesson: Lesson): { courseId: number | string; order: number } | null {
  const courseId = typeof lesson.course === "object" ? lesson.course?.id : lesson.course;
  if (courseId === null || courseId === undefined || lesson.order === null || lesson.order === undefined) {
    return null;
  }
  return { courseId, order: lesson.order };
}

function neighborDirection(
  order: number,
  neighbor: Neighbor
): { clause: { greater_than: number } | { less_than: number }; sort: "order" | "-order" } {
  switch (neighbor) {
    case "next":
      return { clause: { greater_than: order }, sort: "order" };
    case "prev":
      return { clause: { less_than: order }, sort: "-order" };
    default: {
      const _exhaustive: never = neighbor;
      return _exhaustive;
    }
  }
}

async function findNeighborSlug(args: {
  courseId: number | string;
  format: Lesson["format"];
  order: number;
  neighbor: Neighbor;
  publishedOnly: boolean;
  user?: TypedUser;
}): Promise<string | undefined> {
  const { clause, sort } = neighborDirection(args.order, args.neighbor);
  const neighborWhere: Where = {
    format: { equals: args.format },
    course: { equals: args.courseId },
    order: clause,
  };

  const payload = await payloadClient();
  const result = await payload.find({
    collection: "lessons",
    where: args.publishedOnly ? and(PUBLISHED, neighborWhere) : and(neighborWhere),
    limit: 1,
    // Deliberately 0: this reads two fields, `slug` and `format`.
    depth: 0,
    sort,
    overrideAccess: false,
    ...(args.publishedOnly ? {} : { draft: true, user: args.user }),
  });

  return result.docs[0]?.slug;
}

/**
 * Published neighbour lookup. Whole-collection tags, not a per-slug one:
 * this answer changes when a *different* lesson is added, reordered or unpublished.
 */
function getPublishedNeighborHref(
  lesson: Lesson,
  neighbor: Neighbor,
  toHref: (slug: string) => string,
  cacheKey: readonly string[]
): Promise<string | undefined> {
  const placement = coursePlacement(lesson);
  if (!placement) return Promise.resolve(undefined);

  const { courseId, order } = placement;
  const format = lesson.format;

  return unstable_cache(
    async (): Promise<string | undefined> => {
      const slug = await findNeighborSlug({
        courseId,
        format,
        order,
        neighbor,
        publishedOnly: true,
      });
      return slug ? toHref(slug) : undefined;
    },
    [...cacheKey, String(courseId), String(format), String(order)],
    { tags: [TAGS.lessons, TAGS.newLessons], revalidate: REVALIDATE }
  )();
}

export function getNextLessonHref(lesson: Lesson): Promise<string | undefined> {
  return getPublishedNeighborHref(lesson, "next", lessonHref, [
    "content",
    "getNextLessonHref",
  ]);
}

/** The neighbouring lesson's term-review page, same course and format. */
export function getNeighborLessonReviewHref(
  lesson: Lesson,
  neighbor: Neighbor
): Promise<string | undefined> {
  return getPublishedNeighborHref(lesson, neighbor, lessonReviewHref, [
    "content",
    "getNeighborLessonReviewHref",
    neighbor,
  ]);
}

// ── Resources ────────────────────────────────────────────────────────────────

export const getResources = unstable_cache(
  async (): Promise<Resource[]> => {
    const payload = await payloadClient();
    const result = await payload.find({
      collection: "resources",
      where: PUBLISHED,
      /*
       * Was `depth: 0`, on the grounds that resources link out by URL and hold
       * no uploads. True while a link's description was a textarea; it is rich
       * text now, and prose can hold an image or a term reference. Same depth as
       * the lessons read so there is one number to reason about.
       */
      depth: CONTENT_DEPTH,
      populate: MEDIA_POPULATE,
      sort: "createdAt",
      overrideAccess: false,
      pagination: false,
    });
    return result.docs;
  },
  ["content", "getResources"],
  { tags: [TAGS.resources], revalidate: REVALIDATE }
);

// ── Resume ───────────────────────────────────────────────────────────────────

export type LessonRoute = {
  slug: string;
  title: string;
  /** The card/header title a learner actually sees, when the lesson has one. */
  cardTitle?: string;
  /** Which numbered lesson, across courses — the "Lesson 3" heading. */
  level: number;
  /** Which part of it — rendered as "Lesson 3.2". */
  part: number;
  prefecture: string;
  href: string;
};

/**
 * The lesson behind a progress row, whichever player it belongs to.
 *
 * Progress is recorded against a slug with no note of which system the lesson
 * came from, so resuming has to look across both — both formats resolve to
 * the same merged /lessons/<slug> route now, so there is no wrong-player
 * fallback to get wrong (the old fallback to /lesson/<slug>, the flashcard
 * player, was a known bug for step lessons — #20).
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
        cardTitle: lesson.cardTitle ?? undefined,
        level: lesson.level,
        part: lesson.part,
        prefecture: lesson.prefecture ?? "",
        href: lessonHref(lesson.slug),
      };
    },
    ["content", "getLessonRoute", key],
    {
      tags: [TAGS.lessons, TAGS.newLessons, TAGS.lesson(key), TAGS.newLesson(key)],
      revalidate: REVALIDATE,
    }
  )();
}

// ── Draft reads: the CMS preview panel, and nothing else ─────────────────────
/*
 * Everything above answers for the public site: published only, cached, tagged.
 * The three lookups below answer for Live Preview, and differ on every one of
 * those axes.
 *
 * They differ from the published lookups in one thing less than they used to.
 * Both paths now return the same raw Payload document: the wrapper used to have
 * to re-run `adapters.ts` on the client so preview would not grow a second copy
 * of the document-to-player mapping, and with no mapping left there is nothing
 * to re-run. `useLivePreview` merges the editor's unsaved form state into the
 * document and hands back another document of the same shape, which goes
 * straight to the same component the public path uses.
 *
 * Not wrapped in `unstable_cache`. A preview load is one query, once, so there
 * is nothing to win, and a cached draft is a wrong answer waiting to be served
 * to somebody.
 *
 * `overrideAccess: false` is kept, with the authenticated editor passed as
 * `user`. These reads stay on the same access rules as every other read rather
 * than being exempted from them — the caller has already proved who it is (see
 * `getPreviewEditor` in `lib/session.ts`).
 */

async function findDrafts(
  where: Where,
  user: TypedUser,
  limit = 0
): Promise<Lesson[]> {
  const payload = await payloadClient();
  const result = await payload.find({
    collection: "lessons",
    where,
    limit,
    // Same depth as the published path. If these drift, media renders on the
    // site and vanishes in the preview panel, or the reverse.
    depth: CONTENT_DEPTH,
    populate: MEDIA_POPULATE,
    draft: true,
    sort: ["order", "createdAt"],
    overrideAccess: false,
    user,
    pagination: false,
  });
  return result.docs;
}

/**
 * The draft behind a preview URL, raw. Spans both formats, same as
 * `getLessonBySlug` — one route, either format. The slug-then-`sourceId`
 * fallback is kept: a legacy id remains a valid way to reach a lesson, and
 * the preview URL is built from whatever the editor has open.
 */
export async function getDraftLesson(
  slugOrLegacyId: string,
  user: TypedUser
): Promise<Lesson | null> {
  const key = String(slugOrLegacyId || "").trim();
  if (!key) return null;

  const [lesson] = await findDrafts(byKey(key), user, 1);
  return lesson ?? null;
}

/**
 * `nextSlug` for a draft — the same course-order lookup as `nextSlugFor`, but
 * resolved against drafts too. An editor writing a course should see the lesson
 * they just added as the one that follows, not skip over it to the last
 * published one.
 */
async function getDraftNeighborHref(
  lesson: Lesson,
  user: TypedUser,
  neighbor: Neighbor,
  toHref: (slug: string) => string
): Promise<string | undefined> {
  const placement = coursePlacement(lesson);
  if (!placement) return undefined;

  const slug = await findNeighborSlug({
    courseId: placement.courseId,
    format: lesson.format,
    order: placement.order,
    neighbor,
    publishedOnly: false,
    user,
  });
  return slug ? toHref(slug) : undefined;
}

export function getDraftNextHref(
  lesson: Lesson,
  user: TypedUser
): Promise<string | undefined> {
  return getDraftNeighborHref(lesson, user, "next", lessonHref);
}

export function getDraftNeighborLessonReviewHref(
  lesson: Lesson,
  user: TypedUser,
  neighbor: Neighbor
): Promise<string | undefined> {
  return getDraftNeighborHref(lesson, user, neighbor, lessonReviewHref);
}

export async function getDraftResources(user: TypedUser): Promise<Resource[]> {
  const payload = await payloadClient();
  const result = await payload.find({
    collection: "resources",
    // Matches the published read above, for the same reason the two lesson
    // reads match: prose in a draft has to populate the same way.
    depth: CONTENT_DEPTH,
    populate: MEDIA_POPULATE,
    draft: true,
    sort: "createdAt",
    overrideAccess: false,
    user,
    pagination: false,
  });
  return result.docs;
}
