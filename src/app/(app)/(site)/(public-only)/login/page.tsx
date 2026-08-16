import { Suspense } from "react";
import AuthForm from "../../../../../pages-client/AuthForm";

export default function Page() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}
