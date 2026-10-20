import Dexie, { type Table } from 'dexie';
import { db, validateAndImportDatabase } from './database';

export interface InternalSnapshot {
  dateStr: string; // "YYYY-MM-DD"
  blob: Blob;
  createdAt: Date;
}

export class BackupsDatabase extends Dexie {
  snapshots!: Table<InternalSnapshot, string>;

  constructor() {
    super('MinistryBackupsDB');
    this.version(1).stores({
      snapshots: 'dateStr, createdAt'
    });
  }
}

export const backupsDb = new BackupsDatabase();

export async function performDailyBackup() {
  const todayStr = new Date().toISOString().split('T')[0];

  try {
    // Only snapshot if the user has completed setup or has visits/hours
    const profileCount = await db.userProfile.count();
    const visitCount = await db.visits.count();
    if (profileCount === 0 && visitCount === 0) {
      return;
    }

    // Export main DB to Blob and update today's snapshot
    const blob = await db.export();

    await backupsDb.snapshots.put({
      dateStr: todayStr,
      blob,
      createdAt: new Date()
    });

    // Clean up snapshots older than 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    await backupsDb.snapshots
      .where('createdAt')
      .below(sevenDaysAgo)
      .delete();
  } catch (err) {
    console.error('Error performing daily backup', err);
  }
}

export async function restoreInternalSnapshot(dateStr: string): Promise<void> {
  const snapshot = await backupsDb.snapshots.get(dateStr);
  if (!snapshot || !snapshot.blob) {
    throw new Error('Snapshot not found');
  }
  await validateAndImportDatabase(snapshot.blob);
}

export async function clearInternalSnapshots(): Promise<void> {
  await backupsDb.delete();
  await backupsDb.open();
}
