import type { VercelRequest } from "@vercel/node";

export async function Http_rawBody(req: VercelRequest): Promise<string> {
  if (typeof req.body === "string") {
    return req.body;
  }
  if (req.body && typeof req.body === "object") {
    return JSON.stringify(req.body);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function Http_parseJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (_e) {
    return {};
  }
}
