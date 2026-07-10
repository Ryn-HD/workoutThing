import type { VercelRequest, VercelResponse } from "@vercel/node";

// AI muscle generator is not available in the personal fork. Client treats a null
// payload as "no data" (src/api/service.ts:getMuscles).
export default async function handler(_req: VercelRequest, res: VercelResponse): Promise<void> {
  res.status(200).json({ data: null });
}
