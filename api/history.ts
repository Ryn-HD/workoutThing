import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Auth_getUserId } from "./_lib/auth";
import { Db_getStorage } from "./_lib/db";
import { HistoryIds_parse } from "../src/utils/historyIds";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const userId = Auth_getUserId(req);
  if (userId == null) {
    res.status(401).json({ error: "not_authorized" });
    return;
  }
  const idsRaw = req.query.ids;
  if (typeof idsRaw === "string") {
    const ids = HistoryIds_parse(idsRaw);
    if (!ids.success) {
      res.status(400).json({ error: ids.error });
      return;
    }
    const storage = await Db_getStorage(userId);
    const wanted = new Set(ids.data);
    res.status(200).json({ history: (storage?.history || []).filter((h) => wanted.has(h.id)) });
    return;
  }
  const afterRaw = req.query.after;
  const limitRaw = req.query.limit;
  const after = typeof afterRaw === "string" ? Number(afterRaw) : undefined;
  const limit = typeof limitRaw === "string" ? Number(limitRaw) : 20;

  const storage = await Db_getStorage(userId);
  const all = (storage?.history || []).slice().sort((a, b) => b.id - a.id);
  const filtered = after != null && !isNaN(after) ? all.filter((h) => h.id < after) : all;
  res.status(200).json({ history: filtered.slice(0, limit) });
}
