"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";

type ActionResult = { error?: string };

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "That didn't save. Try again.";
}

export async function updateProfile(input: {
  firstName: string;
  lastName: string;
  email: string;
  currentEmail: string;
}): Promise<ActionResult> {
  const hdrs = await headers();
  try {
    await auth.api.updateUser({
      body: { firstName: input.firstName, lastName: input.lastName },
      headers: hdrs,
    });
  } catch (error) {
    return { error: messageOf(error) };
  }

  // Better Auth rejects a no-op email change, so only send it when it moved.
  if (input.email !== input.currentEmail) {
    try {
      await auth.api.changeEmail({
        body: { newEmail: input.email },
        headers: hdrs,
      });
    } catch (error) {
      return { error: messageOf(error) };
    }
  }

  return {};
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
    return {};
  } catch (error) {
    return { error: messageOf(error) };
  }
}

export async function deleteAccount(): Promise<ActionResult> {
  try {
    await auth.api.deleteUser({
      body: {},
      headers: await headers(),
    });
    return {};
  } catch (error) {
    return { error: messageOf(error) };
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
    return {};
  } catch (error) {
    return { error: messageOf(error) };
  }
}
