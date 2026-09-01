import React from 'react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-10 sm:p-14 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 ${className}`}
    >
      <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60 text-slate-400 mb-4 shadow-inner">
        {icon || <Inbox className="w-8 h-8 text-slate-500" />}
      </div>
      <h3 className="text-base font-bold text-slate-200">{title}</h3>
      {description && (
        <p className="text-sm text-slate-400 max-w-sm mt-1.5 leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
};
