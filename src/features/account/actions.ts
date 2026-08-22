"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";

/*
 * Account mutations.
 *
 * Every exported function in a `"use server"` file is a public POST endpoint,
 * reachable whether or not the UI calls it. These are safe because they all go
 * through `auth.api.*` with the real request headers, and Better Auth's session
 * middleware rejects an unauthenticated call — the gate is real but invisible,
 * so do not copy this shape into an action that talks to the database directly
 * without calling `getSession()` first.
 */

/**
 * The outcome of a mutation.
 *
 * Discriminated on `ok` rather than on whether an error string is present:
 * Better Auth can throw an `APIError` whose `message` is empty, and a falsy
 * message previously read as success — the UI said "Profile updated" for a
 * change that never happened.
 */
export type ActionResult =
  | { ok: true }
  | { ok: false; message: string };

const GENERIC = "That didn't save. Try again.";

/*
 * What the learner is told. Better Auth's own errors are written for users, so
 * they pass through; anything else is infrastructure (a Neon blip, a TypeError)
 * and becomes generic, because `connect ECONNREFUSED 10.x.x.x:5432` in a
 * profile banner helps nobody and leaks internals.
 */
function userFacing(error: unknown): string {
  if (typeof error === "object" && error !== null && "status" in error) {
    const message = error instanceof Error ? error.message.trim() : "";
    if (message) return message;
  }
  return GENERIC;
}

/*
 * Logged server-side, always. Before this, a Better Auth failure was an HTTP
 * response the platform logged for us; absorbed inside an action it left no
 * trace at all, so an outage produced a message in one learner's browser and
 * nothing to debug from afterwards.
 */
function fail(operation: string, error: unknown): ActionResult {
  console.error(`[account] ${operation} failed`, {
    status: typeof error === "object" && error !== null && "status" in error ? error.status : undefined,
    error,
  });
  return { ok: false, message: userFacing(error) };
}

export async function updateProfile(input: {
  firstName: string;
  lastName: string;
  email: string;
}): Promise<ActionResult> {
  const hdrs = await headers();

  // The authoritative current email is the session's, not the caller's. Taking
  // it from the argument let a stale client skip the change entirely and still
  // be told it succeeded.
  const session = await auth.api.getSession({ headers: hdrs });
  const currentEmail = session?.user.email;

  try {
    await auth.api.updateUser({
      body: { firstName: input.firstName, lastName: input.lastName },
      headers: hdrs,
    });
  } catch (error) {
    return fail("updateProfile (name)", error);
  }

  // Better Auth rejects a no-op email change, so only send it when it moved.
  if (currentEmail && input.email !== currentEmail) {
    try {
      await auth.api.changeEmail({ body: { newEmail: input.email }, headers: hdrs });
    } catch (error) {
      // The name already committed. Say so, rather than reporting a total
      // failure for a partial one and leaving the learner unsure what stuck.
      console.error("[account] updateProfile (email) failed after name saved", { error });
      return {
        ok: false,
        message: `Your name was saved, but the email change didn't go through: ${userFacing(error)}`,
      };
    }
  }

  return { ok: true };
}

export async function updatePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<ActionResult> {
  try {
    await auth.api.changePassword({
      body: {
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
        revokeOtherSessions: true,
      },
      headers: await headers(),
    });
    return { ok: true };
  } catch (error) {
    return fail("updatePassword", error);
  }
}

export async function deleteAccount(): Promise<ActionResult> {
  try {
    await auth.api.deleteUser({ body: {}, headers: await headers() });
    return { ok: true };
  } catch (error) {
    return fail("deleteAccount", error);
  }
}

export async function saveWelcomeName(input: {
  firstName: string;
  lastName: string;
}): Promise<ActionResult> {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  try {
    await auth.api.updateUser({
      body: {
        firstName,
        lastName,
        name: [firstName, lastName].filter(Boolean).join(" "),
      },
      headers: await headers(),
    });
    return { ok: true };
  } catch (error) {
    return fail("saveWelcomeName", error);
  }
}
