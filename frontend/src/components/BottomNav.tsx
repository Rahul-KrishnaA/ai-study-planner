import { NavLink } from 'react-router-dom';
import { Home, Calendar, BookOpen, BarChart2, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/home', icon: Home, label: 'Home' },
  { to: '/timetable', icon: Calendar, label: 'Timetable' },
  { to: '/subjects', icon: BookOpen, label: 'Subjects' },
  { to: '/stats', icon: BarChart2, label: 'Stats' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 z-50">
      <div className="max-w-lg mx-auto flex">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-colors ${
                isActive
                  ? 'text-primary'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  className={isActive ? 'text-primary' : ''}
                />
                <span className="text-xs font-medium">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
