import { NavLink } from 'react-router-dom';
import { Home, Map as MapIcon, Calendar, Settings, PlusCircle } from 'lucide-react';

export default function Navigation() {
  const navItems = [
    { to: '/', icon: Home, label: 'Inicio' },
    { to: '/map', icon: MapIcon, label: 'Mapa' },
    { to: '/add', icon: PlusCircle, label: 'Añadir' },
    { to: '/calendar', icon: Calendar, label: 'Calendario' },
    { to: '/settings', icon: Settings, label: 'Ajustes' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-3 pb-safe z-50">
      <ul className="flex justify-around items-center">
        {navItems.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center p-2 rounded-lg transition-colors ${
                  isActive ? 'text-[#26818E]' : 'text-gray-500 hover:text-[#26818E]'
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
