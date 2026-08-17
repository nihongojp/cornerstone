import { requirePlayerAccess } from "../../../lib/session";

/*
 * Lesson players render without Header or Footer — the CRA app did this with
 * pathname prefix checks in AppContent ("/lesson", "/newlesson"); here the
 * route group carries it.
 */
export default async function PlayerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // A learner's session, or a CMS editor previewing a draft — the two identity
  // systems are separate, and an editor has no better-auth session to offer.
  await requirePlayerAccess();
  return <>{children}</>;
}
