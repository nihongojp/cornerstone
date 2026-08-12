import { redirect } from "next/navigation";
import { getSession } from "../../../lib/session";

// Replaces the CRA <PublicOnly> wrapper: signed-in users never see the
// login/signup screens.
export default async function PublicOnlyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (await getSession()) redirect("/new-lessons");
  return <>{children}</>;
}
