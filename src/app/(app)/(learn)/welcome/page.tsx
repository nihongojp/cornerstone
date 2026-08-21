import WelcomeForm from "@/pages-client/WelcomeForm";

/*
 * Where a brand-new account lands after proving its address — see
 * `newUserCallbackURL` in AuthForm. In the (learn) group because it only
 * makes sense with a session: it calls updateUser on the signed-in user.
 */
export default function Page() {
  return <WelcomeForm />;
}
