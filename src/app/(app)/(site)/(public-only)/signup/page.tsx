import { redirect } from "next/navigation";

// As /login, but lands on the Sign Up side of the toggle rather than Login.
export default function Page() {
  redirect("/auth?mode=signup");
}
