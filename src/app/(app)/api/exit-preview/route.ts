import { draftMode } from "next/headers";
import { NextResponse } from "next/server";

/*
 * The way back out of Draft Mode.
 *
 * Not optional housekeeping: the cookie /api/preview sets applies to every
 * route on the origin and survives until the browser closes. Without this an
 * editor who previewed one lesson keeps seeing unpublished content everywhere
 * they browse afterwards, with nothing on screen to say so.
 */
export async function GET(request: Request): Promise<Response> {
  const draft = await draftMode();
  draft.disable();
  return NextResponse.redirect(new URL("/", request.url));
}
