import React, { useRef, useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  exportDatabase,
  shareDatabaseBackup,
  validateAndImportDatabase,
  db,
  requestPersistentStorage,
} from '../db/database';
import {
  backupsDb,
  restoreInternalSnapshot,
  clearInternalSnapshots,
} from '../db/backups';
import {
  Download,
  Upload,
  Share2,
  Trash2,
  Clock,
  AlertTriangle,
  X,
  Moon,
  Sun,
  Palette,
  Type,
  DatabaseBackup,
  ShieldCheck,
  FileText,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Cloud,
  RefreshCw,
  Users,
  Copy,
  Link2,
  Unlink,
  Eye,
  EyeOff,
  CheckCircle2,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  useSettings,
  THEME_PALETTES,
  ThemeColor,
  FontScale,
} from '../contexts/SettingsContext';
import { useCloudSync } from '../contexts/CloudSyncContext';
import { Language } from '../i18n';
import { toast } from 'react-hot-toast';

export default function Settings() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { language, setLanguage, t } = useLanguage();
  const {
    timeFormat,
    setTimeFormat,
    darkMode,
    setDarkMode,
    themeColor,
    setThemeColor,
    fontScale,
    setFontScale,
  } = useSettings();

  const {
    user,
    isSyncing,
    lastCloudSyncAt,
    myShareCode,
    linkedPartnerCode,
    partnerName,
    showPartnerData,
    setShowPartnerData,
    signInWithGoogle,
    signOutCloud,
    syncNowToCloud,
    restoreFromCloudVault,
    checkHasCloudVault,
    linkPartnerByCode,
    unlinkPartner,
  } = useCloudSync();

  const [partnerCodeInput, setPartnerCodeInput] = useState('');
  const [isLinkingPartner, setIsLinkingPartner] = useState(false);
  const [showCloudRestoreModal, setShowCloudRestoreModal] = useState(false);

  const [backupReminder, setBackupReminder] = useState<string>(
    () => localStorage.getItem('backupReminder') || 'monthly'
  );
  const [storagePersisted, setStoragePersisted] = useState<boolean>(
    () => localStorage.getItem('storagePersisted') === 'true'
  );

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);

  const [showPasteRestore, setShowPasteRestore] = useState(false);
  const [pastedBackupText, setPastedBackupText] = useState('');

  const [pendingSnapshotDate, setPendingSnapshotDate] = useState<string | null>(null);

  const internalSnapshots = useLiveQuery(() =>
    backupsDb.snapshots.orderBy('dateStr').reverse().toArray()
  );

  const [preparedBackupBlob, setPreparedBackupBlob] = useState<Blob | null>(null);

  useEffect(() => {
    requestPersistentStorage().then(setStoragePersisted);
    db.export()
      .then(setPreparedBackupBlob)
      .catch((err) => console.warn('Could not pre-generate backup blob:', err));
  }, []);

  const handleConnectGoogle = async () => {
    const signedInUser = await signInWithGoogle();
    if (!signedInUser) return;

    const vaultInfo = await checkHasCloudVault(signedInUser.uid);
    const localVisitsCount = await db.visits.count();

    // If user has a cloud backup and no local visits yet, prompt to restore; otherwise sync current data
    if (vaultInfo.exists && localVisitsCount === 0) {
      setShowCloudRestoreModal(true);
    } else {
      const ok = await syncNowToCloud();
      if (ok) toast.success(t('cloudSyncSuccess'));
    }
  };

  const handleSyncNow = async () => {
    const ok = await syncNowToCloud();
    if (ok) {
      toast.success(t('cloudSyncSuccess'));
    }
  };

  const handleConfirmCloudRestore = async () => {
    setShowCloudRestoreModal(false);
    const ok = await restoreFromCloudVault();
    if (ok) {
      toast.success(t('importSuccess'));
    } else {
      toast.error(t('noCloudBackupFound'));
    }
  };

  const handleCopyPartnerCode = async () => {
    try {
      await navigator.clipboard.writeText(myShareCode);
      toast.success(t('partnerCodeCopied'));
    } catch {
      toast.error(t('updateError'));
    }
  };

  const handleLinkPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerCodeInput.trim()) return;
    setIsLinkingPartner(true);
    try {
      // Ensure our own schedule is synced too
      await syncNowToCloud();
      const ok = await linkPartnerByCode(partnerCodeInput);
      if (ok) {
        setPartnerCodeInput('');
        toast.success(t('partnerLinkSuccess', { name: partnerName || 'Compañero' }));
      } else {
        toast.error(t('partnerLinkError'));
      }
    } finally {
      setIsLinkingPartner(false);
    }
  };

  const handleExport = async () => {
    try {
      await exportDatabase(preparedBackupBlob || undefined);
      toast.success(t('backupExported'));
    } catch (error) {
      console.error('Error al exportar:', error);
      toast.error(t('backupError'));
    }
  };

  const handleShareBackup = async () => {
    try {
      const res = await shareDatabaseBackup(preparedBackupBlob || undefined);
      toast.success(res === 'shared' ? t('backupExported') : t('shareNotSupported'));
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error('Error sharing backup:', error);
        toast.error(t('backupError'));
      }
    }
  };

  const handleReminderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setBackupReminder(val);
    localStorage.setItem('backupReminder', val);
  };

  const handleDeleteAll = async () => {
    setShowDeleteModal(false);
    try {
      await db.delete();
      await clearInternalSnapshots();
      localStorage.clear();
      toast.success(t('dataDeleted'));
      setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      console.error('Error deleting data', error);
      toast.error(t('deleteError'));
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPendingImportFile(file);
    setShowImportModal(true);
  };

  const confirmImport = async () => {
    if (!pendingImportFile) return;

    setShowImportModal(false);

    const importPromise = validateAndImportDatabase(pendingImportFile);

    toast.promise(importPromise, {
      loading: t('importing'),
      success: () => {
        setTimeout(() => {
          window.location.reload();
        }, 1200);
        return t('importSuccess');
      },
      error: t('importError'),
    });

    try {
      await importPromise;
    } catch (error) {
      console.error('Error al importar:', error);
    } finally {
      setPendingImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const cancelImport = () => {
    setShowImportModal(false);
    setPendingImportFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePasteRestore = async () => {
    if (!pastedBackupText.trim()) return;
    try {
      await validateAndImportDatabase(pastedBackupText);
      toast.success(t('importSuccess'));
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error('Error restoring pasted text:', error);
      toast.error(t('invalidBackupFile'));
    }
  };

  const confirmRestoreSnapshot = async () => {
    if (!pendingSnapshotDate) return;
    const dateStr = pendingSnapshotDate;
    setPendingSnapshotDate(null);

    try {
      await restoreInternalSnapshot(dateStr);
      toast.success(t('snapshotRestored'));
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error('Error restoring internal snapshot:', error);
      toast.error(t('importError'));
    }
  };

  const themeOptions: { id: ThemeColor; label: string; color: string }[] = [
    { id: 'orange', label: t('themeOrange'), color: THEME_PALETTES.orange.hex },
    { id: 'blue', label: t('themeBlue'), color: THEME_PALETTES.blue.hex },
    { id: 'green', label: t('themeGreen'), color: THEME_PALETTES.green.hex },
    { id: 'purple', label: t('themePurple'), color: THEME_PALETTES.purple.hex },
  ];

  const fontScaleOptions: { id: FontScale; label: string }[] = [
    { id: 'sm', label: t('textSizeSmall') },
    { id: 'md', label: t('textSizeNormal') },
    { id: 'lg', label: t('textSizeLarge') },
    { id: 'xl', label: t('textSizeXL') },
  ];

  return (
    <div className="space-y-6 pb-20 max-w-2xl mx-auto">
      {/* Header & Language/Time Preferences */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-2">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{t('settings')}</h2>
          <div className="flex gap-2">
            <select
              value={timeFormat}
              onChange={(e) => setTimeFormat(e.target.value as '12h' | '24h')}
              className="min-h-[38px] text-sm border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
              title={t('timeFormat')}
            >
              <option value="24h">24h</option>
              <option value="12h">12h</option>
            </select>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="min-h-[38px] text-sm border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
              title={t('language')}
            >
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-sm">{t('manageDataPrefs')}</p>
      </div>

      {/* 1. Automatic Cloud Backup (Firebase) */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center">
            <Cloud className="mr-2 text-primary" size={20} />
            {t('cloudSyncTitle')}
          </h3>
          {user && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 size={15} />
              <span>{t('cloudAutoSyncActive')}</span>
            </span>
          )}
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300">
          {t('cloudSyncDesc')}
        </p>

        {!user ? (
          <button
            type="button"
            onClick={handleConnectGoogle}
            className="w-full min-h-[48px] flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary-dark transition-colors shadow-2xs"
          >
            <Cloud size={18} />
            <span>{t('connectGoogleCloud')}</span>
          </button>
        ) : (
          <div className="space-y-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                  {t('cloudConnectedAs', { email: user.email || user.displayName || 'Google' })}
                </p>
                {lastCloudSyncAt && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                    {t('lastSyncedAt', {
                      time: new Date(lastCloudSyncAt).toLocaleString(),
                    })}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={signOutCloud}
                className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline"
              >
                {t('disconnectCloud')}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                disabled={isSyncing}
                onClick={handleSyncNow}
                className="min-h-[42px] flex items-center justify-center gap-2 py-2 px-3 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary-dark disabled:opacity-50 transition-colors"
              >
                <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
                <span>{t('syncNow')}</span>
              </button>
              <button
                type="button"
                disabled={isSyncing}
                onClick={() => setShowCloudRestoreModal(true)}
                className="min-h-[42px] flex items-center justify-center gap-2 py-2 px-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-medium hover:border-primary transition-colors"
              >
                <RotateCcw size={15} />
                <span>{t('restoreFromCloudBtn')}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Optional Pioneering Partner / Spouse Sharing + Independent Visibility Toggle */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 space-y-4">
        <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center border-b border-slate-100 dark:border-slate-800 pb-3">
          <Users className="mr-2 text-primary" size={20} />
          {t('partnerSectionTitle')}
        </h3>

        <p className="text-sm text-slate-600 dark:text-slate-300">
          {t('partnerSectionDesc')}
        </p>

        {!user ? (
          <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200">
            {t('partnerRequiresCloud')}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Publisher's Own Share Code */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
              <div>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {t('yourPartnerCodeLabel')}
                </span>
                <span className="text-base font-mono font-bold text-primary tracking-wider">
                  {myShareCode}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyPartnerCode}
                className="min-h-[38px] px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-primary flex items-center gap-1.5 transition-colors"
              >
                <Copy size={14} />
                <span>{t('copyPartnerCode')}</span>
              </button>
            </div>

            {/* Linked Partner Status OR Code Input */}
            {linkedPartnerCode ? (
              <div className="space-y-4 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-700">
                  <div>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100 block">
                      {t('partnerLinkedWith', { name: partnerName || linkedPartnerCode })}
                    </span>
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      {linkedPartnerCode}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={unlinkPartner}
                    className="min-h-[36px] px-3 py-1.5 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60 rounded-lg text-xs font-medium flex items-center gap-1.5 hover:bg-red-100 transition-colors"
                  >
                    <Unlink size={14} />
                    <span>{t('unlinkPartnerBtn')}</span>
                  </button>
                </div>

                {/* Independent Per-Partner Toggle: Show or Hide Partner's Schedule & Map */}
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                      {showPartnerData ? (
                        <Eye size={16} className="text-primary shrink-0" />
                      ) : (
                        <EyeOff size={16} className="text-slate-400 shrink-0" />
                      )}
                      <span>
                        {t('showPartnerDataToggle', { name: partnerName || 'Compañero' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {t('showPartnerDataDesc')}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showPartnerData}
                    onClick={() => setShowPartnerData(!showPartnerData)}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      showPartnerData ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                        showPartnerData ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleLinkPartner} className="space-y-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  {t('enterPartnerCodeLabel')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={partnerCodeInput}
                    onChange={(e) => setPartnerCodeInput(e.target.value.toUpperCase())}
                    placeholder={t('partnerCodePlaceholder')}
                    className="flex-1 min-h-[44px] px-3.5 py-2 text-sm font-mono uppercase bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="submit"
                    disabled={isLinkingPartner || !partnerCodeInput.trim()}
                    className="min-h-[44px] px-4 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary-dark disabled:opacity-50 flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <Link2 size={16} />
                    <span>{t('linkPartnerBtn')}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Appearance & Accessibility */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 space-y-5">
        <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center border-b border-slate-100 dark:border-slate-800 pb-3">
          <Palette className="mr-2 text-primary" size={20} />
          {t('appearanceAndAccessibility')}
        </h3>

        {/* Dark Mode Toggle */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-medium text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
              {darkMode ? <Moon size={16} className="text-primary" /> : <Sun size={16} className="text-primary" />}
              <span>{t('darkMode')}</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('darkModeDesc')}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={darkMode}
            onClick={() => setDarkMode(!darkMode)}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              darkMode ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                darkMode ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Color Theme Selector */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
          <label className="block text-sm font-medium text-slate-800 dark:text-slate-100 mb-2.5">
            {t('themeColor')}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {themeOptions.map((opt) => {
              const isSelected = themeColor === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setThemeColor(opt.id)}
                  className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-medium flex items-center gap-2.5 transition-all ${
                    isSelected
                      ? 'border-primary bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white ring-1 ring-primary'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ backgroundColor: opt.color }}
                  />
                  <span className="truncate">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Text Size Accessibility Selector */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
          <label className="block text-sm font-medium text-slate-800 dark:text-slate-100 mb-2.5 flex items-center gap-1.5">
            <Type size={16} className="text-primary" />
            <span>{t('textSize')}</span>
          </label>
          <div className="grid grid-cols-4 gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {fontScaleOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFontScale(opt.id)}
                className={`min-h-[40px] py-1.5 px-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap truncate ${
                  fontScale === opt.id
                    ? 'bg-white dark:bg-slate-900 text-primary shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* External Manual File Backup & Restore (Android Compatible) */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center">
            <Download className="mr-2 text-primary" size={20} />
            {t('dataManagement')}
          </h3>
          {storagePersisted && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <ShieldCheck size={15} />
              <span className="hidden sm:inline">{t('storageProtected')}</span>
            </span>
          )}
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300">
          {t('backupInstructions')}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={handleShareBackup}
            className="min-h-[48px] flex items-center justify-center py-3 px-4 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary-dark transition-colors shadow-2xs"
          >
            <Share2 className="mr-2 shrink-0" size={18} />
            <span>{t('shareBackup')}</span>
          </button>

          <button
            onClick={handleExport}
            className="min-h-[48px] flex items-center justify-center py-3 px-4 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <Download className="mr-2 shrink-0" size={18} />
            <span>{t('exportBackup')}</span>
          </button>
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
          <button
            onClick={handleImportClick}
            className="min-h-[48px] w-full flex items-center justify-center py-3 px-4 border border-primary text-primary rounded-xl text-sm font-medium bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <Upload className="mr-2 shrink-0" size={18} />
            <span>{t('importData')}</span>
          </button>
          <input
            type="file"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
            {t('androidFileHint')}
          </p>

          <button
            type="button"
            onClick={() => setShowPasteRestore(!showPasteRestore)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-primary transition-colors"
          >
            <FileText size={14} />
            <span>{t('pasteBackupText')}</span>
            {showPasteRestore ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showPasteRestore && (
            <div className="space-y-2 pt-1">
              <textarea
                rows={4}
                value={pastedBackupText}
                onChange={(e) => setPastedBackupText(e.target.value)}
                placeholder={t('pasteBackupPlaceholder')}
                className="w-full p-3 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                disabled={!pastedBackupText.trim()}
                onClick={handlePasteRestore}
                className="w-full min-h-[42px] py-2 px-4 bg-slate-800 dark:bg-slate-700 text-white rounded-xl text-xs font-semibold hover:bg-slate-700 disabled:opacity-50 transition-colors"
              >
                {t('restoreFromText')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Automatic Daily Backups (Internal Snapshots) */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 space-y-4">
        <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center border-b border-slate-100 dark:border-slate-800 pb-3">
          <DatabaseBackup className="mr-2 text-primary" size={20} />
          {t('internalBackupsTitle')}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {t('internalBackupsDesc')}
        </p>

        {!internalSnapshots || internalSnapshots.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
            {t('noInternalBackups')}
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden">
            {internalSnapshots.map((snap) => (
              <div
                key={snap.dateStr}
                className="px-4 py-3 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/40"
              >
                <div className="tabular-nums">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {t('snapshotFrom', { date: snap.dateStr })}
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {Math.max(1, Math.round((snap.blob?.size || 1024) / 1024))} KB
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingSnapshotDate(snap.dateStr)}
                  className="min-h-[38px] px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-primary text-primary rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <RotateCcw size={14} />
                  <span>{t('restore')}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Backup Reminder Frequency */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xs border border-slate-200/80 dark:border-slate-800 space-y-4">
        <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center border-b border-slate-100 dark:border-slate-800 pb-3">
          <Clock className="mr-2 text-primary" size={20} />
          {t('backupReminderSettings')}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {t('backupReminderInstructions')}
        </p>
        <select
          value={backupReminder}
          onChange={handleReminderChange}
          className="w-full min-h-[44px] text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="monthly">{t('monthly')}</option>
          <option value="3months">{t('threeMonths')}</option>
          <option value="never">{t('never')}</option>
        </select>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setShowDeleteModal(true)}
            className="min-h-[48px] flex items-center justify-center w-full py-3 px-4 border border-red-200 dark:border-red-900/60 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 transition-colors"
          >
            <Trash2 className="mr-2" size={18} />
            {t('deleteAllData')}
          </button>
        </div>
      </div>

      {/* Cloud Restore Confirmation Modal */}
      {showCloudRestoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg max-w-sm w-full overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center text-primary">
                <Cloud size={20} className="mr-2" />
                <h3 className="font-bold">{t('restoreFromCloudBtn')}</h3>
              </div>
              <button
                onClick={() => setShowCloudRestoreModal(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-slate-700 dark:text-slate-200 font-medium">
                {t('cloudRestoreConfirm')}
              </p>
            </div>
            <div className="flex border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowCloudRestoreModal(false)}
                className="flex-1 min-h-[48px] py-3 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleConfirmCloudRestore}
                className="flex-1 min-h-[48px] py-3 text-sm font-medium text-white bg-primary hover:bg-primary-dark"
              >
                {t('restore')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Data Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg max-w-sm w-full overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center text-red-600 dark:text-red-400">
                <AlertTriangle size={20} className="mr-2" />
                <h3 className="font-bold">{t('deleteAllData')}</h3>
              </div>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-slate-700 dark:text-slate-200 font-medium">
                {t('deleteAllWarningText')}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('confirmDeleteAll')}
              </p>
            </div>
            <div className="flex border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 min-h-[48px] py-3 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleDeleteAll}
                className="flex-1 min-h-[48px] py-3 text-sm font-medium text-white bg-red-600 hover:bg-red-700"
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import File Confirmation Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg max-w-sm w-full overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center text-primary">
                <Upload size={20} className="mr-2" />
                <h3 className="font-bold">{t('importData')}</h3>
              </div>
              <button
                onClick={cancelImport}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-2">
              {pendingImportFile && (
                <p className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                  {pendingImportFile.name}
                </p>
              )}
              <p className="text-sm text-slate-700 dark:text-slate-200 font-medium">
                {t('importWarning')}
              </p>
            </div>
            <div className="flex border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={cancelImport}
                className="flex-1 min-h-[48px] py-3 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {t('cancel')}
              </button>
              <button
                onClick={confirmImport}
                className="flex-1 min-h-[48px] py-3 text-sm font-medium text-white bg-primary hover:bg-primary-dark"
              >
                {t('restore')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Internal Snapshot Confirmation Modal */}
      {pendingSnapshotDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg max-w-sm w-full overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center text-primary">
                <RotateCcw size={20} className="mr-2" />
                <h3 className="font-bold">{t('restoreSnapshot')}</h3>
              </div>
              <button
                onClick={() => setPendingSnapshotDate(null)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-slate-700 dark:text-slate-200 font-medium">
                {t('restoreSnapshotWarning', { date: pendingSnapshotDate })}
              </p>
            </div>
            <div className="flex border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setPendingSnapshotDate(null)}
                className="flex-1 min-h-[48px] py-3 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {t('cancel')}
              </button>
              <button
                onClick={confirmRestoreSnapshot}
                className="flex-1 min-h-[48px] py-3 text-sm font-medium text-white bg-primary hover:bg-primary-dark"
              >
                {t('restore')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
