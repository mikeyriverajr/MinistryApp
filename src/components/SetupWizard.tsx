import React, { useState, useRef } from 'react';
import { db, validateAndImportDatabase } from '../db/database';
import { useLanguage } from '../contexts/LanguageContext';
import { Language } from '../i18n';
import { Upload, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface SetupWizardProps {
  onComplete: () => void;
}

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const [name, setName] = useState('');
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { language, setLanguage, t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      await db.userProfile.add({ name: name.trim() });
      onComplete();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    try {
      await validateAndImportDatabase(file);
      toast.success(t('importSuccess'));
      setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      console.error('Error restoring backup from SetupWizard:', error);
      toast.error(t('invalidBackupFile'));
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePasteRestore = async () => {
    if (!pastedText.trim()) return;
    setIsRestoring(true);
    try {
      await validateAndImportDatabase(pastedText);
      toast.success(t('importSuccess'));
      setTimeout(() => window.location.reload(), 800);
    } catch (error) {
      console.error('Error restoring pasted backup:', error);
      toast.error(t('invalidBackupFile'));
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] py-6">
      <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 w-full max-w-md space-y-6">
        <div className="flex justify-end">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="text-sm border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-center text-primary">{t('welcome')}</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-2 text-center text-sm">{t('whatsYourName')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('yourName')}
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder={t('namePlaceholder')}
              required
            />
          </div>
          <button
            type="submit"
            className="w-full min-h-[44px] flex items-center justify-center py-2.5 px-4 rounded-lg shadow-sm text-sm font-semibold text-white bg-primary hover:bg-primary-dark transition-colors"
          >
            {t('start')}
          </button>
        </form>

        {/* Direct Restore Section for users recovering from cleared browser data */}
        <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 text-center">
            {t('haveBackupQuestion')}
          </p>

          <button
            type="button"
            disabled={isRestoring}
            onClick={() => fileInputRef.current?.click()}
            className="w-full min-h-[44px] flex items-center justify-center gap-2 py-2.5 px-4 border border-primary text-primary rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <Upload size={18} />
            <span>{isRestoring ? t('importing') : t('restoreFromBackup')}</span>
          </button>
          {/* No restrictive accept attribute so Android never grays out .json files */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
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
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder={t('pasteBackupPlaceholder')}
                className="w-full p-2.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                disabled={isRestoring || !pastedText.trim()}
                onClick={handlePasteRestore}
                className="w-full min-h-[40px] py-2 px-3 bg-slate-800 dark:bg-slate-700 text-white rounded-lg text-xs font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors"
              >
                {t('restoreFromText')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
