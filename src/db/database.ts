import Dexie, { type Table } from 'dexie';
import 'dexie-export-import';

export interface UserProfile {
  id?: number;
  name: string;
}

export interface FollowUpVisit {
  id: string; // generate a random ID (e.g. UUID or Date.now().toString())
  date: Date;
  notes: string;
}

export interface Visit {
  id?: number;
  name: string;
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
  createdAt: Date;
  updatedAt: Date;
}

export class MinistryDatabase extends Dexie {
  userProfile!: Table<UserProfile, number>;
  visits!: Table<Visit, number>;

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
  }
}

export const db = new MinistryDatabase();

// Helper functions for import/export
export async function exportDatabase() {
  const blob = await db.export();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ministerio-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importDatabase(file: File) {
  await db.delete();
  await db.open();
  await db.import(file);
}
