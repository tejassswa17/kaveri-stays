import type { BookingStatus, UserRole } from '../types';

export const formatCurrency = (amount: string | number | null | undefined): string => {
  if (amount === null || amount === undefined || amount === '') return '₹0.00';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

export const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'N/A';
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

export const formatMonthYear = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'N/A';
  try {
    const [year, month] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

export const formatPercent = (valueStr: string | number | null | undefined): string => {
  if (valueStr === null || valueStr === undefined || valueStr === '') return '0.0%';
  const num = typeof valueStr === 'string' ? parseFloat(valueStr) : valueStr;
  if (isNaN(num)) return '0.0%';
  return `${num.toFixed(1)}%`;
};

export const getStatusBadgeColor = (
  status: BookingStatus
): { bg: string; text: string; border: string } => {
  switch (status) {
    case 'confirmed':
      return {
        bg: 'bg-blue-500/10',
        text: 'text-blue-400',
        border: 'border-blue-500/30',
      };
    case 'checked_in':
      return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
      };
    case 'checked_out':
      return {
        bg: 'bg-purple-500/10',
        text: 'text-purple-400',
        border: 'border-purple-500/30',
      };
    case 'cancelled':
      return {
        bg: 'bg-rose-500/10',
        text: 'text-rose-400',
        border: 'border-rose-500/30',
      };
    case 'no_show':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
      };
    default:
      return {
        bg: 'bg-slate-500/10',
        text: 'text-slate-400',
        border: 'border-slate-500/30',
      };
  }
};

export const getRoleDisplayName = (role: UserRole | string): string => {
  switch (role) {
    case 'guest':
      return 'Guest';
    case 'staff':
      return 'Staff Member';
    case 'manager':
      return 'Hotel Manager';
    case 'owner':
      return 'Chain Owner';
    default:
      return role;
  }
};
