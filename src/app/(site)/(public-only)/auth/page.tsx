import { Suspense } from "react";
import AuthForm from "../../../../pages-client/AuthForm";

// AuthForm reads the `from` query param, so it needs a Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}
