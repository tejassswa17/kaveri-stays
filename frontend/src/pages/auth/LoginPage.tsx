import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Hotel, Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button, Input } from '../../components/ui';
import { parseApiError } from '../../api';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rateLimitTimer, setRateLimitTimer] = useState<number | null>(null);

  const { login } = useAuth();
  const { success } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const rawFrom = (location.state as any)?.from?.pathname;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const loggedUser = await login({ email: email.trim(), password });
      success('Welcome back!', 'Successfully signed in to Kaveri Stays.');

      // Default destinations: Guest -> /properties, Staff/Manager/Owner -> /dashboard
      const defaultDest = loggedUser.role === 'guest' ? '/properties' : '/dashboard';
      const dest = rawFrom && rawFrom !== '/dashboard' ? rawFrom : defaultDest;

      navigate(dest, { replace: true });
    } catch (err: any) {
      const msg = parseApiError(err);
      setErrorMessage(msg);

      if (err.response?.status === 429) {
        setRateLimitTimer(60);
        const interval = setInterval(() => {
          setRateLimitTimer((prev) => {
            if (prev === null || prev <= 1) {
              clearInterval(interval);
              return null;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 relative overflow-hidden">
      {/* Background Decorative Gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md bg-slate-900/90 border border-slate-800/90 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-xl animate-in zoom-in-95">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-400 text-white shadow-xl shadow-brand-500/30 mb-4">
            <Hotel className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Kaveri Stays</h1>
          <p className="text-sm text-slate-400 mt-1">Sign in to your hotel management account</p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3 animate-in fade-in">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
            <div>
              <p className="font-semibold">{errorMessage}</p>
              {rateLimitTimer && (
                <p className="text-xs text-rose-400 mt-1">
                  Rate limit active. Please wait {rateLimitTimer} seconds before retrying.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail className="w-4 h-4" />}
            required
            autoComplete="email"
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock className="w-4 h-4" />}
            required
            autoComplete="current-password"
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isLoading}
            disabled={isLoading || rateLimitTimer !== null}
            rightIcon={<ArrowRight className="w-4 h-4" />}
            className="w-full mt-2"
          >
            Sign In
          </Button>
        </form>

        {/* Register Link */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 text-center text-xs text-slate-400">
          New guest visiting Kaveri Stays?{' '}
          <Link to="/register" className="text-brand-400 hover:text-brand-300 font-semibold underline">
            Register an account
          </Link>
        </div>
      </div>
    </div>
  );
};
