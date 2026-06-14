import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Auth_getUserId } from "./_lib/auth";
import { Db_getStorage, Db_saveStorage, USER_EMAIL } from "./_lib/db";
import { NodeEncoder_decode } from "./_lib/nodeEncoder";
import { Http_parseJson, Http_rawBody } from "./_lib/http";
import { Sync_apply } from "./_lib/sync";
import { IStorageUpdate2 } from "../src/utils/sync";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ type: "error", error: "method_not_allowed" });
    return;
  }
  const userId = Auth_getUserId(req);
  if (userId == null) {
    res.status(401).json({ type: "error", error: "not_authorized" });
    return;
  }

  const outer = Http_parseJson(await Http_rawBody(req));
  const bodyJson =
    typeof outer.data === "string"
      ? (JSON.parse(NodeEncoder_decode(outer.data)) as Record<string, unknown>)
      : outer;

  const deviceId = bodyJson.deviceId as string | undefined;
  const historylimit = bodyJson.historylimit as number | undefined;
  const storageUpdate = bodyJson.storageUpdate as IStorageUpdate2 | undefined;
  if (!storageUpdate) {
    res.status(400).json({ type: "error", error: "missing_storage_update" });
    return;
  }

  const serverStorage = await Db_getStorage(userId);
  const result = Sync_apply(serverStorage, storageUpdate, deviceId);

  if (result.kind === "error") {
    res.status(400).json({ type: "error", error: result.error });
    return;
  }
  if (result.kind === "noop") {
    res.status(200).json({ type: "clean", new_original_id: result.originalId, email: USER_EMAIL, user_id: userId });
    return;
  }

  await Db_saveStorage(userId, result.storage);

  if (result.wasClean) {
    res.status(200).json({ type: "clean", new_original_id: result.originalId, email: USER_EMAIL, user_id: userId });
    return;
  }

  const storage = { ...result.storage };
  if (historylimit != null && Array.isArray(storage.history)) {
    storage.history = storage.history.slice(0, historylimit);
  }
  res.status(200).json({ type: "dirty", storage, email: USER_EMAIL, user_id: userId });
}
