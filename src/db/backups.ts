import Dexie, { type Table } from 'dexie';
import { db } from './database';

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

  // Check if we already have a snapshot for today
  const existing = await backupsDb.snapshots.get(todayStr);
  if (existing) {
    return; // Already backed up today
  }

  try {
    // Export main DB to Blob
    const blob = await db.export();

    // Save to backups DB
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

    console.log('Daily backup completed successfully.');
  } catch (err) {
    console.error('Error performing daily backup', err);
  }
}
