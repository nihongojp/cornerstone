import "server-only";
import type { AirtableRecord } from "./client";
import type {
  LessonDoc,
  LessonListItem,
  LessonExercise,
  NewLessonDoc,
  NewLessonListItem,
  NewLessonItem,
  ResourceGroup,
} from "../types/lessons";

/*
 * Airtable record → the exact TS shapes the lesson players already consume.
 *
 * Lesson bodies are stored as JSON in long-text fields, which means an author
 * can save a record with a stray comma. Every parse here fails soft: a bad
 * record is logged and skipped rather than throwing, so one malformed lesson
 * can't take down the whole listing. The players already render an empty state
 * when a lesson is missing.
 */

function text(record: AirtableRecord, field: string): string | undefined {
  const value = record.fields[field];
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function bool(record: AirtableRecord, field: string): boolean {
  return record.fields[field] === true;
}

function parseJson<T>(
  record: AirtableRecord,
  field: string,
  fallback: T,
  label: string
): T {
  const raw = text(record, field);
  if (raw === undefined) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(
      `[airtable] ${label}: field "${field}" is not valid JSON (record ${record.id}) — using fallback.`,
      err instanceof Error ? err.message : err
    );
    return fallback;
  }
}

export function toLessonListItem(record: AirtableRecord): LessonListItem | null {
  const slug = text(record, "Slug");
  if (!slug) {
    console.error(`[airtable] Lessons: record ${record.id} has no Slug — skipped.`);
    return null;
  }

  return {
    // Airtable's record id stands in for the Mongo _id. Lookups go by slug
    // first, so this is only ever a fallback identifier.
    _id: record.id,
    slug,
    title: text(record, "Title") ?? "",
    version: text(record, "Version") ?? "",
    cardTitle: text(record, "CardTitle"),
    flashcards: parseJson<string[]>(record, "Flashcards", [], "Lessons"),
    prefecture: text(record, "Prefecture") ?? "",
    isActive: bool(record, "IsActive"),
  };
}

export function toLessonDoc(record: AirtableRecord): LessonDoc | null {
  const base = toLessonListItem(record);
  if (!base) return null;

  return {
    ...base,
    flashcardsAudio: parseJson<string[]>(record, "FlashcardsAudio", [], "Lessons"),
    funFact: text(record, "FunFact"),
    notes: text(record, "Notes"),
    exercises: parseJson<LessonExercise[]>(record, "Exercises", [], "Lessons"),
    achievement: parseJson<{ title: string; xp: number } | undefined>(
      record,
      "Achievement",
      undefined,
      "Lessons"
    ),
    tags: parseJson<string[]>(record, "Tags", [], "Lessons"),
  };
}

export function toNewLessonListItem(record: AirtableRecord): NewLessonListItem | null {
  const slug = text(record, "Slug");
  if (!slug) {
    console.error(`[airtable] NewLessons: record ${record.id} has no Slug — skipped.`);
    return null;
  }

  return {
    _id: record.id,
    // Mongo calls this "lesson", not "title" — the two collections never got
    // normalised, and the players still expect the difference.
    lesson: text(record, "Lesson") ?? "",
    slug,
    cardTitle: text(record, "CardTitle"),
    isActive: bool(record, "IsActive"),
    tags: parseJson<string[]>(record, "Tags", [], "NewLessons"),
  };
}

export function toNewLessonDoc(record: AirtableRecord): NewLessonDoc | null {
  const base = toNewLessonListItem(record);
  if (!base) return null;

  return {
    ...base,
    items: parseJson<NewLessonItem[]>(record, "Items", [], "NewLessons"),
    nextSlug: text(record, "NextSlug"),
  };
}

export function toResourceGroup(record: AirtableRecord): ResourceGroup | null {
  const id = text(record, "ResourceId");
  if (!id) {
    console.error(`[airtable] Resources: record ${record.id} has no ResourceId — skipped.`);
    return null;
  }

  return {
    id,
    category: text(record, "Category") ?? "",
    items: parseJson<unknown[]>(record, "Items", [], "Resources"),
  };
}
