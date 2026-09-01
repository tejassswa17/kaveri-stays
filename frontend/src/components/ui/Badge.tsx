import React from 'react';
import type { BookingStatus, UserRole } from '../../types';
import { getStatusBadgeColor, getRoleDisplayName } from '../../utils/formatters';

interface BadgeProps {
  children?: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  status?: BookingStatus;
  role?: UserRole | string;
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  status,
  role,
  size = 'md',
  className = '',
}) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  if (status) {
    const { bg, text, border } = getStatusBadgeColor(status);
    const displayStatus = status.replace('_', ' ').toUpperCase();
    return (
      <span
        className={`inline-flex items-center font-semibold rounded-full border ${bg} ${text} ${border} ${sizeClasses} ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
        {displayStatus}
      </span>
    );
  }

  if (role) {
    const roleColors: Record<string, { bg: string; text: string; border: string }> = {
      guest: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/30' },
      staff: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
      manager: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
      owner: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
    };
    const c = roleColors[role] || {
      bg: 'bg-slate-500/10',
      text: 'text-slate-400',
      border: 'border-slate-500/30',
    };
    return (
      <span
        className={`inline-flex items-center font-semibold rounded-full border uppercase tracking-wider ${c.bg} ${c.text} ${c.border} ${sizeClasses} ${className}`}
      >
        {getRoleDisplayName(role)}
      </span>
    );
  }

  const variantStyles = {
    default: 'bg-slate-800 text-slate-300 border-slate-700',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    danger: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    info: 'bg-brand-500/10 text-brand-400 border-brand-500/30',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${variantStyles[variant]} ${sizeClasses} ${className}`}
    >
      {children}
    </span>
  );
};
