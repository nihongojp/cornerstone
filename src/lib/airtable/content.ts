import "server-only";
import { listRecords, formulaValue } from "./client";
import {
  toLessonDoc,
  toLessonListItem,
  toNewLessonDoc,
  toNewLessonListItem,
  toResourceGroup,
} from "./adapters";
import type {
  LessonDoc,
  LessonListItem,
  NewLessonDoc,
  NewLessonListItem,
  ResourceGroup,
} from "../types/lessons";

/*
 * The content API. These replace the Express controllers that used to serve
 * /api/lessons, /api/newlessons and /api/resources.
 *
 * Cache tags let an Airtable automation push edits live within seconds
 * instead of waiting out the revalidate window — see api/revalidate/route.ts.
 */

export const TAGS = {
  lessons: "lessons",
  newLessons: "newlessons",
  resources: "resources",
  lesson: (slug: string) => `lesson:${slug}`,
  newLesson: (slug: string) => `newlesson:${slug}`,
};

export async function listLessons(params?: {
  prefecture?: string;
  includeInactive?: boolean;
}): Promise<LessonListItem[]> {
  const prefecture = (params?.prefecture || "").trim();

  const clauses: string[] = [];
  if (prefecture) clauses.push(`{Prefecture} = ${formulaValue(prefecture)}`);
  if (!params?.includeInactive) clauses.push("{IsActive}");

  const records = await listRecords("Lessons", {
    params: {
      filterByFormula: clauses.length ? `AND(${clauses.join(", ")})` : undefined,
    },
    tags: [TAGS.lessons],
  });

  return records.map(toLessonListItem).filter((l): l is LessonListItem => l !== null);
}

/**
 * Looks up by slug, then falls back to the original Mongo id so links like
 * /lesson/<ObjectId> that people already bookmarked keep working.
 */
export async function getLessonBySlug(
  slugOrLegacyId: string
): Promise<LessonDoc | null> {
  const key = String(slugOrLegacyId || "").trim();
  if (!key) return null;

  const records = await listRecords("Lessons", {
    params: {
      filterByFormula: `OR({Slug} = ${formulaValue(key)}, {SourceId} = ${formulaValue(key)})`,
      maxRecords: 1,
    },
    tags: [TAGS.lessons, TAGS.lesson(key)],
  });

  const record = records[0];
  return record ? toLessonDoc(record) : null;
}

export async function listNewLessons(params?: {
  includeInactive?: boolean;
}): Promise<NewLessonListItem[]> {
  const records = await listRecords("NewLessons", {
    params: {
      filterByFormula: params?.includeInactive ? undefined : "{IsActive}",
    },
    tags: [TAGS.newLessons],
  });

  return records
    .map(toNewLessonListItem)
    .filter((l): l is NewLessonListItem => l !== null);
}

export async function getNewLessonBySlug(slug: string): Promise<NewLessonDoc | null> {
  const key = String(slug || "").trim();
  if (!key) return null;

  const records = await listRecords("NewLessons", {
    params: {
      filterByFormula: `OR({Slug} = ${formulaValue(key)}, {SourceId} = ${formulaValue(key)})`,
      maxRecords: 1,
    },
    tags: [TAGS.newLessons, TAGS.newLesson(key)],
  });

  const record = records[0];
  return record ? toNewLessonDoc(record) : null;
}

export async function getResources(): Promise<ResourceGroup[]> {
  const records = await listRecords("Resources", { tags: [TAGS.resources] });
  return records.map(toResourceGroup).filter((r): r is ResourceGroup => r !== null);
}
