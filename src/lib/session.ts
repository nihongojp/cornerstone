import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

/** Current session, or null. Server-side only. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/**
 * The real auth boundary for protected pages — the middleware only checks that
 * a cookie exists. Replaces the Express requireAuth middleware for page loads.
 */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/auth");
  return session;
}
