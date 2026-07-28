// src/models/Lesson.ts
import { Schema, model, InferSchemaType, HydratedDocument } from "mongoose";

export type PrefectureCode =
  | "Hokkaido" | "Aomori" | "Iwate" | "Miyagi" | "Akita" | "Yamagata" | "Fukushima"
  | "Ibaraki" | "Tochigi" | "Gunma" | "Saitama" | "Chiba" | "Tokyo" | "Kanagawa"
  | "Niigata" | "Toyama" | "Ishikawa" | "Fukui" | "Yamanashi" | "Nagano"
  | "Gifu" | "Shizuoka" | "Aichi" | "Mie"
  | "Shiga" | "Kyoto" | "Osaka" | "Hyogo" | "Nara" | "Wakayama"
  | "Tottori" | "Shimane" | "Okayama" | "Hiroshima" | "Yamaguchi"
  | "Tokushima" | "Kagawa" | "Ehime" | "Kochi"
  | "Fukuoka" | "Saga" | "Nagasaki" | "Kumamoto" | "Oita" | "Miyazaki" | "Kagoshima" | "Okinawa";

const ExerciseSchema = new Schema(
  {
    exerciseId: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ["connectTheDots", "matchAudioLetter", "vocabulary_drag_drop"],
    },

    items: { type: [String], default: undefined },
    correctAnswers: { type: [String], default: undefined },

    audioUrl: { type: String, default: undefined },
    prompt: { type: String, default: undefined },

    characterBank: { type: [String], default: undefined },
    correctAnswer: { type: String, default: undefined },

    // Preferred field for client usage.
    imageUrl: { type: String, default: undefined },

    // Backward-compatible field because your DB screenshot already uses "image".
    image: { type: String, default: undefined },
  },
  { _id: false }
);

const AchievementSchema = new Schema(
  { title: { type: String, default: "" }, xp: { type: Number, default: 0 } },
  { _id: false }
);

const LessonSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    version: { type: String, default: "V1" },

    // Editable heading shown on the Lessons list card. Falls back to the
    // auto-computed "Lesson {n}.{m}" (derived from slug) when left blank.
    cardTitle: { type: String, default: "", trim: true },

    flashcards: { type: [String], default: [] },
    // Parallel to flashcards[] — per-card pronunciation URLs (optional;
    // client falls back to matchAudioLetter audio when missing).
    flashcardsAudio: { type: [String], default: [] },
    funFact: { type: String, default: "" },
    notes: { type: String, default: "" },

    exercises: { type: [ExerciseSchema], default: [] },
    achievement: { type: AchievementSchema, default: () => ({ title: "", xp: 0 }) },

    prefecture: {
      type: String,
      required: true,
      index: true,
      enum: [
        "Hokkaido","Aomori","Iwate","Miyagi","Akita","Yamagata","Fukushima",
        "Ibaraki","Tochigi","Gunma","Saitama","Chiba","Tokyo","Kanagawa",
        "Niigata","Toyama","Ishikawa","Fukui","Yamanashi","Nagano",
        "Gifu","Shizuoka","Aichi","Mie",
        "Shiga","Kyoto","Osaka","Hyogo","Nara","Wakayama",
        "Tottori","Shimane","Okayama","Hiroshima","Yamaguchi",
        "Tokushima","Kagawa","Ehime","Kochi",
        "Fukuoka","Saga","Nagasaki","Kumamoto","Oita","Miyazaki","Kagoshima","Okinawa"
      ],
    },

    isActive: { type: Boolean, default: true },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

LessonSchema.path("exercises").validate(function (arr: any[]) {
  const ids = (arr || []).map((x) => x.exerciseId);
  return ids.length === new Set(ids).size;
}, "Duplicate exerciseId in exercises[]");

export type LessonAttrs = InferSchemaType<typeof LessonSchema>;
export type LessonDoc = HydratedDocument<LessonAttrs>;
export type LessonLean = LessonAttrs;

export const Lesson = model<LessonAttrs>("Lesson", LessonSchema);