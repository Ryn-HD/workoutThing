import { VersionTracker } from "../../src/models/versionTracker";
import { STORAGE_VERSION_TYPES, IStorage, IPartialStorage } from "../../src/types";
import { Storage_fillVersions, Storage_get, Storage_getDefault } from "../../src/models/storage";
import { IStorageUpdate2 } from "../../src/utils/sync";

export type ISyncResult =
  | { kind: "merged"; storage: IStorage; originalId: number; wasClean: boolean }
  | { kind: "noop"; originalId: number }
  | { kind: "error"; error: string };

// Single-blob adaptation of lambda/dao/userDao.ts:applySafeSync2 and the clean/dirty
// decision in lambda/index.ts:postSync2Handler. The whole IStorage (history/programs/stats
// inline) lives in one row, so there is no DynamoDB table split or augmentation step here.
export function Sync_apply(
  serverStorage: IStorage | undefined,
  storageUpdate: IStorageUpdate2,
  deviceId?: string
): ISyncResult {
  const base: IStorage = serverStorage ?? Storage_getDefault();
  const baseResult = Storage_get(base as unknown as Record<string, unknown>);
  if (!baseResult.success) {
    return { kind: "error", error: "corrupted_server_storage" };
  }
  const migratedBase = baseResult.data;
  if (migratedBase.version !== storageUpdate.version) {
    return { kind: "error", error: "outdated_client_storage" };
  }

  const noChanges =
    Object.keys(storageUpdate.storage || {}).length === 0 && Object.keys(storageUpdate.versions || {}).length === 0;
  if (noChanges) {
    return { kind: "noop", originalId: storageUpdate.originalId || Date.now() };
  }

  const wasClean =
    serverStorage != null && storageUpdate.originalId != null && migratedBase.originalId === storageUpdate.originalId;

  const { _versions, ...baseStorageNoVersions } = migratedBase;
  const versionTracker = new VersionTracker(STORAGE_VERSION_TYPES, deviceId ? { deviceId } : undefined);
  const originalId = Date.now();
  const serverVersions = _versions || {};
  const newVersions = versionTracker.mergeVersions(serverVersions, storageUpdate.versions || {});
  const mergedStorage = versionTracker.mergeByVersions(
    baseStorageNoVersions as unknown as Record<string, unknown>,
    serverVersions,
    storageUpdate.versions || {},
    (storageUpdate.storage || {}) as Partial<Record<string, unknown>>
  ) as unknown as IStorage;

  if (mergedStorage.progress && mergedStorage.progress.length > 1) {
    mergedStorage.progress.sort((a, b) => b.startTime - a.startTime);
    mergedStorage.progress = [mergedStorage.progress[0]];
  }
  mergedStorage.progress?.[0]?.entries?.sort((a, b) => a.index - b.index);
  for (const entry of mergedStorage.progress?.[0]?.entries || []) {
    entry.sets.sort((a, b) => a.index - b.index);
  }

  const preNew: IPartialStorage = { ...mergedStorage, originalId, _versions: newVersions };
  const newStorage = Storage_fillVersions(preNew as IStorage, deviceId);
  return { kind: "merged", storage: newStorage as IStorage, originalId, wasClean };
}
