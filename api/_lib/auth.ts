import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as jwt from "jsonwebtoken";
import { parse as parseCookie, serialize as serializeCookie } from "cookie";
import { USER_ID } from "./db";

const TEN_YEARS_SECONDS = 60 * 60 * 24 * 365 * 10;

function cookieSecret(): string {
  const secret = process.env.COOKIE_SECRET;
  if (!secret) {
    throw new Error("COOKIE_SECRET env var is not set");
  }
  return secret;
}

export function Auth_setSessionCookie(res: VercelResponse, userId: string): void {
  const token = jwt.sign({ userId }, cookieSecret());
  // Host-only cookie (no Domain) so it applies on the Vercel deployment domain.
  res.setHeader(
    "Set-Cookie",
    serializeCookie("session", token, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
      maxAge: TEN_YEARS_SECONDS,
    })
  );
}

export function Auth_clearSessionCookie(res: VercelResponse): void {
  res.setHeader(
    "Set-Cookie",
    serializeCookie("session", "", { httpOnly: true, path: "/", sameSite: "lax", secure: true, maxAge: 0 })
  );
}

export function Auth_getUserId(req: VercelRequest): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    return undefined;
  }
  const cookies = parseCookie(cookieHeader);
  const token = cookies.session;
  if (!token) {
    return undefined;
  }
  try {
    jwt.verify(token, cookieSecret());
    const decoded = jwt.decode(token) as { userId?: string } | null;
    return decoded?.userId === USER_ID ? decoded.userId : undefined;
  } catch (_e) {
    return undefined;
  }
}
