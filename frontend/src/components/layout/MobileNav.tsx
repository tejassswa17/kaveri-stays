import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  CalendarDays,
  BookmarkCheck,
  Users,
  BarChart3,
  User,
  LogOut,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../ui/Badge';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const role = user?.role;
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleLogout = async () => {
    await logout();
    onClose();
    navigate('/login');
  };

  const navItems = [
    {
      to: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      roles: ['staff', 'manager', 'owner'],
    },
    {
      to: '/properties',
      label: 'Properties',
      icon: Building2,
      roles: ['guest', 'staff', 'manager', 'owner'],
    },
    {
      to: '/availability',
      label: 'Search Rooms',
      icon: CalendarDays,
      roles: ['guest', 'staff', 'manager', 'owner'],
    },
    {
      to: '/bookings',
      label: 'Reservations',
      icon: BookmarkCheck,
      roles: ['guest', 'staff', 'manager', 'owner'],
    },
    {
      to: '/guests',
      label: 'Guest Directory',
      icon: Users,
      roles: ['staff', 'manager', 'owner'],
    },
    {
      to: '/reports',
      label: 'Analytics & Reports',
      icon: BarChart3,
      roles: ['manager', 'owner'],
    },
    {
      to: '/profile',
      label: 'My Account',
      icon: User,
      roles: ['guest', 'staff', 'manager', 'owner'],
    },
  ];

  const allowedNavItems = navItems.filter((item) => (role ? item.roles.includes(role) : false));

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 w-72 bg-slate-900 border-r border-slate-800 p-6 flex flex-col justify-between shadow-2xl">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-500 to-brand-400 flex items-center justify-center font-bold text-white shadow-lg shadow-brand-500/20">
                K
              </div>
              <span className="font-extrabold text-lg text-white">Kaveri Stays</span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {user && (
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60">
              <p className="text-sm font-semibold text-slate-100 truncate">{user.full_name || user.email}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <Badge role={user.role} size="sm" />
              </div>
            </div>
          )}

          <nav className="space-y-1">
            {allowedNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                      isActive
                        ? 'bg-brand-500/15 text-brand-400 font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-rose-400 hover:bg-rose-500/10 transition"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};
