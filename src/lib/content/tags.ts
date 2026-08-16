/*
 * Cache tag names, shared by the readers that attach them and the Payload
 * hooks that drop them.
 *
 * Deliberately a leaf module with no imports: the hooks are pulled in through
 * `payload.config.ts`, and reaching them via `content.ts` would make the config
 * import the content reader, which imports the config back. It also has to stay
 * free of `server-only`, because the Payload CLI loads the config outside Next.
 */

export const TAGS = {
  lessons: "lessons",
  newLessons: "newlessons",
  resources: "resources",
  lesson: (slug: string) => `lesson:${slug}`,
  newLesson: (slug: string) => `newlesson:${slug}`,
};
