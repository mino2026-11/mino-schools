/**
 * MINO Platform Administration Authentication Page (/admin)
 * Dedicated full-screen authentication portal accessible via /admin,
 * with local Platform Director credential quick-fill and instant sign-in.
 */

import React, { useState, useMemo } from 'react';
import {
  Lock,
  Mail,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  KeyRound
} from 'lucide-react';
import { api } from '../services/api';

interface AdminAuthPageProps {
  onSuccess: (user?: { email: string; name: string }) => void;
  onBackToWebsite: () => void;
}

export const AdminAuthPage: React.FC<AdminAuthPageProps> = ({
  onSuccess,
  onBackToWebsite
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const localOwnerCred = useMemo(() => api.getQuickPlatformOwnerCredential(), []);

  async function executeOwnerLogin(targetEmail: string, targetPassword: string) {
    setError(null);
    if (!targetEmail.trim() || !targetPassword.trim()) {
      setError('Please enter both your administrator email and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.loginPlatformOwner(targetEmail.trim(), targetPassword);
      onSuccess(res?.user);
    } catch (err: any) {
      setError(err.message || 'Invalid administrator credentials. Please verify your email and password.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await executeOwnerLogin(email, password);
  }

  function handleFillLocalOwner() {
    setError(null);
    setEmail(localOwnerCred.email);
    setPassword(localOwnerCred.password);
  }

  async function handleInstantOwnerSignIn() {
    setEmail(localOwnerCred.email);
    setPassword(localOwnerCred.password);
    await executeOwnerLogin(localOwnerCred.email, localOwnerCred.password);
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 font-sans antialiased">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mb-5">
          <button
            type="button"
            onClick={onBackToWebsite}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Website</span>
          </button>
        </div>

        {/* Auth Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-md space-y-6">
          {/* App Logo & Title */}
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 p-2 shadow-2xs mx-auto flex items-center justify-center">
              <img
                src="/assets/aistudio/logo_234aadf4.png"
                alt="MINO Logo"
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight pt-1">
              MINO Admin Access
            </h1>
            <p className="text-xs text-slate-500">
              Sign in with your platform administrator credentials to continue.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label
                htmlFor="admin-email"
                className="block font-semibold text-slate-700 uppercase tracking-wider text-[11px] mb-1.5"
              >
                Administrator Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="admin-email"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@mino.com"
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-[#0F172A] focus:bg-white transition-colors"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block font-semibold text-slate-700 uppercase tracking-wider text-[11px] mb-1.5"
              >
                Master Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter master password"
                  className="w-full pl-10 pr-10 py-2.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-[#0F172A] focus:bg-white transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] py-2.5 text-xs font-bold rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-colors shadow-xs"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>Sign In to Admin Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Local Platform Owner Credentials Card */}
          <div className="border border-slate-200 rounded-xl bg-slate-50 p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <KeyRound className="w-3.5 h-3.5 text-slate-700 shrink-0" />
              <span>Local Platform Director Account</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white border border-slate-200 rounded-lg p-2.5">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-900 truncate">
                  MINO Platform Super Admin
                </p>
                <p className="text-[11px] font-mono text-slate-600 truncate">
                  {localOwnerCred.email} · <span className="text-slate-900 font-semibold">{localOwnerCred.password}</span>
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleFillLocalOwner}
                  className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition-colors disabled:opacity-50"
                >
                  Fill
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleInstantOwnerSignIn}
                  className="px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-[#0F172A] hover:bg-[#1E293B] text-white transition-colors disabled:opacity-50"
                >
                  Sign In
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
