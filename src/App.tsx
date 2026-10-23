import { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, requestPersistentStorage } from './db/database';
import SetupWizard from './components/SetupWizard';
import Dashboard from './pages/Dashboard';
import InterestedPersons from './pages/InterestedPersons';
import VisitForm from './pages/VisitForm';
import MapView from './pages/MapView';
import CalendarView from './pages/CalendarView';
import PersonRecord from './pages/PersonRecord';
import ReportView from './pages/ReportView';
import Settings from './pages/Settings';
import Navigation from './components/Navigation';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { CloudSyncProvider } from './contexts/CloudSyncContext';
import { Toaster } from 'react-hot-toast';
import { performDailyBackup } from './db/backups';

function StaticSplashScreen({ visible }: { visible: boolean }) {
  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-800 transition-opacity duration-500 ${
        visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="bg-white rounded-full p-5 shadow-lg flex items-center justify-center">
        <img src="icon.svg" alt="Morfo" className="w-24 h-24 object-contain" />
      </div>
      <h1 className="mt-5 text-3xl font-bold tracking-tight text-white">Morfo</h1>
    </div>
  );
}

function AppContent() {
  const userProfile = useLiveQuery(() => db.userProfile.toArray());
  const [isChecking, setIsChecking] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    requestPersistentStorage();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (userProfile !== undefined) {
      setIsChecking(false);
      if (userProfile.length > 0) {
        performDailyBackup();
      }
    }
  }, [userProfile]);

  if (isChecking) {
    return (
      <>
        <StaticSplashScreen visible={true} />
        <div className="min-h-screen flex items-center justify-center bg-slate-800 text-slate-300">
          {t('loading')}
        </div>
      </>
    );
  }

  if (!userProfile || userProfile.length === 0) {
    return (
      <>
        <StaticSplashScreen visible={showSplash} />
        <Toaster position="top-center" />
        <SetupWizard onComplete={() => {}} />
      </>
    );
  }

  return (
    <Router>
      <StaticSplashScreen visible={showSplash} />
      <Toaster position="top-center" />
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col pb-16 text-slate-900 dark:text-slate-100 transition-colors">
        <header className="bg-primary text-white shadow-xs sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-full bg-white p-1 flex items-center justify-center shadow-xs shrink-0">
                <img
                  src="icon.svg"
                  alt="Morfo"
                  className="w-full h-full object-contain"
                />
              </div>
              <h1 className="text-xl font-bold tracking-tight">{t('appTitle')}</h1>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-4xl w-full mx-auto p-4">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/personas" element={<InterestedPersons />} />
            <Route path="/add" element={<VisitForm />} />
            <Route path="/edit/:id" element={<VisitForm />} />
            <Route path="/person/:id" element={<PersonRecord />} />
            <Route path="/map" element={<MapView />} />
            <Route path="/calendar" element={<CalendarView />} />
            <Route path="/informe" element={<ReportView />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>

        <Navigation />
      </div>
    </Router>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <LanguageProvider>
        <CloudSyncProvider>
          <AppContent />
        </CloudSyncProvider>
      </LanguageProvider>
    </SettingsProvider>
  );
}
