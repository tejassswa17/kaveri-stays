import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingSpinner: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}> = ({ size = 'md', label = 'Loading...', className = '' }) => {
  const sizeStyles = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={`flex flex-col items-center justify-center p-8 gap-3 text-slate-400 ${className}`}>
      <Loader2 className={`${sizeStyles[size]} animate-spin text-brand-400`} />
      {label && <p className="text-sm font-medium animate-pulse">{label}</p>}
    </div>
  );
};

export const LoadingSkeleton: React.FC<{
  count?: number;
  className?: string;
}> = ({ count = 3, className = 'h-16' }) => {
  return (
    <div className="space-y-3 w-full animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`bg-slate-800/60 rounded-xl border border-slate-700/40 w-full ${className}`} />
      ))}
    </div>
  );
};
