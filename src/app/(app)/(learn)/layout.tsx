import { requireSession } from "@/lib/session";
import SiteChrome from "@/components/SiteChrome";

export default async function LearnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();
  return <SiteChrome>{children}</SiteChrome>;
}
