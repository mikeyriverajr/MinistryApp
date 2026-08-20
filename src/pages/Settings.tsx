import { useRef, useState } from 'react';
import { exportDatabase, importDatabase, db } from '../db/database';
import { Download, Upload, Trash2, Clock, AlertTriangle, X, Share2 } from 'lucide-react';
import { encryptData } from '../utils/crypto';
import { uploadEncryptedAgenda } from '../utils/syncService';
import { useLanguage } from '../contexts/LanguageContext';
import { Language } from '../i18n';
import { toast } from 'react-hot-toast';

export default function Settings() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { language, setLanguage, t } = useLanguage();
  const [backupReminder, setBackupReminder] = useState<string>(() => localStorage.getItem('backupReminder') || 'monthly');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);

  // Shared Calendar States
  const [publishPin, setPublishPin] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedCode, setPublishedCode] = useState('');

  const [partnerCode, setPartnerCode] = useState(localStorage.getItem('partnerCode') || '');
  const [partnerPin, setPartnerPin] = useState(localStorage.getItem('partnerPin') || '');

  const handlePublishAgenda = async () => {
    if (!publishPin || publishPin.length < 4) {
      toast.error('El PIN debe tener al menos 4 caracteres');
      return;
    }

    setIsPublishing(true);
    const toastId = toast.loading('Subiendo agenda de forma segura...');
    try {
      // 1. Get raw data
      const visits = await db.visits.toArray();
      // 2. We can strip some heavy/sensitive data if desired, but for now stringify all
      const jsonData = JSON.stringify(visits);
      // 3. Encrypt
      const encrypted = await encryptData(jsonData, publishPin);
      // 4. Upload
      const pasteId = await uploadEncryptedAgenda(encrypted);

      setPublishedCode(pasteId);
      toast.success('Agenda publicada con éxito', { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error al publicar agenda', { id: toastId, duration: 5000 });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSavePartner = () => {
    if (!partnerCode || !partnerPin) {
      toast.error('Ingresa el código y el PIN');
      return;
    }
    localStorage.setItem('partnerCode', partnerCode);
    localStorage.setItem('partnerPin', partnerPin);
    toast.success('Agenda de compañero guardada');
  };

  const handleRemovePartner = () => {
    localStorage.removeItem('partnerCode');
    localStorage.removeItem('partnerPin');
    setPartnerCode('');
    setPartnerPin('');
    toast.success('Agenda de compañero eliminada');
  };

  const handleExport = async () => {
    try {
      await exportDatabase();
      localStorage.setItem('lastBackupDate', new Date().toISOString());
      toast.success('Copia de seguridad exportada');
    } catch (error) {
      console.error('Error al exportar:', error);
      toast.error('Hubo un error al exportar la base de datos.');
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
      localStorage.clear();
      toast.success(t('dataDeleted'));
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('Error deleting data', error);
      toast.error('Error eliminando datos');
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

    const importPromise = importDatabase(pendingImportFile);

    toast.promise(importPromise, {
      loading: t('importing'),
      success: () => {
        setTimeout(() => {
          window.location.reload();
        }, 1500);
        return t('importSuccess');
      },
      error: t('importError')
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

      {/* Compartir Agenda Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
        <h3 className="font-bold text-gray-700 flex items-center border-b pb-2">
          <Share2 className="mr-2" size={20} />
          Compartir Agenda
        </h3>

        {/* Publish */}
        <div className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h4 className="font-medium text-gray-700 text-sm">Publicar mi Agenda</h4>
          <p className="text-xs text-gray-500">Crea un PIN seguro para cifrar tu agenda. Tu compañero necesitará tu Código y tu PIN.</p>
          <div className="flex gap-2">
             <input
                type="password"
                placeholder="PIN (ej. 1234)"
                value={publishPin}
                onChange={e => setPublishPin(e.target.value)}
                className="flex-1 text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#e07a5f]"
             />
             <button
                onClick={handlePublishAgenda}
                disabled={isPublishing}
                className="bg-[#e07a5f] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#c45b42] disabled:opacity-50"
             >
                {isPublishing ? 'Subiendo...' : 'Publicar'}
             </button>
          </div>
          {publishedCode && (
             <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md text-sm">
                <span className="block text-green-800 mb-1">Dile a tu compañero que agregue este código:</span>
                <span className="font-mono font-bold text-lg text-green-900 bg-white px-2 py-1 rounded border border-green-300">{publishedCode}</span>
             </div>
          )}
        </div>

        {/* Subscribe */}
        <div className="space-y-3 bg-blue-50 p-4 rounded-lg border border-blue-100">
          <h4 className="font-medium text-blue-900 text-sm">Vincular Agenda de Compañero</h4>
          <p className="text-xs text-blue-700">Ingresa el Código y PIN de tu compañero para ver sus visitas en tu calendario.</p>
          <div className="flex flex-col gap-2">
             <input
                type="text"
                placeholder="Código del compañero"
                value={partnerCode}
                onChange={e => setPartnerCode(e.target.value)}
                className="w-full text-sm border border-blue-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
             />
             <input
                type="password"
                placeholder="PIN del compañero"
                value={partnerPin}
                onChange={e => setPartnerPin(e.target.value)}
                className="w-full text-sm border border-blue-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
             />
             <div className="flex gap-2 mt-1">
                <button
                  onClick={handleSavePartner}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  Guardar Compañero
                </button>
                {partnerCode && partnerPin && (
                   <button
                     onClick={handleRemovePartner}
                     className="bg-white text-red-600 border border-red-200 px-4 py-2 rounded-md text-sm font-medium hover:bg-red-50"
                   >
                     Desvincular
                   </button>
                )}
             </div>
          </div>
        </div>
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
        
        <div className="pt-4 border-t border-gray-100 mt-4">
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center justify-center w-full py-3 px-4 border border-red-200 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100"
          >
            <Trash2 className="mr-2" size={18} />
            {t('deleteAllData')}
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <div className="flex items-center text-red-600">
                <AlertTriangle size={20} className="mr-2" />
                <h3 className="font-bold">{t('deleteAllData')}</h3>
              </div>
              <button onClick={() => setShowDeleteModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-700 font-medium">
                {t('deleteAllWarningText')}
              </p>
              <p className="text-sm text-gray-500">
                {t('confirmDeleteAll')}
              </p>
            </div>
            <div className="flex border-t border-gray-100">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleDeleteAll}
                className="flex-1 py-3 text-sm font-medium text-white bg-red-600 hover:bg-red-700"
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Confirmation Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-100">
              <div className="flex items-center text-[#e07a5f]">
                <Upload size={20} className="mr-2" />
                <h3 className="font-bold">{t('importData')}</h3>
              </div>
              <button onClick={cancelImport} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-700 font-medium">
                {t('importWarning')}
              </p>
            </div>
            <div className="flex border-t border-gray-100">
              <button
                onClick={cancelImport}
                className="flex-1 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                {t('cancel')}
              </button>
              <button
                onClick={confirmImport}
                className="flex-1 py-3 text-sm font-medium text-white bg-[#e07a5f] hover:bg-[#c45b42]"
              >
                {t('importData')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
