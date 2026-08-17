import "server-only";
import { Resend } from "resend";

/*
 * Every transactional mail the app sends goes through here.
 *
 * Under passwordless, email delivery *is* the login system: a magic link that
 * doesn't arrive is a user who cannot sign in and has no way to tell us. That
 * is why #47 names deliverability, not Better Auth configuration, as the real
 * Phase 1 risk — and why this module refuses to fail quietly.
 */

type SendArgs = {
  to: string;
  subject: string;
  text: string;
  /**
   * True when `text` contains a sign-in credential — a magic link or a code.
   * These may never be written to a log unless a developer has explicitly asked
   * for it; see `devLogFallback` below.
   */
  containsCredential: boolean;
};

/*
 * The old behaviour was: no Resend credentials → console.warn the reset link,
 * unless NODE_ENV is production, in which case throw.
 *
 * That was tolerable when the only mail was a password reset, requested rarely
 * and by the account owner. It is not tolerable now. Under passwordless the
 * same branch would print a working credential for *every sign-in attempt*, to
 * whatever collects stdout. `NODE_ENV !== "production"` is far too weak a gate
 * for that — it is true for every test runner, CI job and shared dev box.
 *
 * So the fallback now requires someone to opt in by name. Without
 * AUTH_DEV_LOG_LINKS=1, a missing mail configuration is an error, everywhere.
 */
function devLogFallback(args: SendArgs): void {
  if (process.env.AUTH_DEV_LOG_LINKS !== "1") {
    throw new Error(
      "RESEND_API_KEY/EMAIL_FROM are not set, so no mail can be sent. " +
        "For local development set AUTH_DEV_LOG_LINKS=1 to print sign-in " +
        "credentials to the server console instead — never do this anywhere " +
        "the console is collected."
    );
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_DEV_LOG_LINKS is set in a production build. Refusing to print " +
        "sign-in credentials to the console."
    );
  }

  console.warn(`\n[auth] mail not sent (no credentials). To: ${args.to}\n${args.text}\n`);
}

export async function sendMail(args: SendArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    devLogFallback(args);
    return;
  }

  const { error } = await new Resend(apiKey).emails.send({
    from,
    to: args.to,
    subject: args.subject,
    text: args.text,
  });

  /*
   * Resend reports failures in the response body rather than by throwing, so
   * without this check a send that silently failed would look identical to one
   * that worked — and the user would sit on "check your email" forever. The
   * caller turns this into the "we couldn't send that email" screen.
   */
  if (error) {
    throw new Error(`Resend refused to send to ${args.to}: ${error.message}`);
  }
}

export function signInLinkEmail(url: string) {
  return {
    subject: "Your Nihon-Go! sign-in link",
    text:
      `Here is your sign-in link:\n\n${url}\n\n` +
      `It expires in 15 minutes and can only be used once.\n\n` +
      `If you didn't ask to sign in, you can ignore this email.`,
    containsCredential: true as const,
  };
}

export function signInCodeEmail(otp: string) {
  return {
    subject: `${otp} is your Nihon-Go! sign-in code`,
    text:
      `Your sign-in code is ${otp}\n\n` +
      `It expires in 15 minutes.\n\n` +
      `If you didn't ask to sign in, you can ignore this email.`,
    containsCredential: true as const,
  };
}

export function verifyEmail(url: string) {
  return {
    subject: "Confirm your email address",
    text:
      `Confirm your email address to finish setting up your Nihon-Go! account:\n\n${url}\n\n` +
      `If you didn't create an account, you can ignore this email.`,
    containsCredential: true as const,
  };
}

export function resetPasswordEmail(url: string) {
  return {
    subject: "Reset your Nihon-Go! password",
    text:
      `Someone requested a password reset for this account.\n\n` +
      `Reset your password: ${url}\n\n` +
      `This link expires in one hour. If you didn't request it, you can ignore this email.`,
    containsCredential: true as const,
  };
}
