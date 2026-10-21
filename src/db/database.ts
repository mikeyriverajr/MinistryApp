import Dexie, { type Table } from 'dexie';
import 'dexie-export-import';

export interface UserProfile {
  id?: number;
  name: string;
}

export interface FollowUpVisit {
  id: string;
  date: Date;
  notes: string;
}

export interface TimeEntry {
  id?: number;
  date: Date;
  hours: number;
  isCredit?: boolean;
  creditType?: string;
  note?: string;
}

export interface MonthlyStat {
  month: string; // Format: "YYYY-MM"
  studyCount: number;
}

export interface Visit {
  id?: number;
  name: string;
  phoneNumber?: string;
  dateFound: Date;
  latitude: number | null;
  longitude: number | null;
  houseDescription: string;
  generalNotes: string;
  nextVisitDate: Date | null;
  interestLevel: 'Bajo' | 'Medio' | 'Alto';
  isRecurringStudy: boolean;
  recurringStudyDayOfWeek: number | null; // 0 = Domingo, 1 = Lunes, etc.
  recurringStudyTime: string | null; // e.g. "14:30"
  followUpVisits?: FollowUpVisit[];
  skippedDates?: Date[];
  customDates?: { originalDate: Date, newDate: Date }[];
  createdAt: Date;
  updatedAt: Date;
}

export class MinistryDatabase extends Dexie {
  userProfile!: Table<UserProfile, number>;
  visits!: Table<Visit, number>;
  timeEntries!: Table<TimeEntry, number>;
  monthlyStats!: Table<MonthlyStat, string>;

  constructor() {
    super('MinistryDB');
    this.version(1).stores({
      userProfile: '++id, name',
      visits: '++id, name, dateFound, nextVisitDate, interestLevel, isRecurringStudy, isReturnVisit'
    });
    this.version(2).stores({
      visits: '++id, name, dateFound, nextVisitDate, interestLevel, isRecurringStudy'
    }).upgrade(tx => {
      return tx.table("visits").toCollection().modify(visit => {
        delete visit.isReturnVisit;
        visit.followUpVisits = [];
      });
    });
    this.version(3).stores({
      timeEntries: '++id, date',
      monthlyStats: 'month'
    });
    this.version(4).stores({
      visits: '++id, name, dateFound, nextVisitDate, interestLevel, isRecurringStudy, phoneNumber',
      timeEntries: '++id, date, isCredit, creditType',
    }).upgrade(() => {
      // Schema v4
    });
  }
}

export const db = new MinistryDatabase();

const PENDING_CHANGES_KEY = 'pendingBackupChanges';

export function getPendingBackupChanges(): number {
  const val = Number(localStorage.getItem(PENDING_CHANGES_KEY) || '0');
  return isNaN(val) ? 0 : val;
}

export function incrementPendingBackupChanges(): void {
  const current = getPendingBackupChanges();
  localStorage.setItem(PENDING_CHANGES_KEY, String(current + 1));
  window.dispatchEvent(new Event('morfo-backup-changes'));
}

export function resetPendingBackupChanges(): void {
  localStorage.setItem(PENDING_CHANGES_KEY, '0');
  localStorage.setItem('lastBackupDate', new Date().toISOString());
  window.dispatchEvent(new Event('morfo-backup-changes'));
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persisted();
      if (isPersisted) {
        localStorage.setItem('storagePersisted', 'true');
        return true;
      }
      const granted = await navigator.storage.persist();
      localStorage.setItem('storagePersisted', String(granted));
      return granted;
    }
  } catch (e) {
    console.warn('Persistent storage check failed:', e);
  }
  return false;
}

export function getBackupFilename(ext: 'json' | 'txt' = 'json'): string {
  return `morfo-backup-${new Date().toISOString().split('T')[0]}.${ext}`;
}

export async function createBackupBlob(): Promise<Blob> {
  return await db.export();
}

export function triggerBlobDownload(blob: Blob, filename = getBackupFilename('json')): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  resetPendingBackupChanges();
}

export async function exportDatabase(pregeneratedBlob?: Blob): Promise<void> {
  const blob = pregeneratedBlob || (await db.export());
  triggerBlobDownload(blob, getBackupFilename('json'));
}

export async function shareDatabaseBackup(
  pregeneratedBlob?: Blob
): Promise<'shared' | 'downloaded' | 'copied'> {
  const blob = pregeneratedBlob || (await db.export());
  const dateLabel = new Date().toLocaleDateString();

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    // 1. Try sharing as a .json file first
    try {
      const jsonFile = new File([blob], getBackupFilename('json'), {
        type: 'application/json',
      });
      if (!navigator.canShare || navigator.canShare({ files: [jsonFile] })) {
        await navigator.share({
          title: 'Morfo Backup',
          text: `Respaldo de Morfo (${dateLabel})`,
          files: [jsonFile],
        });
        resetPendingBackupChanges();
        return 'shared';
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
    }

    // 2. Fallback: Android Chrome often blocks application/json in Web Share API but allows text/plain .txt files
    try {
      const txtFile = new File([blob], getBackupFilename('txt'), {
        type: 'text/plain',
      });
      if (!navigator.canShare || navigator.canShare({ files: [txtFile] })) {
        await navigator.share({
          title: 'Morfo Backup',
          text: `Respaldo de Morfo (${dateLabel})`,
          files: [txtFile],
        });
        resetPendingBackupChanges();
        return 'shared';
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
    }

    // 3. Fallback: Share raw backup JSON text directly to WhatsApp / Notes / Email via native share sheet
    try {
      const rawText = await blob.text();
      await navigator.share({
        title: `Morfo Backup (${dateLabel})`,
        text: rawText,
      });
      resetPendingBackupChanges();
      return 'shared';
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
    }
  }

  // 4. Final fallback if Web Share API is unavailable or blocked (e.g. desktop / iframe): download file & copy to clipboard
  try {
    const rawText = await blob.text();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(rawText);
    }
  } catch {
    // Ignore clipboard errors
  }

  triggerBlobDownload(blob, getBackupFilename('json'));
  return 'downloaded';
}

export async function validateAndImportDatabase(source: File | Blob | string): Promise<void> {
  let rawText = '';
  if (typeof source === 'string') {
    rawText = source.trim();
  } else {
    rawText = (await source.text()).trim();
  }

  if (!rawText) {
    throw new Error('Empty backup content');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('Invalid JSON format');
  }

  // Verify that this is a Dexie export or contains expected tables before wiping current data
  const isValidDexie =
    parsed &&
    typeof parsed === 'object' &&
    (parsed.formatName === 'dexie' ||
      (parsed.data && Array.isArray(parsed.data.tables)) ||
      Array.isArray(parsed.tables));

  if (!isValidDexie) {
    throw new Error('Not a valid Morfo / Dexie backup file');
  }

  const validBlob = new Blob([rawText], { type: 'application/json' });

  await db.delete();
  await db.open();
  await db.import(validBlob, {
    acceptMissingTables: true,
    acceptNameDiff: true,
    acceptChangedPrimaryKey: true,
    acceptVersionDiff: true
  });

  resetPendingBackupChanges();
}

export async function importDatabase(file: File): Promise<void> {
  await validateAndImportDatabase(file);
}
