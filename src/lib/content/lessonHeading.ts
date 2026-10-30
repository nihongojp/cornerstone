/*
 * The heading across the top of the lesson player: "Lesson 2 Part 3".
 *
 * Built from the lesson's two numbers rather than its title, so every lesson says the
 * same thing in the same way and a learner can always tell which one they are in.
 * The part number is the version (`…-v3` is Part 3), and for reading/writing lessons
 * the numbers are the regrouped ones, so this follows whatever the Lessons page says.
 */
export function lessonHeading(lesson: { level: number; part: number }): string {
  return `Lesson ${lesson.level} Part ${lesson.part}`;
}
