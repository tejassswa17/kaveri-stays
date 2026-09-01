import React from 'react';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  accentColor?: 'brand' | 'indigo' | 'amber' | 'emerald' | 'purple';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  accentColor = 'brand',
}) => {
  const colorGradients = {
    brand: 'from-brand-500/20 to-transparent border-brand-500/30 text-brand-400',
    indigo: 'from-indigo-500/20 to-transparent border-indigo-500/30 text-indigo-400',
    amber: 'from-amber-500/20 to-transparent border-amber-500/30 text-amber-400',
    emerald: 'from-emerald-500/20 to-transparent border-emerald-500/30 text-emerald-400',
    purple: 'from-purple-500/20 to-transparent border-purple-500/30 text-purple-400',
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-slate-900/80 border border-slate-800/80 p-6 backdrop-blur-sm shadow-lg hover:border-slate-700/80 transition group">
      {/* Accent glow on hover */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${colorGradients[accentColor]} opacity-10 group-hover:opacity-20 transition`}
      />

      <div className="relative z-10 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-slate-100 mt-2 tracking-tight">
            {value}
          </p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
          {trend && (
            <div className="flex items-center gap-1 mt-2 text-xs font-medium">
              <span className={trend.isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                {trend.value}
              </span>
              <span className="text-slate-500">vs last period</span>
            </div>
          )}
        </div>
        {icon && (
          <div
            className={`p-3 rounded-xl bg-slate-800/80 border border-slate-700/50 ${colorGradients[accentColor].split(' ').pop()}`}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};
