import { Suspense } from "react";

import ResetPassword from "@/pages-client/ResetPassword";

/*
 * Reachable with or without a session on purpose: someone can be signed in on
 * one device and still be following a reset link from their email. Reads the
 * `token` query param, hence the Suspense boundary.
 */
export default function Page() {
  return (
    <Suspense>
      <ResetPassword />
    </Suspense>
  );
}
