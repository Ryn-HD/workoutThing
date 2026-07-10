import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Auth_clearSessionCookie } from "./_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  Auth_clearSessionCookie(res);
  res.status(200).json({});
}
