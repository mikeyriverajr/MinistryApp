import { useRef, useState, useEffect } from 'react';
import { exportDatabase, importDatabase } from '../db/database';
import { Download, Upload, Bell, CheckCircle } from 'lucide-react';

export default function Settings() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermission | 'unsupported'>('default');

  useEffect(() => {
    if (!('Notification' in window)) {
      setNotificationStatus('unsupported');
    } else {
      setNotificationStatus(Notification.permission);
    }
  }, []);

  const handleExport = async () => {
    try {
      await exportDatabase();
    } catch (error) {
      console.error('Error al exportar:', error);
      alert('Hubo un error al exportar la base de datos.');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('¿Estás seguro? Importar sobrescribirá TODOS tus datos actuales.')) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      setImportStatus('Importando...');
      await importDatabase(file);
      setImportStatus('¡Importación exitosa!');
      setTimeout(() => {
        setImportStatus(null);
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Error al importar:', error);
      setImportStatus('Error en la importación.');
      setTimeout(() => setImportStatus(null), 3000);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('Este navegador no soporta notificaciones de escritorio.');
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationStatus(permission);

    if (permission === 'granted') {
      new Notification('¡Notificaciones activadas!', {
        body: 'Recibirás recordatorios de tus revisitas y estudios.',
        icon: '/vite.svg'
      });
      // In a real app with a backend, we would subscribe to push notifications here
      // and register a service worker. For this local PWA, we're setting up the
      // foundation for local notifications or future Push API integration.
      if ('serviceWorker' in navigator) {
          navigator.serviceWorker.register('/service-worker.js').then(registration => {
              console.log('SW registered:', registration);
          }).catch(error => {
              console.log('SW registration failed:', error);
          });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Ajustes</h2>
        <p className="text-gray-500 text-sm">Gestiona tus datos y preferencias</p>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
        <h3 className="font-bold text-gray-700 flex items-center border-b pb-2">
          <Bell className="mr-2" size={20} />
          Notificaciones
        </h3>

        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm font-medium text-gray-800">Alertas de visitas</p>
            <p className="text-xs text-gray-500">
              {notificationStatus === 'granted' ? 'Activadas' :
               notificationStatus === 'denied' ? 'Bloqueadas por el navegador' :
               notificationStatus === 'unsupported' ? 'No soportado' : 'No configuradas'}
            </p>
          </div>

          <button
            onClick={requestNotificationPermission}
            disabled={notificationStatus === 'granted' || notificationStatus === 'unsupported'}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              notificationStatus === 'granted'
                ? 'bg-green-100 text-green-800 cursor-not-allowed'
                : 'bg-[#26818E] text-white hover:bg-[#1d616a]'
            }`}
          >
            {notificationStatus === 'granted' ? 'Activadas' : 'Activar'}
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
        <h3 className="font-bold text-gray-700 flex items-center border-b pb-2">
          Gestión de Datos
        </h3>

        <p className="text-sm text-gray-600 mb-4">
          Crea una copia de seguridad de tus registros o restaura datos de otro dispositivo.
        </p>

        <div className="grid grid-cols-1 gap-3">
          <button
            onClick={handleExport}
            className="flex items-center justify-center py-3 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Download className="mr-2" size={18} />
            Exportar Copia de Seguridad
          </button>

          <button
            onClick={handleImportClick}
            className="flex items-center justify-center py-3 px-4 border border-[#26818E] text-[#26818E] rounded-lg text-sm font-medium bg-white hover:bg-blue-50"
          >
            <Upload className="mr-2" size={18} />
            Importar Datos
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
            importStatus.includes('exitosa') ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
          }`}>
            {importStatus.includes('exitosa') && <CheckCircle size={16} className="mr-2" />}
            {importStatus}
          </div>
        )}
      </div>
    </div>
  );
}
