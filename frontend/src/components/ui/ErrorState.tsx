import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Failed to load data',
  message = 'An unexpected error occurred while communicating with the server.',
  onRetry,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center rounded-2xl bg-rose-950/20 border border-rose-500/30 ${className}`}
    >
      <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 mb-3 border border-rose-500/20">
        <AlertCircle className="w-8 h-8" />
      </div>
      <h3 className="text-base font-bold text-rose-200">{title}</h3>
      <p className="text-sm text-rose-300/80 max-w-md mt-1 mb-4">{message}</p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          leftIcon={<RefreshCw className="w-4 h-4" />}
          className="border-rose-500/40 text-rose-300 hover:bg-rose-500/10 hover:border-rose-400"
        >
          Try Again
        </Button>
      )}
    </div>
  );
};
