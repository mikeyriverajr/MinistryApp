import React, { useState, useRef } from 'react';
import { db, validateAndImportDatabase } from '../db/database';
import { useLanguage } from '../contexts/LanguageContext';
import { useCloudSync } from '../contexts/CloudSyncContext';
import { Language } from '../i18n';
import { Upload, FileText, ChevronDown, ChevronUp, Cloud } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function SetupWizard({ onComplete }: { onComplete: () => void }) {
  const [name, setName] = useState('');
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pastedJson, setPastedJson] = useState('');
  const [showCloudCodeBox, setShowCloudCodeBox] = useState(false);
  const [cloudCodeInput, setCloudCodeInput] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { language, setLanguage, t } = useLanguage();
  const { activateCloudSync, restoreFromCloudByCode, syncNowToCloud } = useCloudSync();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await db.userProfile.add({ name: name.trim() });
    await syncNowToCloud();
    onComplete();
  };

  const handleCloudSignInAndRestore = async () => {
    setIsRestoring(true);
    try {
      const res = await activateCloudSync();
      if (res.hasExistingVault) {
        const ok = await restoreFromCloudByCode(res.code);
        if (ok) {
          toast.success(t('importSuccess'));
          onComplete();
          return;
        }
      }
      // Show the Cloud Code input box so the user can enter their MORFO-XXXXXX code if restoring from a wiped browser or another phone
      setShowCloudCodeBox(true);
    } catch (error) {
      console.error('Error restoring from cloud on welcome screen:', error);
      setShowCloudCodeBox(true);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleRestoreByEnteredCode = async () => {
    if (!cloudCodeInput.trim()) return;
    setIsRestoring(true);
    try {
      const ok = await restoreFromCloudByCode(cloudCodeInput);
      if (ok) {
        toast.success(t('importSuccess'));
        onComplete();
      } else {
        toast.error(t('partnerLinkError'));
      }
    } finally {
      setIsRestoring(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    try {
      await validateAndImportDatabase(file);
      toast.success(t('importSuccess'));
      setTimeout(() => {
        window.location.reload();
      }, 900);
    } catch (error) {
      console.error('Error restoring backup from SetupWizard:', error);
      toast.error(t('invalidBackupFile'));
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePasteRestore = async () => {
    if (!pastedJson.trim()) return;
    setIsRestoring(true);
    try {
      await validateAndImportDatabase(pastedJson);
      toast.success(t('importSuccess'));
      setTimeout(() => {
        window.location.reload();
      }, 900);
    } catch (error) {
      console.error('Error restoring pasted backup:', error);
      toast.error(t('invalidBackupFile'));
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center">
        <div className="w-20 h-20 rounded-full bg-white p-3.5 shadow-md mb-4 flex items-center justify-center border border-slate-200 dark:border-slate-800">
          <img
            src="icon.svg"
            alt="Morfo"
            className="w-full h-full object-contain"
          />
        </div>
        <h2 className="text-center text-3xl font-extrabold text-slate-900 dark:text-white">
          {t('welcome')}
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
          {t('whatsYourName')}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-900 py-8 px-5 shadow-sm rounded-2xl sm:px-10 border border-slate-200 dark:border-slate-800 space-y-6">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="language" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('selectLanguage')}
              </label>
              <div className="mt-1">
                <select
                  id="language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as Language)}
                  className="block w-full px-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl shadow-2xs focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('yourName')}
              </label>
              <div className="mt-1">
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="appearance-none block w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl shadow-2xs placeholder-slate-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm"
                  placeholder={t('namePlaceholder')}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isRestoring}
                className="w-full min-h-[48px] flex justify-center items-center py-2.5 px-4 border border-transparent rounded-xl shadow-xs text-sm font-semibold text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
              >
                {t('start')}
              </button>
            </div>
          </form>

          {/* Direct Backup Restore Section (Cloud + File + Paste) */}
          <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <p className="text-xs font-medium text-center text-slate-500 dark:text-slate-400">
              {t('haveBackupQuestion')}
            </p>

            {/* 1-Tap Google / Cloud Code Restore */}
            <button
              type="button"
              disabled={isRestoring}
              onClick={handleCloudSignInAndRestore}
              className="w-full min-h-[46px] flex items-center justify-center gap-2 py-2.5 px-4 border border-primary/50 rounded-xl text-sm font-semibold text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
            >
              <Cloud size={18} />
              <span>{isRestoring ? t('importing') : t('restoreFromGoogleCloud')}</span>
            </button>

            {showCloudCodeBox && (
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={cloudCodeInput}
                  onChange={(e) => setCloudCodeInput(e.target.value.toUpperCase())}
                  placeholder={t('partnerCodePlaceholder')}
                  className="flex-1 min-h-[42px] px-3 py-2 text-xs font-mono uppercase border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="button"
                  disabled={isRestoring || !cloudCodeInput.trim()}
                  onClick={handleRestoreByEnteredCode}
                  className="min-h-[42px] px-4 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary-dark disabled:opacity-50"
                >
                  {t('restore')}
                </button>
              </div>
            )}

            <button
              type="button"
              disabled={isRestoring}
              onClick={() => fileInputRef.current?.click()}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-4 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <Upload size={17} className="text-primary" />
              <span>{t('restoreFromBackup')}</span>
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
            />

            <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center leading-relaxed">
              {t('androidFileHint')}
            </p>

            <button
              type="button"
              onClick={() => setShowPasteBox(!showPasteBox)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-primary transition-colors"
            >
              <FileText size={14} />
              <span>{t('pasteBackupText')}</span>
              {showPasteBox ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showPasteBox && (
              <div className="space-y-2 pt-1">
                <textarea
                  rows={4}
                  value={pastedJson}
                  onChange={(e) => setPastedJson(e.target.value)}
                  placeholder={t('pasteBackupPlaceholder')}
                  className="w-full p-2.5 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="button"
                  disabled={isRestoring || !pastedJson.trim()}
                  onClick={handlePasteRestore}
                  className="w-full min-h-[40px] py-2 px-4 bg-slate-800 dark:bg-slate-700 text-white rounded-xl text-xs font-semibold hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                  {t('restoreFromText')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
