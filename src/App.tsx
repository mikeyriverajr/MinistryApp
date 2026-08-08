import { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db/database';
import SetupWizard from './components/SetupWizard';
import Navigation from './components/Navigation';
import Dashboard from './pages/Dashboard';
import VisitForm from './pages/VisitForm';
import MapView from './pages/MapView';
import CalendarView from './pages/CalendarView';
import Settings from './pages/Settings';
import PersonRecord from './pages/PersonRecord';
import { useLanguage } from './contexts/LanguageContext';

function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const userProfile = useLiveQuery(() => db.userProfile.toArray());
  const { t } = useLanguage();

  useEffect(() => {
    const timer = setTimeout(() => setIsInitializing(false), 100);
    return () => clearTimeout(timer);
  }, []);

  if (isInitializing || userProfile === undefined) {
    return <div className="min-h-screen bg-gray-100 flex items-center justify-center">{t('loading')}</div>;
  }

  const isSetupComplete = userProfile.length > 0;

  return (
    <Router>
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <header className="bg-[#26818E] text-white p-4 text-center font-bold text-xl sticky top-0 z-50 shadow-md">
          {t('appTitle')}
        </header>
        
        <main className="flex-1 p-4 overflow-y-auto pb-24">
          {!isSetupComplete ? (
            <SetupWizard onComplete={() => {}} />
          ) : (
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/map" element={<MapView />} />
              <Route path="/add" element={<VisitForm />} />
              <Route path="/edit/:id" element={<VisitForm />} />
              <Route path="/calendar" element={<CalendarView />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/person/:id" element={<PersonRecord />} />
            </Routes>
          )}
        </main>
        
        {isSetupComplete && <Navigation />}
      </div>
    </Router>
  );
}

export default App;
