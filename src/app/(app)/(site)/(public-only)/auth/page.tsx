import { Suspense } from "react";
import AuthForm from "../../../../../pages-client/AuthForm";
import AuthPrototype from "../../../../../pages-client/auth-prototype/AuthPrototype";

// AuthForm reads the `from` query param, so it needs a Suspense boundary.
//
// PROTOTYPE (#52): `?variant=A|B|C` renders the throwaway sign-in variants
// instead. Without the param this route behaves exactly as before, so the
// production path is untouched. Remove this branch — and
// pages-client/auth-prototype/ — once a variant wins.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string }>;
}) {
  const { variant } = await searchParams;

  return (
    <Suspense>{variant ? <AuthPrototype /> : <AuthForm />}</Suspense>
  );
}
