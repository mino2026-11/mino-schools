/**
 * MINO-SMS Dedicated Role Authentication Pages
 * Individual login experiences for Student, Teacher, Admin, and Guardian.
 * Authenticates via School Code (overall unique school ID) + Email/Admission No + Password,
 * with built-in Local Credentials quick-access for instant login on Vercel or local sessions.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  BookOpen,
  ShieldCheck,
  HeartHandshake,
  Hash,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  KeyRound,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { api } from '../services/api';
import type { LocalQuickCredential } from '../services/localBackend';
import type { LoginRole, SchoolTenant, UserRole } from '../types';

export interface RoleLoginSuccessPayload {
  role: UserRole;
  loginRole?: LoginRole;
  user: any;
  school: SchoolTenant;
  studentPortalData?: any;
  parentPortalData?: any;
}

interface SharedRoleLoginProps {
  initialSchoolCode?: string;
  onBackToRoleSelect: () => void;
  onBackToLanding: () => void;
  onGoToEnrollSchool?: () => void;
  onGoToPlatformAdmin?: () => void;
  onLoginSuccess: (sessionData: RoleLoginSuccessPayload) => void;
}

interface RoleAuthTemplateProps extends SharedRoleLoginProps {
  role: LoginRole;
  heading: string;
  subtitle: string;
  emailLabel: string;
  emailPlaceholder: string;
  passwordPlaceholder?: string;
  schoolCodeHint: string;
  submitLabel: string;
  buttonBgClass: string;
  focusBorderClass: string;
  iconBgClass: string;
  IconComponent: React.ComponentType<{ className?: string }>;
  showEnrollSchoolPrompt?: boolean;
}

const RoleAuthTemplate: React.FC<RoleAuthTemplateProps> = ({
  role,
  heading,
  subtitle,
  emailLabel,
  emailPlaceholder,
  passwordPlaceholder = 'Enter your password',
  schoolCodeHint,
  submitLabel,
  buttonBgClass,
  focusBorderClass,
  iconBgClass,
  IconComponent,
  showEnrollSchoolPrompt,
  initialSchoolCode = '',
  onBackToRoleSelect,
  onBackToLanding,
  onGoToEnrollSchool,
  onGoToPlatformAdmin,
  onLoginSuccess
}) => {
  const [schoolCode, setSchoolCode] = useState(initialSchoolCode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [quickSigningEmail, setQuickSigningEmail] = useState<string | null>(null);
  const [showLocalAccounts, setShowLocalAccounts] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const localCredentials = useMemo<LocalQuickCredential[]>(
    () => api.getQuickCredentialsForRole(role),
    [role]
  );

  useEffect(() => {
    if (initialSchoolCode) {
      setSchoolCode(initialSchoolCode);
    }
  }, [initialSchoolCode]);

  async function executeLogin(targetCode: string, targetIdentifier: string, targetPass: string) {
    setError(null);
    const normalizedCode = targetCode.trim().toUpperCase();
    const normalizedIdentifier = targetIdentifier.trim().toLowerCase();

    if (!normalizedCode) {
      setError('Please enter your School Code.');
      return;
    }
    if (!normalizedIdentifier || (role !== 'student' && !normalizedIdentifier.includes('@'))) {
      setError(role === 'student' ? 'Please enter your Student Email or Admission No.' : 'Please enter a valid email address.');
      return;
    }
    if (!targetPass) {
      setError('Please enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.loginWithRole({
        role,
        schoolCode: normalizedCode,
        email: normalizedIdentifier,
        password: targetPass
      });
      onLoginSuccess(response);
    } catch (err: any) {
      setError(err.message || 'Sign in failed. Please check your School Code, email, and password.');
    } finally {
      setSubmitting(false);
      setQuickSigningEmail(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await executeLogin(schoolCode, email, password);
  }

  function handleFillCredential(cred: LocalQuickCredential) {
    setError(null);
    setSchoolCode(cred.schoolCode);
    setEmail(cred.email);
    setPassword(cred.password);
  }

  async function handleInstantSignIn(cred: LocalQuickCredential) {
    setSchoolCode(cred.schoolCode);
    setEmail(cred.email);
    setPassword(cred.password);
    setQuickSigningEmail(`${cred.schoolCode}:${cred.email}`);
    await executeLogin(cred.schoolCode, cred.email, cred.password);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans antialiased">
      {/* Top Navigation Bar */}
      <header className="h-14 sm:h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
        <button
          type="button"
          onClick={onBackToLanding}
          className="flex items-center gap-2.5 text-left"
        >
          <img
            src="/assets/aistudio/logo_234aadf4.png"
            alt="MINO Logo"
            referrerPolicy="no-referrer"
            className="w-8 h-8 sm:w-9 sm:h-9 object-contain shrink-0"
          />
          <span className="font-bold text-lg sm:text-xl tracking-tight text-slate-900 leading-none">
            MINO
          </span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBackToRoleSelect}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 rounded-lg border border-slate-200 hover:bg-slate-100 inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Change Role</span>
          </button>
          <button
            type="button"
            onClick={onBackToLanding}
            className="hidden sm:inline-flex px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Homepage
          </button>
        </div>
      </header>

      {/* Main Role Login Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Card Header */}
          <div className="p-6 sm:p-7 pb-5 border-b border-slate-200 flex items-start gap-4">
            <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${iconBgClass}`}>
              <IconComponent className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {heading}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {subtitle}
              </p>
            </div>
          </div>

          {/* Credentials Form */}
          <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-4">
            {error && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* School Code Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                School Code <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Hash className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  autoFocus={!initialSchoolCode}
                  value={schoolCode}
                  onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                  placeholder="e.g., OMA-1001"
                  autoComplete="organization"
                  className={`w-full pl-10 pr-3.5 py-2.5 text-sm font-mono font-bold uppercase tracking-wider rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:normal-case focus:outline-none ${focusBorderClass}`}
                />
              </div>
              <p className="text-[11px] text-slate-500">
                {schoolCodeHint}
              </p>
            </div>

            {/* Email / Identifier Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                {emailLabel} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={role === 'student' ? 'text' : 'email'}
                  required
                  autoFocus={Boolean(initialSchoolCode)}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={emailPlaceholder}
                  autoComplete={role === 'student' ? 'username' : 'email'}
                  className={`w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none ${focusBorderClass}`}
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={passwordPlaceholder}
                  autoComplete="current-password"
                  className={`w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none ${focusBorderClass}`}
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

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className={`w-full min-h-[46px] py-3 px-5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs disabled:opacity-60 ${buttonBgClass}`}
              >
                <span>{submitting && !quickSigningEmail ? 'Signing In...' : submitLabel}</span>
                {(!submitting || quickSigningEmail) && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </form>

          {/* Local Credentials Directory (Instant Sign-In / Auto-Fill) */}
          {localCredentials.length > 0 && (
            <div className="px-6 sm:px-7 pb-6">
              <div className="border border-slate-200 rounded-xl bg-slate-50/80 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowLocalAccounts(!showLocalAccounts)}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-slate-100/80 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                    <span className="text-xs font-bold text-slate-800 tracking-tight">
                      Local Credentials ({localCredentials.length})
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                    <span>{showLocalAccounts ? 'Hide' : 'Show'}</span>
                    {showLocalAccounts ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </div>
                </button>

                {showLocalAccounts && (
                  <div className="divide-y divide-slate-200 border-t border-slate-200 bg-white max-h-64 overflow-y-auto">
                    {localCredentials.map((cred) => {
                      const credKey = `${cred.schoolCode}:${cred.email}`;
                      const isThisSigning = submitting && quickSigningEmail === credKey;
                      return (
                        <div
                          key={credKey}
                          className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50 transition-colors"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-900 truncate">
                                {cred.label}
                              </span>
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700">
                                {cred.schoolCode}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 truncate">
                              {cred.sublabel}
                            </p>
                            <p className="text-[11px] font-mono text-slate-600 truncate">
                              {cred.email} · <span className="text-slate-800 font-semibold">{cred.password}</span>
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => handleFillCredential(cred)}
                              className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition-colors disabled:opacity-50"
                            >
                              Fill
                            </button>
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => handleInstantSignIn(cred)}
                              className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg text-white transition-colors disabled:opacity-50 ${buttonBgClass}`}
                            >
                              {isThisSigning ? 'Signing In...' : 'Sign In'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer Bar */}
          {showEnrollSchoolPrompt && (onGoToEnrollSchool || onGoToPlatformAdmin) ? (
            <div className="px-6 sm:px-7 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              {onGoToEnrollSchool ? (
                <div className="flex items-center gap-1.5">
                  <span>New school?</span>
                  <button
                    type="button"
                    onClick={onGoToEnrollSchool}
                    className="font-semibold text-[#B45309] hover:text-[#92400E] hover:underline"
                  >
                    Enroll School
                  </button>
                </div>
              ) : (
                <span />
              )}
              {onGoToPlatformAdmin && (
                <button
                  type="button"
                  onClick={onGoToPlatformAdmin}
                  className="font-semibold text-slate-700 hover:text-slate-950 hover:underline"
                >
                  MINO Platform Console (/admin)
                </button>
              )}
            </div>
          ) : (
            <div className="px-6 sm:px-7 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>Signing in with a different role?</span>
              <button
                type="button"
                onClick={onBackToRoleSelect}
                className="font-semibold text-slate-800 hover:text-slate-950 hover:underline"
              >
                Switch Role
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export const StudentLoginPage: React.FC<SharedRoleLoginProps> = (props) => (
  <RoleAuthTemplate
    role="student"
    heading="Student Sign In"
    subtitle="Enter your school’s overall code and your student login credentials to view results and admit cards."
    emailLabel="Student Email or Admission No"
    emailPlaceholder="chidinma.okafor@oakridge.edu or OMA/2024/001"
    passwordPlaceholder="Password or 4-digit PIN (e.g., student123)"
    schoolCodeHint="Enter the unique School Code issued by your school administration (e.g., OMA-1001)."
    submitLabel="Sign In to Student Portal"
    buttonBgClass="bg-sky-700 hover:bg-sky-800"
    focusBorderClass="focus:border-sky-700 focus:ring-1 focus:ring-sky-700"
    iconBgClass="bg-sky-50 text-sky-700 border-sky-200"
    IconComponent={GraduationCap}
    {...props}
  />
);

export const TeacherLoginPage: React.FC<SharedRoleLoginProps> = (props) => (
  <RoleAuthTemplate
    role="teacher"
    heading="Teacher Sign In"
    subtitle="Sign in with your School Code and faculty credentials to manage attendance, classes, and gradebooks."
    emailLabel="Teacher Email"
    emailPlaceholder="teacher@oakridge.edu"
    passwordPlaceholder="Enter faculty password (e.g., teach123)"
    schoolCodeHint="Enter your institution’s overall School Code provided by your principal or administrator."
    submitLabel="Sign In to Teacher Workspace"
    buttonBgClass="bg-[#065F46] hover:bg-[#064E3B]"
    focusBorderClass="focus:border-[#065F46] focus:ring-1 focus:ring-[#065F46]"
    iconBgClass="bg-emerald-50 text-[#065F46] border-emerald-200"
    IconComponent={BookOpen}
    {...props}
  />
);

export const AdminLoginPage: React.FC<SharedRoleLoginProps> = (props) => (
  <RoleAuthTemplate
    role="admin"
    heading="School Admin Sign In"
    subtitle="Access your school’s executive dashboard, admissions, faculty directory, and fee bursary."
    emailLabel="Administrator / Bursar Email"
    emailPlaceholder="admin@oakridge.edu"
    passwordPlaceholder="Enter admin password (e.g., admin123)"
    schoolCodeHint="Enter the unique overall School Code assigned when your school was enrolled."
    submitLabel="Sign In to Admin Dashboard"
    buttonBgClass="bg-[#0F172A] hover:bg-[#1E293B]"
    focusBorderClass="focus:border-[#0F172A] focus:ring-1 focus:ring-[#0F172A]"
    iconBgClass="bg-slate-100 text-[#0F172A] border-slate-300"
    IconComponent={ShieldCheck}
    showEnrollSchoolPrompt
    {...props}
  />
);

export const GuardianLoginPage: React.FC<SharedRoleLoginProps> = (props) => (
  <RoleAuthTemplate
    role="guardian"
    heading="Guardian Sign In"
    subtitle="Sign in with your child’s School Code and your guardian email and password to view report cards and fees."
    emailLabel="Guardian Email"
    emailPlaceholder="emeka.okafor@example.com"
    passwordPlaceholder="Password or 6-digit Access PIN (e.g., guardian123)"
    schoolCodeHint="Enter the School Code shared with parents and guardians by your child’s school."
    submitLabel="Sign In to Guardian Portal"
    buttonBgClass="bg-[#B45309] hover:bg-[#92400E]"
    focusBorderClass="focus:border-[#B45309] focus:ring-1 focus:ring-[#B45309]"
    iconBgClass="bg-amber-50 text-[#B45309] border-amber-200"
    IconComponent={HeartHandshake}
    {...props}
  />
);

interface RoleAuthPageProps extends SharedRoleLoginProps {
  role: LoginRole;
}

export const RoleAuthPage: React.FC<RoleAuthPageProps> = ({ role, ...rest }) => {
  switch (role) {
    case 'student':
      return <StudentLoginPage {...rest} />;
    case 'teacher':
      return <TeacherLoginPage {...rest} />;
    case 'guardian':
      return <GuardianLoginPage {...rest} />;
    case 'admin':
    default:
      return <AdminLoginPage {...rest} />;
  }
};
