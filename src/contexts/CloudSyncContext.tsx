import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { isSameDay } from 'date-fns';
import {
  auth,
  firestoreDb,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../services/firebase';
import {
  db,
  Visit,
  TimeEntry,
  MonthlyStat,
  resetPendingBackupChanges,
} from '../db/database';

export interface PartnerSharedVisit {
  id: number;
  name: string;
  latitude: number | null;
  longitude: number | null;
  houseDescription: string;
  generalNotes: string;
  nextVisitDate: string | null;
  interestLevel: 'Bajo' | 'Medio' | 'Alto';
  isRecurringStudy: boolean;
  recurringStudyDayOfWeek: number | null;
  recurringStudyTime: string | null;
  customDates?: { originalDate: string; newDate: string }[];
  skippedDates?: string[];
}

export interface ConflictDetail {
  partnerName: string;
  visitName: string;
  timeStr: string;
  isRecurringStudy: boolean;
}

interface CloudSyncContextType {
  user: User | null;
  authReady: boolean;
  isCloudEnabled: boolean;
  isSyncing: boolean;
  lastCloudSyncAt: string | null;
  myShareCode: string;
  linkedPartnerCode: string;
  partnerName: string;
  partnerVisits: PartnerSharedVisit[];
  showPartnerData: boolean;
  setShowPartnerData: (show: boolean) => void;
  activateCloudSync: () => Promise<{ mode: 'google' | 'code'; code: string; hasExistingVault: boolean }>;
  signOutCloud: () => Promise<void>;
  syncNowToCloud: () => Promise<boolean>;
  restoreFromCloudByCode: (code?: string) => Promise<boolean>;
  checkHasCloudVault: (codeOrUid?: string) => Promise<{ exists: boolean; publisherName?: string; visitCount?: number }>;
  linkPartnerByCode: (code: string) => Promise<boolean>;
  unlinkPartner: () => void;
  findScheduleConflicts: (targetDate: Date | null, recurringDay?: number | null, recurringTime?: string | null) => ConflictDetail[];
}

const CloudSyncContext = createContext<CloudSyncContextType | undefined>(undefined);

const MY_SHARE_CODE_KEY = 'morfoMyShareCode';
const DEVICE_OWNER_ID_KEY = 'morfoDeviceOwnerId';
const CLOUD_ENABLED_KEY = 'morfoCloudSyncEnabled';
const LINKED_PARTNER_CODE_KEY = 'morfoLinkedPartnerCode';
const SHOW_PARTNER_DATA_KEY = 'morfoShowPartnerData';
const LAST_CLOUD_SYNC_KEY = 'morfoLastCloudSyncAt';

function getOrCreateDeviceOwnerId(): string {
  const existing = localStorage.getItem(DEVICE_OWNER_ID_KEY);
  if (existing && /^[a-zA-Z0-9_\-]{6,64}$/.test(existing)) {
    return existing;
  }
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'dev_';
  for (let i = 0; i < 20; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  localStorage.setItem(DEVICE_OWNER_ID_KEY, id);
  return id;
}

function generateCleanShareCode(seedStr?: string): string {
  const existing = localStorage.getItem(MY_SHARE_CODE_KEY);
  if (existing && /^[A-Z0-9\-]{6,16}$/.test(existing)) {
    return existing;
  }
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  const seed = seedStr || String(Date.now());
  for (let i = 0; i < 6; i++) {
    const idx =
      Math.floor(Math.random() * chars.length + (seed.charCodeAt(i % seed.length) || 0)) %
      chars.length;
    suffix += chars[idx];
  }
  const code = `MORFO-${suffix}`;
  localStorage.setItem(MY_SHARE_CODE_KEY, code);
  return code;
}

function serializeVisitsForVault(visits: Visit[]): any[] {
  return visits.slice(0, 500).map((v) => ({
    id: v.id ?? 0,
    name: String(v.name || '').slice(0, 120),
    phoneNumber: String(v.phoneNumber || '').slice(0, 40),
    dateFound: v.dateFound ? new Date(v.dateFound).toISOString() : new Date().toISOString(),
    latitude: typeof v.latitude === 'number' ? v.latitude : null,
    longitude: typeof v.longitude === 'number' ? v.longitude : null,
    houseDescription: String(v.houseDescription || '').slice(0, 500),
    generalNotes: String(v.generalNotes || '').slice(0, 1000),
    nextVisitDate: v.nextVisitDate ? new Date(v.nextVisitDate).toISOString() : null,
    interestLevel: v.interestLevel || 'Medio',
    isRecurringStudy: Boolean(v.isRecurringStudy),
    recurringStudyDayOfWeek:
      typeof v.recurringStudyDayOfWeek === 'number' ? v.recurringStudyDayOfWeek : null,
    recurringStudyTime: v.recurringStudyTime ? String(v.recurringStudyTime).slice(0, 10) : null,
    followUpVisits: (v.followUpVisits || []).slice(0, 200).map((f) => ({
      id: String(f.id || ''),
      date: f.date ? new Date(f.date).toISOString() : new Date().toISOString(),
      notes: String(f.notes || '').slice(0, 1000),
    })),
    skippedDates: (v.skippedDates || []).slice(0, 100).map((d) => new Date(d).toISOString()),
    customDates: (v.customDates || []).slice(0, 100).map((cd) => ({
      originalDate: new Date(cd.originalDate).toISOString(),
      newDate: new Date(cd.newDate).toISOString(),
    })),
    createdAt: v.createdAt ? new Date(v.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: v.updatedAt ? new Date(v.updatedAt).toISOString() : new Date().toISOString(),
  }));
}

function serializeVisitsForPartner(visits: Visit[]): PartnerSharedVisit[] {
  return visits.slice(0, 500).map((v, idx) => ({
    id: v.id ?? idx + 1,
    name: String(v.name || '').slice(0, 120),
    latitude: typeof v.latitude === 'number' ? v.latitude : null,
    longitude: typeof v.longitude === 'number' ? v.longitude : null,
    houseDescription: String(v.houseDescription || '').slice(0, 300),
    generalNotes: String(v.generalNotes || '').slice(0, 400),
    nextVisitDate: v.nextVisitDate ? new Date(v.nextVisitDate).toISOString() : null,
    interestLevel: v.interestLevel || 'Medio',
    isRecurringStudy: Boolean(v.isRecurringStudy),
    recurringStudyDayOfWeek:
      typeof v.recurringStudyDayOfWeek === 'number' ? v.recurringStudyDayOfWeek : null,
    recurringStudyTime: v.recurringStudyTime ? String(v.recurringStudyTime).slice(0, 10) : null,
    customDates: (v.customDates || []).slice(0, 50).map((cd) => ({
      originalDate: new Date(cd.originalDate).toISOString(),
      newDate: new Date(cd.newDate).toISOString(),
    })),
    skippedDates: (v.skippedDates || []).slice(0, 50).map((d) => new Date(d).toISOString()),
  }));
}

function serializeTimeEntriesForVault(entries: TimeEntry[]): any[] {
  return entries.slice(0, 1000).map((e) => ({
    id: e.id ?? 0,
    date: e.date ? new Date(e.date).toISOString() : new Date().toISOString(),
    hours: Number(e.hours) || 0,
    isCredit: Boolean(e.isCredit),
    creditType: e.creditType ? String(e.creditType).slice(0, 40) : '',
    note: e.note ? String(e.note).slice(0, 300) : '',
  }));
}

export const CloudSyncProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cloudCodeEnabled, setCloudCodeEnabled] = useState<boolean>(
    () => localStorage.getItem(CLOUD_ENABLED_KEY) === 'true'
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<string | null>(() =>
    localStorage.getItem(LAST_CLOUD_SYNC_KEY)
  );
  const [myShareCode, setMyShareCode] = useState<string>(() => generateCleanShareCode());
  const [linkedPartnerCode, setLinkedPartnerCode] = useState<string>(
    () => localStorage.getItem(LINKED_PARTNER_CODE_KEY) || ''
  );
  const [partnerName, setPartnerName] = useState<string>('');
  const [partnerVisits, setPartnerVisits] = useState<PartnerSharedVisit[]>([]);
  const [showPartnerData, setShowPartnerDataState] = useState<boolean>(() => {
    const saved = localStorage.getItem(SHOW_PARTNER_DATA_KEY);
    return saved === null ? true : saved === 'true';
  });

  const isCloudEnabled = Boolean(user || cloudCodeEnabled);

  const setShowPartnerData = (show: boolean) => {
    setShowPartnerDataState(show);
    localStorage.setItem(SHOW_PARTNER_DATA_KEY, String(show));
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (firebaseUser) {
        localStorage.setItem(CLOUD_ENABLED_KEY, 'true');
        setCloudCodeEnabled(true);
        const code = generateCleanShareCode(firebaseUser.uid);
        setMyShareCode(code);
      }
    });
    return () => unsub();
  }, []);

  const syncNowToCloud = useCallback(async (): Promise<boolean> => {
    const currentUser = auth.currentUser;
    const isCodeActive = localStorage.getItem(CLOUD_ENABLED_KEY) === 'true';
    if (!currentUser && !isCodeActive) return false;

    setIsSyncing(true);
    const code = generateCleanShareCode(currentUser?.uid);
    const sharePath = `partnerShares/${code}`;

    try {
      const [profiles, visits, timeEntries, monthlyStats] = await Promise.all([
        db.userProfile.toArray(),
        db.visits.toArray(),
        db.timeEntries.toArray(),
        db.monthlyStats.toArray(),
      ]);

      // Avoid overwriting a non-empty cloud vault with an empty uninitialized local DB
      if (profiles.length === 0 && visits.length === 0 && timeEntries.length === 0) {
        setIsSyncing(false);
        return false;
      }

      const publisherName = (
        profiles[0]?.name ||
        currentUser?.displayName ||
        'Publicador'
      )
        .trim()
        .slice(0, 120);

      const serializedVisits = serializeVisitsForVault(visits);
      const serializedTime = serializeTimeEntriesForVault(timeEntries);
      const serializedStats: MonthlyStat[] = monthlyStats.slice(0, 120).map((s) => ({
        month: String(s.month).slice(0, 10),
        studyCount: Number(s.studyCount) || 0,
      }));

      // 1. Always write to partnerShares/{code} (works on ALL domains including GitHub Pages & Android PWAs)
      const shareRef = doc(firestoreDb, 'partnerShares', code);
      let existingShareSnap;
      try {
        existingShareSnap = await getDoc(shareRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, sharePath);
      }

      const existingData = existingShareSnap?.exists() ? existingShareSnap.data() : null;
      const shareCreatedAtVal = existingData?.createdAt ? existingData.createdAt : serverTimestamp();
      const ownerIdVal = existingData?.ownerId || currentUser?.uid || getOrCreateDeviceOwnerId();

      try {
        await setDoc(shareRef, {
          shareCode: code,
          ownerId: ownerIdVal,
          ownerName: publisherName || 'Publicador',
          sharedVisits: serializeVisitsForPartner(visits),
          vaultVisits: serializedVisits,
          vaultTimeEntries: serializedTime,
          vaultMonthlyStats: serializedStats,
          createdAt: shareCreatedAtVal,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, sharePath);
      }

      // 2. If signed in with Google Auth, also mirror to /userVaults/{uid}
      if (currentUser) {
        const vaultRef = doc(firestoreDb, 'userVaults', currentUser.uid);
        try {
          const existingVaultSnap = await getDoc(vaultRef);
          const createdAtVal =
            existingVaultSnap.exists() && existingVaultSnap.data()?.createdAt
              ? existingVaultSnap.data().createdAt
              : serverTimestamp();

          await setDoc(vaultRef, {
            ownerId: currentUser.uid,
            vaultCode: code,
            publisherName: publisherName || 'Publicador',
            visits: serializedVisits,
            timeEntries: serializedTime,
            monthlyStats: serializedStats,
            createdAt: createdAtVal,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          console.warn('userVault mirror skipped:', err);
        }
      }

      const nowIso = new Date().toISOString();
      setLastCloudSyncAt(nowIso);
      localStorage.setItem(LAST_CLOUD_SYNC_KEY, nowIso);
      resetPendingBackupChanges();
      setIsSyncing(false);
      return true;
    } catch (error) {
      console.error('Cloud sync error:', error);
      setIsSyncing(false);
      return false;
    }
  }, []);

  // Automatically sync to Cloud whenever local data changes (debounced 2s)
  useEffect(() => {
    if (!isCloudEnabled) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const handleLocalMutation = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        syncNowToCloud();
      }, 2000);
    };

    window.addEventListener('morfo-db-mutated', handleLocalMutation);
    handleLocalMutation();

    return () => {
      window.removeEventListener('morfo-db-mutated', handleLocalMutation);
      if (timer) clearTimeout(timer);
    };
  }, [isCloudEnabled, syncNowToCloud]);

  // Listen to linked partner's shared document in real time (works with or without Google OAuth popup)
  useEffect(() => {
    if (!linkedPartnerCode) {
      setPartnerVisits([]);
      setPartnerName('');
      return;
    }

    const cleanCode = linkedPartnerCode.trim().toUpperCase();
    if (!/^[A-Z0-9\-]{6,16}$/.test(cleanCode)) return;

    const sharePath = `partnerShares/${cleanCode}`;
    const shareRef = doc(firestoreDb, 'partnerShares', cleanCode);

    const unsubscribe = onSnapshot(
      shareRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setPartnerName(String(data.ownerName || 'Compañero'));
          setPartnerVisits(Array.isArray(data.sharedVisits) ? data.sharedVisits : []);
        } else {
          setPartnerVisits([]);
        }
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, sharePath);
        } catch {
          // Logged
        }
      }
    );

    return () => unsubscribe();
  }, [linkedPartnerCode]);

  const checkHasCloudVault = useCallback(
    async (
      codeOrUid?: string
    ): Promise<{ exists: boolean; publisherName?: string; visitCount?: number }> => {
      // Check by ShareCode first
      const targetCode = (codeOrUid || myShareCode).trim().toUpperCase();
      if (/^[A-Z0-9\-]{6,16}$/.test(targetCode)) {
        try {
          const snap = await getDoc(doc(firestoreDb, 'partnerShares', targetCode));
          if (snap.exists()) {
            const data = snap.data();
            const vList = Array.isArray(data.vaultVisits) ? data.vaultVisits : [];
            const tList = Array.isArray(data.vaultTimeEntries) ? data.vaultTimeEntries : [];
            if (vList.length > 0 || tList.length > 0 || data.ownerName) {
              return {
                exists: true,
                publisherName: data.ownerName,
                visitCount: vList.length,
              };
            }
          }
        } catch {
          // Ignore and try userVaults if authenticated
        }
      }

      const targetUid = auth.currentUser?.uid;
      if (targetUid) {
        try {
          const snap = await getDoc(doc(firestoreDb, 'userVaults', targetUid));
          if (snap.exists()) {
            const data = snap.data();
            if (data.vaultCode) {
              localStorage.setItem(MY_SHARE_CODE_KEY, data.vaultCode);
              setMyShareCode(data.vaultCode);
            }
            const visitCount = Array.isArray(data.visits) ? data.visits.length : 0;
            return {
              exists: true,
              publisherName: data.publisherName,
              visitCount,
            };
          }
        } catch {
          // Ignore
        }
      }

      return { exists: false };
    },
    [myShareCode]
  );

  const restoreFromCloudByCode = useCallback(
    async (explicitCode?: string): Promise<boolean> => {
      setIsSyncing(true);
      try {
        const cleanCode = (explicitCode || myShareCode).trim().toUpperCase();
        let rawVisits: any[] = [];
        let rawTimeEntries: any[] = [];
        let rawMonthlyStats: any[] = [];
        let publisherName = 'Publicador';
        let updatedAtTimestamp: any = null;
        let found = false;

        // 1. Check partnerShares/{cleanCode}
        if (/^[A-Z0-9\-]{6,16}$/.test(cleanCode)) {
          const shareSnap = await getDoc(doc(firestoreDb, 'partnerShares', cleanCode));
          if (shareSnap.exists()) {
            const sData = shareSnap.data();
            rawVisits = Array.isArray(sData.vaultVisits) ? sData.vaultVisits : [];
            rawTimeEntries = Array.isArray(sData.vaultTimeEntries) ? sData.vaultTimeEntries : [];
            rawMonthlyStats = Array.isArray(sData.vaultMonthlyStats) ? sData.vaultMonthlyStats : [];
            publisherName = sData.ownerName || 'Publicador';
            updatedAtTimestamp = sData.updatedAt;
            found = true;

            // Adopt this code as our active Cloud Code
            localStorage.setItem(MY_SHARE_CODE_KEY, cleanCode);
            localStorage.setItem(CLOUD_ENABLED_KEY, 'true');
            if (sData.ownerId) {
              localStorage.setItem(DEVICE_OWNER_ID_KEY, sData.ownerId);
            }
            setMyShareCode(cleanCode);
            setCloudCodeEnabled(true);
          }
        }

        // 2. Fallback to userVaults/{uid} if signed in with Google
        if (!found && auth.currentUser) {
          const vaultSnap = await getDoc(doc(firestoreDb, 'userVaults', auth.currentUser.uid));
          if (vaultSnap.exists()) {
            const vData = vaultSnap.data();
            rawVisits = Array.isArray(vData.visits) ? vData.visits : [];
            rawTimeEntries = Array.isArray(vData.timeEntries) ? vData.timeEntries : [];
            rawMonthlyStats = Array.isArray(vData.monthlyStats) ? vData.monthlyStats : [];
            publisherName = vData.publisherName || auth.currentUser.displayName || 'Publicador';
            updatedAtTimestamp = vData.updatedAt;
            if (vData.vaultCode) {
              localStorage.setItem(MY_SHARE_CODE_KEY, vData.vaultCode);
              setMyShareCode(vData.vaultCode);
            }
            localStorage.setItem(CLOUD_ENABLED_KEY, 'true');
            setCloudCodeEnabled(true);
            found = true;
          }
        }

        if (!found) {
          setIsSyncing(false);
          return false;
        }

        const restoredVisits: Visit[] = rawVisits.map((v: any) => ({
          name: v.name || 'Sin nombre',
          phoneNumber: v.phoneNumber || '',
          dateFound: v.dateFound ? new Date(v.dateFound) : new Date(),
          latitude: typeof v.latitude === 'number' ? v.latitude : null,
          longitude: typeof v.longitude === 'number' ? v.longitude : null,
          houseDescription: v.houseDescription || '',
          generalNotes: v.generalNotes || '',
          nextVisitDate: v.nextVisitDate ? new Date(v.nextVisitDate) : null,
          interestLevel: v.interestLevel || 'Medio',
          isRecurringStudy: Boolean(v.isRecurringStudy),
          recurringStudyDayOfWeek:
            typeof v.recurringStudyDayOfWeek === 'number' ? v.recurringStudyDayOfWeek : null,
          recurringStudyTime: v.recurringStudyTime || null,
          followUpVisits: Array.isArray(v.followUpVisits)
            ? v.followUpVisits.map((f: any) => ({
                id: f.id || String(Date.now()),
                date: f.date ? new Date(f.date) : new Date(),
                notes: f.notes || '',
              }))
            : [],
          skippedDates: Array.isArray(v.skippedDates)
            ? v.skippedDates.map((d: string) => new Date(d))
            : [],
          customDates: Array.isArray(v.customDates)
            ? v.customDates.map((cd: any) => ({
                originalDate: new Date(cd.originalDate),
                newDate: new Date(cd.newDate),
              }))
            : [],
          createdAt: v.createdAt ? new Date(v.createdAt) : new Date(),
          updatedAt: v.updatedAt ? new Date(v.updatedAt) : new Date(),
        }));

        const restoredTimeEntries: TimeEntry[] = rawTimeEntries.map((e: any) => ({
          date: e.date ? new Date(e.date) : new Date(),
          hours: Number(e.hours) || 0,
          isCredit: Boolean(e.isCredit),
          creditType: e.creditType || undefined,
          note: e.note || undefined,
        }));

        const restoredMonthlyStats: MonthlyStat[] = rawMonthlyStats.map((s: any) => ({
          month: String(s.month),
          studyCount: Number(s.studyCount) || 0,
        }));

        await db.transaction(
          'rw',
          db.userProfile,
          db.visits,
          db.timeEntries,
          db.monthlyStats,
          async () => {
            await db.userProfile.clear();
            await db.visits.clear();
            await db.timeEntries.clear();
            await db.monthlyStats.clear();

            await db.userProfile.add({
              name: publisherName,
            });
            if (restoredVisits.length > 0) {
              await db.visits.bulkAdd(restoredVisits);
            }
            if (restoredTimeEntries.length > 0) {
              await db.timeEntries.bulkAdd(restoredTimeEntries);
            }
            if (restoredMonthlyStats.length > 0) {
              await db.monthlyStats.bulkPut(restoredMonthlyStats);
            }
          }
        );

        const nowIso =
          updatedAtTimestamp instanceof Timestamp
            ? updatedAtTimestamp.toDate().toISOString()
            : new Date().toISOString();
        setLastCloudSyncAt(nowIso);
        localStorage.setItem(LAST_CLOUD_SYNC_KEY, nowIso);
        resetPendingBackupChanges();
        setIsSyncing(false);
        return true;
      } catch (error) {
        console.error('Error restoring from Cloud:', error);
        setIsSyncing(false);
        return false;
      }
    },
    [myShareCode]
  );

  // Activates Cloud Sync: tries Google Popup first; if blocked by Android PWA or GitHub Pages domain, seamlessly activates Instant Cloud Code Sync!
  const activateCloudSync = async (): Promise<{
    mode: 'google' | 'code';
    code: string;
    hasExistingVault: boolean;
  }> => {
    const code = generateCleanShareCode();
    setMyShareCode(code);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        localStorage.setItem(CLOUD_ENABLED_KEY, 'true');
        setCloudCodeEnabled(true);
        const vaultCheck = await checkHasCloudVault(result.user.uid);
        await syncNowToCloud();
        return {
          mode: 'google',
          code: localStorage.getItem(MY_SHARE_CODE_KEY) || code,
          hasExistingVault: vaultCheck.exists,
        };
      }
    } catch (error: any) {
      // On Android standalone PWA or GitHub Pages, signInWithPopup may fail with auth/unauthorized-domain or auth/popup-blocked.
      // Fall back to direct Cloud Code Sync so the user's cloud backup & partner sharing work immediately!
      console.warn('Google popup unavailable on this domain/device, using Cloud Code Sync:', error?.code);
    }

    localStorage.setItem(CLOUD_ENABLED_KEY, 'true');
    setCloudCodeEnabled(true);
    const existingCheck = await checkHasCloudVault(code);
    await syncNowToCloud();

    return {
      mode: 'code',
      code,
      hasExistingVault: existingCheck.exists,
    };
  };

  const signOutCloud = async (): Promise<void> => {
    try {
      if (auth.currentUser) {
        await firebaseSignOut(auth);
      }
    } catch {
      // Ignore
    }
    localStorage.removeItem(CLOUD_ENABLED_KEY);
    setCloudCodeEnabled(false);
    setPartnerVisits([]);
    setPartnerName('');
  };

  const linkPartnerByCode = async (rawCode: string): Promise<boolean> => {
    const cleanCode = rawCode.trim().toUpperCase();
    if (!/^[A-Z0-9\-]{6,16}$/.test(cleanCode)) {
      return false;
    }

    // Ensure cloud sync is enabled on our device too
    localStorage.setItem(CLOUD_ENABLED_KEY, 'true');
    setCloudCodeEnabled(true);

    const sharePath = `partnerShares/${cleanCode}`;
    try {
      const snap = await getDoc(doc(firestoreDb, 'partnerShares', cleanCode));
      if (!snap.exists()) {
        return false;
      }
      const data = snap.data();
      setLinkedPartnerCode(cleanCode);
      localStorage.setItem(LINKED_PARTNER_CODE_KEY, cleanCode);
      setPartnerName(String(data.ownerName || 'Compañero'));
      setPartnerVisits(Array.isArray(data.sharedVisits) ? data.sharedVisits : []);
      return true;
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.GET, sharePath);
      } catch {
        // Logged
      }
      return false;
    }
  };

  const unlinkPartner = () => {
    setLinkedPartnerCode('');
    setPartnerName('');
    setPartnerVisits([]);
    localStorage.removeItem(LINKED_PARTNER_CODE_KEY);
  };

  const findScheduleConflicts = useCallback(
    (
      targetDate: Date | null,
      recurringDay?: number | null,
      recurringTime?: string | null
    ): ConflictDetail[] => {
      if (!showPartnerData || !linkedPartnerCode || partnerVisits.length === 0) {
        return [];
      }

      const conflicts: ConflictDetail[] = [];

      const parseMinutes = (timeStr: string | null | undefined): number | null => {
        if (!timeStr || !timeStr.includes(':')) return null;
        const [h, m] = timeStr.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return null;
        return h * 60 + m;
      };

      const formatMins = (mins: number): string => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      };

      for (const pv of partnerVisits) {
        if (targetDate) {
          const targetMins = targetDate.getHours() * 60 + targetDate.getMinutes();
          const targetDayOfWeek = targetDate.getDay();

          if (pv.nextVisitDate) {
            const pDate = new Date(pv.nextVisitDate);
            if (isSameDay(pDate, targetDate)) {
              const pMins = pDate.getHours() * 60 + pDate.getMinutes();
              if (Math.abs(pMins - targetMins) < 60) {
                conflicts.push({
                  partnerName: partnerName || 'Compañero',
                  visitName: pv.name,
                  timeStr: formatMins(pMins),
                  isRecurringStudy: pv.isRecurringStudy,
                });
                continue;
              }
            }
          }

          if (pv.isRecurringStudy && pv.recurringStudyDayOfWeek === targetDayOfWeek) {
            const pMins = parseMinutes(pv.recurringStudyTime);
            if (pMins !== null && Math.abs(pMins - targetMins) < 60) {
              conflicts.push({
                partnerName: partnerName || 'Compañero',
                visitName: pv.name,
                timeStr: pv.recurringStudyTime || formatMins(pMins),
                isRecurringStudy: true,
              });
              continue;
            }
          }
        }

        if (typeof recurringDay === 'number' && recurringTime) {
          const targetRecurringMins = parseMinutes(recurringTime);
          if (
            targetRecurringMins !== null &&
            pv.isRecurringStudy &&
            pv.recurringStudyDayOfWeek === recurringDay
          ) {
            const pMins = parseMinutes(pv.recurringStudyTime);
            if (pMins !== null && Math.abs(pMins - targetRecurringMins) < 60) {
              conflicts.push({
                partnerName: partnerName || 'Compañero',
                visitName: pv.name,
                timeStr: pv.recurringStudyTime || formatMins(pMins),
                isRecurringStudy: true,
              });
            }
          }
        }
      }

      return conflicts;
    },
    [showPartnerData, linkedPartnerCode, partnerVisits, partnerName]
  );

  return (
    <CloudSyncContext.Provider
      value={{
        user,
        authReady,
        isCloudEnabled,
        isSyncing,
        lastCloudSyncAt,
        myShareCode,
        linkedPartnerCode,
        partnerName,
        partnerVisits,
        showPartnerData,
        setShowPartnerData,
        activateCloudSync,
        signOutCloud,
        syncNowToCloud,
        restoreFromCloudByCode,
        checkHasCloudVault,
        linkPartnerByCode,
        unlinkPartner,
        findScheduleConflicts,
      }}
    >
      {children}
    </CloudSyncContext.Provider>
  );
};

export function useCloudSync(): CloudSyncContextType {
  const ctx = useContext(CloudSyncContext);
  if (!ctx) {
    throw new Error('useCloudSync must be used within a CloudSyncProvider');
  }
  return ctx;
}
