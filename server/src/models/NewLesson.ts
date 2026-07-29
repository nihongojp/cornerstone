import { Schema, model } from "mongoose";

// Intentionally loose item schema — newlessons has richer, evolving exercise types
// (pronunciationExercise, matchingExercise, matchAudioExercise, etc.) not yet in the
// lessons enum. strict:false lets MongoDB documents pass through without validation
// rejection while we stabilise the shape.
//
// pronunciationExercise item fields (edit in Compass; all optional except type/phrase):
//   type: "pronunciationExercise"
//   phrase: string            — term key + default transcript fallback
//   transcript?: string       — longer text shown under the video (falls back to phrase)
//   videoUrl?: string         — practice video (UI only; not used as reference audio)
//   audioUrl?: string         — dedicated reference audio clip (NOT derived from video)
// Hand-authored items keyed by `phrase` are reused at expand time so these
// fields survive checkpoint regeneration.
const NewLessonItemSchema = new Schema({}, { strict: false, _id: false });

const NewLessonSchema = new Schema(
  {
    // "lesson" is the human-readable title string stored in the DB (e.g. "Lesson 1 V1").
    // Divergence from lessons: lessons uses "title"; newlessons uses "lesson".
    // Flag: when merging the two collections, normalise to "title" on both sides.
    lesson: { type: String, required: true },
    // Editable heading shown on the Lessons list card. Falls back to the
    // auto-computed "Lesson {n}.{m}" (derived from slug) when left blank.
    cardTitle: { type: String, default: "", trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    // When set, finishing this lesson offers "Continue" straight into the
    // named lesson (by slug) instead of the normal "Finish" back to the
    // Lessons list — used to chain a multi-part lesson (e.g. l1-v1 -> l1-v2).
    nextSlug: { type: String, default: "" },
    items: { type: [NewLessonItemSchema], default: [] },
    isActive: { type: Boolean, default: true },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

// Explicit third arg keeps the collection name stable regardless of Mongoose's
// pluralisation rules for "NewLesson".
export const NewLesson = model("NewLesson", NewLessonSchema, "newlessons");
