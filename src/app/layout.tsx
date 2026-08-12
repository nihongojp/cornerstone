import type { Metadata } from "next";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import ThemeRegistry from "../components/ThemeRegistry";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nihon-Go",
  description: "Learn Japanese in a fun, effective, and cultural way.",
  icons: { icon: "/favicon.ico", apple: "/logo192.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppRouterCacheProvider>
          <ThemeRegistry>{children}</ThemeRegistry>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
