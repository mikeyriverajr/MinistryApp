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
import InterestedPersons from './pages/InterestedPersons';
import { useLanguage } from './contexts/LanguageContext';
import { Bug } from 'lucide-react'; // Using Bug as a generic butterfly/insect stand-in for now

function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const userProfile = useLiveQuery(() => db.userProfile.toArray());
  const { t } = useLanguage();

  useEffect(() => {
    const initTimer = setTimeout(() => setIsInitializing(false), 100);
    // Keep splash screen visible for at least 1.5 seconds for visual branding
    const splashTimer = setTimeout(() => setShowSplash(false), 1500);
    return () => {
      clearTimeout(initTimer);
      clearTimeout(splashTimer);
    };
  }, []);

  if (isInitializing || userProfile === undefined || showSplash) {
    return (
      <div className="min-h-screen bg-[#f25f22] flex flex-col items-center justify-center text-white">
        <div className="animate-pulse flex flex-col items-center">
          <Bug size={80} className="mb-4" />
          <h1 className="text-4xl font-bold tracking-wider">Morfo</h1>
        </div>
      </div>
    );
  }

  const isSetupComplete = userProfile.length > 0;

  return (
    <Router>
      <div className="min-h-screen bg-gray-100 flex flex-col">
        <header className="bg-[#f25f22] text-white p-4 text-center font-bold text-xl sticky top-0 z-50 shadow-md">
          {t('appTitle')}
        </header>
        
        <main className="flex-1 p-4 overflow-y-auto pb-24">
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
