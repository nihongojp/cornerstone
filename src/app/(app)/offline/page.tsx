import type { Metadata } from "next";
import OfflineNotice from "@/components/pwa/OfflineNotice";

export const metadata: Metadata = {
  title: "Offline — Nihon-Go",
};

/*
 * Precached by public/sw.js at install and served in place of any page
 * navigation that fails while the network is down.
 *
 * Deliberately outside the (public)/(learn) groups: no Header, no Footer, no
 * session lookup. Everything this page needs has to come from the service
 * worker's precache, and the chrome would try to fetch /api/auth/get-session,
 * which is exactly the request that can't succeed right now.
 */
export default function OfflinePage() {
  return <OfflineNotice />;
}
