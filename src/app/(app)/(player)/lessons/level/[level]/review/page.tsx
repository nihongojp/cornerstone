import { notFound } from "next/navigation";

import { listLessons, listNewLessons } from "@/lib/content/content";
import { collectLessonTerms } from "@/lib/content/lessonTerms";
import { adjacentInSequence } from "@/lib/content/adjacentInSequence";
import { lessonDisplayTitle } from "@/features/learning/lessonTitles";
import LevelReviewPage, { type ReviewPart } from "@/features/learning/components/LevelReviewPage";
import type { Lesson } from "@/payload/payload-types";

function toPart(lesson: Lesson, title: string): ReviewPart {
  return {
    slug: lesson.slug,
    part: lesson.part,
    title,
    terms: collectLessonTerms(lesson),
  };
}

/** Matches the list page: these numbered lessons always have a section. */
const BASE_LEVELS = [1, 2, 3];

/*
 * Every term under one numbered lesson, both formats — the aggregate the
 * icon beside "Lesson N" on the list page links to. Published content only,
 * matching the list page itself; this is a discovery page, not something a
 * CMS editor previews a draft through.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ level: string }>;
}) {
  const { level: levelParam } = await params;
  const level = Number(levelParam);
  if (!Number.isFinite(level)) notFound();

  const [newLessons, prefLessons] = await Promise.all([
    listNewLessons().catch(() => []),
    listLessons().catch(() => []),
  ]);

  const grammar = newLessons
    .filter((l) => l.level === level)
    .sort((a, b) => a.part - b.part)
    .map((l) => toPart(l, lessonDisplayTitle(l)));

  const reading = prefLessons
    .filter((l) => l.level === level)
    .sort((a, b) => a.part - b.part)
    .map((l) => toPart(l, lessonDisplayTitle(l)));

  const { prev, next } = adjacentInSequence(
    [...BASE_LEVELS, ...newLessons.map((l) => l.level), ...prefLessons.map((l) => l.level)],
    level
  );

  return (
    <LevelReviewPage
      level={level}
      grammar={grammar}
      reading={reading}
      prevLevel={prev}
      nextLevel={next}
    />
  );
}
