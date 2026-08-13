import { requireSession } from "../../lib/session";

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
  await requireSession();
  return <>{children}</>;
}
