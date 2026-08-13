import { requireSession } from "../../lib/session";
import SiteChrome from "../../components/SiteChrome";

// Header but no Footer — matches the CRA app, which hid the Footer on /dashboard.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return <SiteChrome footer={false}>{children}</SiteChrome>;
}
