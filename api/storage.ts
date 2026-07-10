import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Auth_getUserId } from "./_lib/auth";
import { Db_getStorage, USER_EMAIL } from "./_lib/db";
import { Storage_getDefault } from "../src/models/storage";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const userId = Auth_getUserId(req);
  if (userId == null) {
    res.status(401).json({ error: "not_authorized" });
    return;
  }
  const serverStorage = await Db_getStorage(userId);
  const isNewUser = serverStorage == null;
  let storage = serverStorage ?? Storage_getDefault();
  if (storage.originalId == null) {
    storage = { ...storage, originalId: Date.now() };
  }
  const historylimitRaw = req.query.historylimit;
  const historylimit = typeof historylimitRaw === "string" ? parseInt(historylimitRaw, 10) : undefined;
  if (historylimit != null && !isNaN(historylimit) && Array.isArray(storage.history)) {
    storage = { ...storage, history: storage.history.slice(0, historylimit) };
  }
  res.status(200).json({ storage, email: USER_EMAIL, user_id: userId, is_new_user: isNewUser });
}
