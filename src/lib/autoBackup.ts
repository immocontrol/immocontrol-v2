/**
 * Auto Backup utility — periodic local data backup to localStorage/IndexedDB.
 * Improvement 20: Auto backups for critical user data.
 * Backs up property data, settings, and form drafts automatically.
 */

const BACKUP_KEY_PREFIX = "immocontrol_backup_";
const BACKUP_META_KEY = "immocontrol_backup_meta";
const MAX_BACKUPS = 5;

export interface BackupMeta {
  id: string;
  timestamp: string;
  size: number;
  label: string;
}

/** Get list of all backups */
export function getBackupList(): BackupMeta[] {
  try {
    const raw = localStorage.getItem(BACKUP_META_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as BackupMeta[];
  } catch {
    return [];
  }
}

/** Create a backup of the given data */
export function createBackup(label: string, data: Record<string, unknown>): BackupMeta {
  const id = Date.now().toString(36);
  const json = JSON.stringify(data);
  const meta: BackupMeta = {
    id,
    timestamp: new Date().toISOString(),
    size: json.length,
    label,
  };

  try {
    localStorage.setItem(`${BACKUP_KEY_PREFIX}${id}`, json);

    const list = getBackupList();
    list.unshift(meta);

    // Rotate: remove oldest backups beyond MAX_BACKUPS
    while (list.length > MAX_BACKUPS) {
      const removed = list.pop();
      if (removed) {
        localStorage.removeItem(`${BACKUP_KEY_PREFIX}${removed.id}`);
      }
    }

    localStorage.setItem(BACKUP_META_KEY, JSON.stringify(list));
  } catch {
    // localStorage full — try to free space by removing oldest backup
    const list = getBackupList();
    if (list.length > 0) {
      const oldest = list.pop();
      if (oldest) {
        localStorage.removeItem(`${BACKUP_KEY_PREFIX}${oldest.id}`);
        localStorage.setItem(BACKUP_META_KEY, JSON.stringify(list));
      }
      // Retry once
      try {
        localStorage.setItem(`${BACKUP_KEY_PREFIX}${id}`, json);
      } catch {
        // Give up silently
      }
    }
  }

  return meta;
}

/** Restore a backup by ID */
export function restoreBackup(id: string): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(`${BACKUP_KEY_PREFIX}${id}`);
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Delete a specific backup */
export function deleteBackup(id: string): void {
  localStorage.removeItem(`${BACKUP_KEY_PREFIX}${id}`);
  const list = getBackupList().filter((b) => b.id !== id);
  localStorage.setItem(BACKUP_META_KEY, JSON.stringify(list));
}

/** Delete all backups */
export function clearAllBackups(): void {
  const list = getBackupList();
  for (const b of list) {
    localStorage.removeItem(`${BACKUP_KEY_PREFIX}${b.id}`);
  }
  localStorage.removeItem(BACKUP_META_KEY);
}

/** Download a backup as JSON file */
export function downloadBackup(id: string): void {
  const data = restoreBackup(id);
  if (!data) return;

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `immocontrol_backup_${id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Schedule automatic backups.
 * Returns a cleanup function to stop the interval.
 * @param getData Function that returns the data to backup
 * @param intervalMs Backup interval in ms (default: 1 hour)
 */
export function scheduleAutoBackup(
  getData: () => Record<string, unknown>,
  intervalMs = 60 * 60 * 1000,
): () => void {
  const timer = setInterval(() => {
    const data = getData();
    createBackup("Auto-Backup", data);
  }, intervalMs);

  return () => clearInterval(timer);
}
