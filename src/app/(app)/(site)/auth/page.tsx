import { Suspense } from "react";
import { redirect } from "next/navigation";

import AuthForm from "../../../../pages-client/AuthForm";
import { getSession } from "../../../../lib/session";
import { safeReturnPath } from "../../../../lib/return-path";

/*
 * The one sign-in surface. Signed-in visitors never see it — they go straight
 * to wherever they were heading.
 *
 * The guard is here rather than in a `(public-only)` layout, which is where it
 * used to live, because a layout is not given `searchParams` — so it could only
 * ever send everyone to the same fixed page, discarding the `from` the proxy
 * had just gone to the trouble of attaching. That group wrapped this route
 * alone once #70 deleted the `/login` and `/signup` shims, so it is gone rather
 * than left behind as a route group that no longer enforces anything.
 *
 * `safeReturnPath` for the same reason `AuthForm` uses it: `from` arrives from
 * the URL bar, and this is a redirect sink.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  if (await getSession()) redirect(safeReturnPath(from));

  // AuthForm reads the `from` query param, so it needs a Suspense boundary.
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}
