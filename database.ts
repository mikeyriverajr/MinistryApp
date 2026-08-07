import Dexie, { type Table } from 'dexie';

export interface UserProfile {
  id?: number;
  name: string;
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
  interestLevel: 'Low' | 'Medium' | 'High';
  isRecurringStudy: boolean;
  recurringStudyDayOfWeek: number | null;
  recurringStudyTime: string | null;
  isReturnVisit: boolean;
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
  }
}

export const db = new MinistryDatabase();