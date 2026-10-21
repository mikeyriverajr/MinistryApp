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

export function getBackupFilename(): string {
  return `morfo-backup-${new Date().toISOString().split('T')[0]}.json`;
}

export async function exportDatabase(): Promise<void> {
  const blob = await db.export();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = getBackupFilename();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  resetPendingBackupChanges();
}

export async function shareDatabaseBackup(): Promise<'shared' | 'downloaded'> {
  const blob = await db.export();
  const filename = getBackupFilename();
  const file = new File([blob], filename, { type: 'application/json' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({
      title: 'Morfo Backup',
      text: `Respaldo de Morfo (${new Date().toLocaleDateString()})`,
      files: [file],
    });
    resetPendingBackupChanges();
    return 'shared';
  }

  // Fallback to direct download if Web Share with files isn't supported
  await exportDatabase();
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
