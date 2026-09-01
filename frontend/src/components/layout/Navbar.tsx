import React from 'react';
import { Menu, LogOut, User as UserIcon, Plus } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button, Badge } from '../ui';

interface NavbarProps {
  onOpenMobileMenu: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenMobileMenu }) => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 py-3.5 bg-slate-950/80 border-b border-slate-800/80 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          aria-label="Open mobile menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="lg:hidden font-bold text-white tracking-tight">Kaveri Stays</span>
      </div>

      <div className="flex items-center gap-3">
        {isAuthenticated ? (
          <>
            <Link to="/bookings/new">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                className="hidden sm:inline-flex"
              >
                New Booking
              </Button>
            </Link>

            <div className="flex items-center gap-3 pl-2 sm:pl-3 border-l border-slate-800">
              <Link
                to="/profile"
                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-800/60 transition group"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 group-hover:border-brand-500/50 transition">
                  <UserIcon className="w-4 h-4" />
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-slate-200">
                    {user?.full_name || user?.email?.split('@')[0] || 'User'}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {user?.role && <Badge role={user.role} size="sm" />}
                  </div>
                </div>
              </Link>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-slate-400 hover:text-rose-400 p-2"
                title="Logout"
                aria-label="Logout"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="secondary" size="sm">
                Log In
              </Button>
            </Link>
            <Link to="/register">
              <Button variant="primary" size="sm">
                Register
              </Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};
