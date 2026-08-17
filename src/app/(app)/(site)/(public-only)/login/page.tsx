import { redirect } from "next/navigation";

// One sign-in surface lives at /auth (#52). This route predates that and is
// kept only so existing links and bookmarks still work.
export default function Page() {
  redirect("/auth");
}
