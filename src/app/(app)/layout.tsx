import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import ThemeRegistry from "../../components/ThemeRegistry";
import RegisterServiceWorker from "../../components/pwa/RegisterServiceWorker";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nihon-Go",
  description: "Learn Japanese in a fun, effective, and cultural way.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.ico",
    // Apple ignores the manifest icons; this is the one the home screen uses.
    apple: "/icons/apple-touch-icon.png",
  },
  /*
   * Installed-to-home-screen behaviour on iOS. `capable` makes Safari open the
   * site without browser chrome once installed; `statusBarStyle: "default"`
   * keeps a solid status bar so the sticky header never renders under the
   * clock. The title is what the home-screen label shows.
   */
  appleWebApp: {
    capable: true,
    title: "Nihon-Go",
    statusBarStyle: "default",
  },
};

/*
 * `viewportFit: "cover"` lets the page extend under the iPhone notch and home
 * indicator; without it `env(safe-area-inset-*)` is always 0 and the chrome
 * can't pad itself away from them. SiteChrome and Footer read those insets.
 *
 * Zoom stays enabled on purpose — disabling it is an accessibility failure
 * and App Review flags it. The learner-facing inputs use 16px text so iOS
 * doesn't auto-zoom on focus anyway.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#b43d20",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppRouterCacheProvider>
          <ThemeRegistry>{children}</ThemeRegistry>
        </AppRouterCacheProvider>
        <RegisterServiceWorker />
        <Analytics />
      </body>
    </html>
  );
}
