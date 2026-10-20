import { NavLink } from 'react-router-dom';
import { Home, Users, Calendar, Settings, ClipboardList } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function Navigation() {
  const { t } = useLanguage();

  const navItems = [
    { to: '/', icon: Home, label: t('navDashboard') },
    { to: '/personas', icon: Users, label: t('interestedPersons') },
    { to: '/calendar', icon: Calendar, label: t('navCalendar') },
    { to: '/informe', icon: ClipboardList, label: t('navReport') },
    { to: '/settings', icon: Settings, label: t('navSettings') },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 dark:bg-slate-900 border-t-2 border-primary px-2 py-1.5 pb-safe z-40">
      <ul className="max-w-4xl mx-auto grid grid-cols-5 items-center">
        {navItems.map((item) => (
          <li key={item.to} className="flex justify-center">
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `min-h-[48px] min-w-[48px] w-full flex flex-col items-center justify-center py-1 px-1 rounded-lg transition-colors ${
                  isActive
                    ? 'text-primary font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`
              }
            >
              <item.icon size={22} />
              <span className="text-[11px] mt-1 whitespace-nowrap truncate max-w-full">{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
