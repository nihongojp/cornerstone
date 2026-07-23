import { Schema, model } from "mongoose";

// Intentionally loose item schema — newlessons has richer, evolving exercise types
// (pronunciationExercise, matchingExercise, matchAudioExercise, etc.) not yet in the
// lessons enum. strict:false lets MongoDB documents pass through without validation
// rejection while we stabilise the shape.
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
    items: { type: [NewLessonItemSchema], default: [] },
    isActive: { type: Boolean, default: true },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

// Explicit third arg keeps the collection name stable regardless of Mongoose's
// pluralisation rules for "NewLesson".
export const NewLesson = model("NewLesson", NewLessonSchema, "newlessons");
