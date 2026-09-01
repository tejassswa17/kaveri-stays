import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  CalendarDays,
  BookmarkCheck,
  Users,
  BarChart3,
  User,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../ui/Badge';

export const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const role = user?.role;

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
    <aside className="hidden lg:flex flex-col w-64 border-r border-slate-800 bg-slate-900/60 backdrop-blur-xl p-4 min-h-screen justify-between shrink-0">
      <div className="space-y-6">
        {/* Brand Logo */}
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center font-extrabold text-white shadow-lg shadow-brand-500/25">
            K
          </div>
          <div>
            <span className="font-extrabold text-lg text-white tracking-tight">
              Kaveri Stays
            </span>
            <span className="text-[10px] block text-brand-400 font-semibold tracking-wider uppercase">
              Hospitality PMS
            </span>
          </div>
        </div>

        {/* User Card */}
        {user && (
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 shadow-inner">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 truncate max-w-[120px]">
                {user.full_name || 'Active User'}
              </span>
              <Badge role={user.role} size="sm" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1 truncate">{user.email}</p>
            {user.property_id && (
              <p className="text-[10px] text-brand-300/80 mt-1 font-mono">
                Property #{user.property_id}
              </p>
            )}
          </div>
        )}

        {/* Navigation List */}
        <nav className="space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300 px-3 pb-1">
            Navigation
          </p>
          {allowedNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-brand-500/15 text-brand-400 font-semibold shadow-sm border border-brand-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Role Scoping Note */}
      <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 text-[11px] text-slate-300 flex items-start gap-2">
        <ShieldAlert className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
        <span>
          Access level: <strong className="text-slate-200 uppercase">{role}</strong>
        </span>
      </div>
    </aside>
  );
};
