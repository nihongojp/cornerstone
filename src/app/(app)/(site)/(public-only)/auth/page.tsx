import { Suspense } from "react";
import AuthForm from "../../../../../pages-client/AuthForm";
import AuthPrototype from "../../../../../pages-client/auth-prototype/AuthPrototype";

// AuthForm reads the `from` query param, so it needs a Suspense boundary.
//
// PROTOTYPE (#52): `?prototype=1` renders the chosen sign-in design instead.
// Without the param this route behaves exactly as before. Remove this branch —
// and pages-client/auth-prototype/ — once #55 builds the real thing.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ prototype?: string }>;
}) {
  const { prototype } = await searchParams;

  return <Suspense>{prototype ? <AuthPrototype /> : <AuthForm />}</Suspense>;
}
