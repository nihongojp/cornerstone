import { redirect } from "next/navigation";

// Parity with the CRA catch-all: <Route path="*" element={<Navigate to="/" replace />} />
export default function CatchAll() {
  redirect("/");
}
