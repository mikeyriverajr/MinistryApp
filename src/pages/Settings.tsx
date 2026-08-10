import { useRef, useState } from 'react';
import { exportDatabase, importDatabase, db } from '../db/database';
import { Download, Upload, CheckCircle, Trash2, Clock } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Language } from '../i18n';

export default function Settings() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const { language, setLanguage, t } = useLanguage();
  const [backupReminder, setBackupReminder] = useState<string>(() => localStorage.getItem('backupReminder') || 'monthly');

  const handleExport = async () => {
    try {
      await exportDatabase();
      localStorage.setItem('lastBackupDate', new Date().toISOString());
    } catch (error) {
      console.error('Error al exportar:', error);
      alert('Hubo un error al exportar la base de datos.');
    }
  };

  const handleReminderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setBackupReminder(val);
    localStorage.setItem('backupReminder', val);
  };

  const handleDeleteAll = async () => {
    if (window.confirm(t('deleteAllWarningText') + '\n\n' + t('confirmDeleteAll'))) {
      try {
        await db.delete();
        localStorage.clear();
        alert(t('dataDeleted'));
        window.location.reload();
      } catch (error) {
        console.error('Error deleting data', error);
      }
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm(t('importWarning'))) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      setImportStatus(t('importing'));
      await importDatabase(file);
      setImportStatus(t('importSuccess'));
      setTimeout(() => {
        setImportStatus(null);
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Error al importar:', error);
      setImportStatus(t('importError'));
      setTimeout(() => setImportStatus(null), 3000);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-2xl font-bold text-gray-700">{t('settings')}</h2>
          <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-[#e07a5f]"
           >
              <option value="es">Español</option>
              <option value="en">English</option>
           </select>
        </div>
        <p className="text-gray-500 text-sm">{t('manageDataPrefs')}</p>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
        <h3 className="font-bold text-gray-700 flex items-center border-b pb-2">
          <Clock className="mr-2" size={20} />
          {t('backupReminderSettings')}
        </h3>
        <p className="text-sm text-gray-600 mb-2">
          {t('backupReminderInstructions')}
        </p>
        <select
          value={backupReminder}
          onChange={handleReminderChange}
          className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#e07a5f]"
        >
          <option value="monthly">{t('monthly')}</option>
          <option value="3months">{t('threeMonths')}</option>
          <option value="never">{t('never')}</option>
        </select>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
        <h3 className="font-bold text-gray-700 flex items-center border-b pb-2">
          {t('dataManagement')}
        </h3>
        
        <p className="text-sm text-gray-600 mb-4">
          {t('backupInstructions')}
        </p>

        <div className="grid grid-cols-1 gap-3">
          <button
            onClick={handleExport}
            className="flex items-center justify-center py-3 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="mr-2" size={18} />
            {t('exportBackup')}
          </button>
          
          <button
            onClick={handleImportClick}
            className="flex items-center justify-center py-3 px-4 border border-[#e07a5f] text-[#e07a5f] rounded-lg text-sm font-medium bg-white hover:bg-blue-50"
          >
            <Upload className="mr-2" size={18} />
            {t('importData')}
          </button>
          <input 
            type="file" 
            accept=".json" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileChange}
          />
        </div>
        
        {importStatus && (
          <div className={`mt-4 p-3 rounded-md flex items-center justify-center text-sm ${
            importStatus.includes('exitos') || importStatus.includes('success') ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
          }`}>
            {(importStatus.includes('exitos') || importStatus.includes('success')) && <CheckCircle size={16} className="mr-2" />}
            {importStatus}
          </div>
        )}

        <div className="pt-4 border-t border-gray-100 mt-4">
          <button
            onClick={handleDeleteAll}
            className="flex items-center justify-center w-full py-3 px-4 border border-red-200 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100"
          >
            <Trash2 className="mr-2" size={18} />
            {t('deleteAllData')}
          </button>
        </div>
      </div>
    </div>
  );
}
