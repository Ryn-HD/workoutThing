import type { VercelRequest, VercelResponse } from "@vercel/node";

// Personal fork: analytics events are not persisted. Acknowledge so the client's
// fire-and-forget postEvent does not error.
export default async function handler(_req: VercelRequest, res: VercelResponse): Promise<void> {
  res.status(200).json({ data: "ok" });
}
