import { requireSession } from "../../../lib/session";

// Replaces the CRA <RequireAuth> wrapper, which only checked for a token in
// localStorage and so gated the UI without gating the data.
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();
  return <>{children}</>;
}
