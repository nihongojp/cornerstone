import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "../../../../lib/auth";

// Replaces the Express /api/auth/* routes (signup, login, me, change-password,
// reset-password) from server/src/routes/authRoutes.ts.
export const { GET, POST } = toNextJsHandler(auth.handler);
