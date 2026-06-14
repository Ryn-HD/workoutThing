import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Auth_setSessionCookie } from "../_lib/auth";
import { Db_getStorage, USER_EMAIL, USER_ID } from "../_lib/db";
import { Http_parseJson, Http_rawBody } from "../_lib/http";
import { Storage_getDefault } from "../../src/models/storage";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) {
    res.status(500).json({ error: "server_not_configured" });
    return;
  }
  const body = Http_parseJson(await Http_rawBody(req));
  if (body.password !== appPassword) {
    res.status(401).json({ error: "invalid_password" });
    return;
  }

  const serverStorage = await Db_getStorage(USER_ID);
  const isNewUser = serverStorage == null;
  let storage = serverStorage ?? Storage_getDefault();
  if (storage.originalId == null) {
    storage = { ...storage, originalId: Date.now() };
  }

  Auth_setSessionCookie(res, USER_ID);
  res.status(200).json({ email: USER_EMAIL, user_id: USER_ID, storage, is_new_user: isNewUser });
}
