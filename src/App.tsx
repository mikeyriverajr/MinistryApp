import { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, requestPersistentStorage } from './db/database';
import SetupWizard from './components/SetupWizard';
import Navigation from './components/Navigation';
import Dashboard from './pages/Dashboard';
import VisitForm from './pages/VisitForm';
import MapView from './pages/MapView';
import CalendarView from './pages/CalendarView';
import Settings from './pages/Settings';
import PersonRecord from './pages/PersonRecord';
import InterestedPersons from './pages/InterestedPersons';
import ReportView from './pages/ReportView';
import { useLanguage } from './contexts/LanguageContext';
import { ButterflyIcon } from './components/ButterflyIcon';
import { performDailyBackup } from './db/backups';
import { Toaster } from 'react-hot-toast';

function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const userProfile = useLiveQuery(() => db.userProfile.toArray());
  const { t } = useLanguage();

  useEffect(() => {
    const initTimer = setTimeout(() => setIsInitializing(false), 100);
    const splashTimer = setTimeout(() => setShowSplash(false), 1200);

    // Request browser persistent storage so OS doesn't evict IndexedDB
    requestPersistentStorage();

    // Perform daily internal snapshot if data exists
    performDailyBackup();

    return () => {
      clearTimeout(initTimer);
      clearTimeout(splashTimer);
    };
  }, []);

  if (isInitializing || userProfile === undefined || showSplash) {
    return (
      <div className="min-h-screen bg-slate-800 dark:bg-slate-950 flex flex-col items-center justify-center text-primary">
        <div className="animate-pulse flex flex-col items-center">
          <ButterflyIcon size={80} className="mb-4" />
          <h1 className="text-4xl font-bold tracking-wider">Morfo</h1>
        </div>
      </div>
    );
  }

  const isSetupComplete = userProfile.length > 0;

  return (
    <Router>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col transition-colors">
        <header className="bg-slate-800 dark:bg-slate-900 border-b-2 border-primary text-white h-14 px-4 flex items-center justify-center font-bold text-xl sticky top-0 z-40 shadow-sm">
          <span className="truncate">{t('appTitle')}</span>
        </header>
        
        <main className="flex-1 w-full max-w-4xl mx-auto p-4 overflow-y-auto pb-24">
          {!isSetupComplete ? (
            <SetupWizard onComplete={() => {}} />
          ) : (
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/map" element={<MapView />} />
              <Route path="/personas" element={<InterestedPersons />} />
              <Route path="/add" element={<VisitForm />} />
              <Route path="/edit/:id" element={<VisitForm />} />
              <Route path="/calendar" element={<CalendarView />} />
              <Route path="/informe" element={<ReportView />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/person/:id" element={<PersonRecord />} />
            </Routes>
          )}
        </main>
        
        {isSetupComplete && <Navigation />}
        <Toaster position="bottom-center" />
      </div>
    </Router>
  );
}

export default App;
