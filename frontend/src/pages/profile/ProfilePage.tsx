import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User, ShieldCheck, Building2, Key, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Button, Badge } from '../../components/ui';

export const ProfilePage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <PageHeader
        title="Account & Profile"
        subtitle="Manage your authenticated session and view role permissions"
        actions={
          <Button
            variant="danger"
            onClick={handleLogout}
            leftIcon={<LogOut className="w-4 h-4" />}
          >
            Sign Out
          </Button>
        }
      />

      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex items-center gap-4 pb-6 border-b border-slate-800">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-400 text-white flex items-center justify-center font-bold text-2xl shadow-lg shadow-brand-500/25">
            {user?.full_name ? user.full_name[0].toUpperCase() : 'U'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">{user?.full_name || 'Hotel User'}</h2>
            <p className="text-sm text-slate-400 mt-0.5">{user?.email}</p>
            <div className="mt-2 flex items-center gap-2">
              {user?.role && <Badge role={user.role} size="sm" />}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 mb-1">
              <User className="w-4 h-4 text-brand-400" />
              Account ID
            </span>
            <p className="text-base font-bold text-slate-100 font-mono">
              #{user?.account_id}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 mb-1">
              <Building2 className="w-4 h-4 text-indigo-400" />
              Assigned Property
            </span>
            <p className="text-base font-bold text-slate-100 font-mono">
              {user?.property_id ? `Property #${user.property_id}` : 'Global (All Properties)'}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Role Authorization
            </span>
            <p className="text-base font-bold text-slate-100 capitalize">
              {user?.role} Access
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 mb-1">
              <Key className="w-4 h-4 text-amber-400" />
              Token Security
            </span>
            <p className="text-base font-bold text-slate-100">
              Dual JWT (Rotating Refresh)
            </p>
          </div>
        </div>

        {/* Notice regarding User Management / Role Assignment */}
        <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 text-xs text-slate-400 space-y-1">
          <p className="font-semibold text-slate-300">Administrative Notice:</p>
          <p>
            Role assignment and staff provisioning currently require backend/database administration;
            frontend user-management API is not exposed by the backend.
          </p>
        </div>
      </div>
    </div>
  );
};
