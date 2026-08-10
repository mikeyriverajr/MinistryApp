import { NavLink } from 'react-router-dom';
import { Home, Users, Calendar, Settings, PlusCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function Navigation() {
  const { t } = useLanguage();

  const navItems = [
    { to: '/', icon: Home, label: t('navDashboard') },
    { to: '/personas', icon: Users, label: t('interestedPersons') },
    { to: '/add', icon: PlusCircle, label: t('registerNewVisit').split(' ')[0] },
    { to: '/calendar', icon: Calendar, label: t('navCalendar') },
    { to: '/settings', icon: Settings, label: t('navSettings') },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-700 border-t-2 border-[#e07a5f] px-2 py-3 pb-safe z-50">
      <ul className="flex justify-around items-center">
        {navItems.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center p-2 rounded-lg transition-colors ${
                  isActive ? 'text-[#e07a5f]' : 'text-slate-400 hover:text-[#e07a5f]'
                }`
              }
            >
              <item.icon size={24} />
              <span className="text-xs mt-1">{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
