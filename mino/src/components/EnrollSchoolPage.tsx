/**
 * MINO-SMS Guided School Onboarding Page
 * Two-step school enrollment flow:
 * Step 1: School Name, Auto-generated Overall School Code (ID), Contact Phone, Physical Address
 * Step 2: Create Admin Account (Email & Password) -> Complete Enrollment
 * Post-Submit: Pending Verification screen displaying the assigned School Code and informing
 * the school that the MINO team will verify their school shortly and send a confirmation email.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPin,
  Phone,
  AlertCircle,
  Hash,
  Copy,
  Check,
  Upload,
  Trash2
} from 'lucide-react';
import { api } from '../services/api';
import { processSchoolLogoFile } from '../utils/logoUpload';

interface EnrollSchoolPageProps {
  onBackToLanding: () => void;
  onGoToLogin: (prefillSchoolCode?: string) => void;
}

function computeOverallSchoolCode(
  schoolName: string,
  existingCodes: Set<string>,
  existingCount: number
): string {
  const trimmed = schoolName.trim();
  if (!trimmed) return '';

  const stopWords = new Set(['THE', 'OF', 'AND', 'FOR', 'IN', 'AT', 'A', 'AN']);
  const rawWords = trimmed
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (rawWords.length === 0) return '';

  const words = rawWords.length > 2 ? rawWords.filter(w => !stopWords.has(w)) : rawWords;
  const activeWords = words.length > 0 ? words : rawWords;

  let base = '';
  if (activeWords.length >= 3) {
    base = activeWords.slice(0, 4).map(w => w[0]).join('');
  } else if (activeWords.length === 2) {
    base = (activeWords[0].slice(0, 2) + activeWords[1].slice(0, 2)).slice(0, 4);
  } else {
    base = activeWords[0].slice(0, 4);
  }

  if (base.length < 3) {
    base = (base + 'SCH').slice(0, 4);
  }

  let seq = 1001 + existingCount;
  let candidate = `${base}-${seq}`;
  while (existingCodes.has(candidate)) {
    seq++;
    candidate = `${base}-${seq}`;
  }
  return candidate;
}

export const EnrollSchoolPage: React.FC<EnrollSchoolPageProps> = ({
  onBackToLanding,
  onGoToLogin
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [existingCodes, setExistingCodes] = useState<Set<string>>(new Set());
  const [tenantCount, setTenantCount] = useState<number>(2);
  const [copiedCode, setCopiedCode] = useState(false);

  // Step 1: School Details
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [schoolName, setSchoolName] = useState('');
  const [schoolLogoUrl, setSchoolLogoUrl] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [contactPhone, setContactPhone] = useState('');
  const [physicalAddress, setPhysicalAddress] = useState('');

  // Step 2: Admin Account
  const [adminEmail, setAdminEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Submission & Feedback State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrolledSchool, setEnrolledSchool] = useState<{
    id: string;
    name: string;
    code: string;
    logoUrl?: string;
    phone: string;
    address: string;
    adminEmail: string;
  } | null>(null);

  useEffect(() => {
    api
      .getTenants()
      .then((tenants) => {
        setExistingCodes(new Set(tenants.map((t) => String(t.code || '').toUpperCase())));
        setTenantCount(tenants.length);
      })
      .catch(() => {
        // Fallback if offline
      });
  }, []);

  const generatedSchoolCode = useMemo(
    () => computeOverallSchoolCode(schoolName, existingCodes, tenantCount),
    [schoolName, existingCodes, tenantCount]
  );

  async function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploadingLogo(true);
    try {
      const dataUrl = await processSchoolLogoFile(file);
      setSchoolLogoUrl(dataUrl);
    } catch (err: any) {
      setError(err.message || 'Could not process selected school logo.');
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  }

  function handleContinueToStep2(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!schoolName.trim()) {
      setError('Please enter your school name.');
      return;
    }
    if (!contactPhone.trim()) {
      setError('Please enter your school contact phone number.');
      return;
    }
    if (!physicalAddress.trim()) {
      setError('Please enter your school physical address.');
      return;
    }

    setStep(2);
  }

  async function handleCompleteEnrollment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanEmail = adminEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid administrator email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify both password fields.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.enrollSchool({
        name: schoolName.trim(),
        code: generatedSchoolCode,
        logoUrl: schoolLogoUrl || undefined,
        phone: contactPhone.trim(),
        address: physicalAddress.trim(),
        adminEmail: cleanEmail,
        adminPasscode: password
      });

      const created = response.school;
      setEnrolledSchool({
        id: created.id,
        name: created.name,
        code: created.code,
        logoUrl: created.logoUrl || schoolLogoUrl || undefined,
        phone: created.phone || contactPhone.trim(),
        address: created.address || physicalAddress.trim(),
        adminEmail: created.adminEmail || cleanEmail
      });
    } catch (err: any) {
      setError(err.message || 'Could not complete school enrollment. Please check your details and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navigation Header */}
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

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToLanding}
            className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Homepage</span>
          </button>
        </div>
      </header>

      {/* Main Onboarding Body */}
      <main className="flex-1 flex items-center justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-xl">
          {enrolledSchool ? (
            /* Post-Enrollment Pending Verification Screen */
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                  <Clock className="w-6 h-6 text-[#B45309]" />
                </div>
                <div className="space-y-1.5">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    Enrollment Received — Pending Verification
                  </h1>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Thank you for enrolling <strong className="font-semibold text-slate-900">{enrolledSchool.name}</strong>. Your school profile now needs to be verified by the MINO team—it won&apos;t take long.
                  </p>
                </div>
              </div>

              {/* Email Notification Assurance */}
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-start gap-3">
                <Mail className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-emerald-950 leading-relaxed">
                  Once your school is verified by the MINO team, you will receive a confirmation email at{' '}
                  <strong className="font-semibold">{enrolledSchool.adminEmail}</strong> so you can sign in right away.
                </div>
              </div>

              {/* Assigned Overall School Code Highlight */}
              <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold block">
                    Your Overall School Code
                  </span>
                  <span className="font-mono font-bold text-lg sm:text-xl text-amber-400 tracking-wider mt-0.5 block">
                    {enrolledSchool.code}
                  </span>
                  <span className="text-[11px] text-slate-300 mt-0.5 block">
                    Save this code — admins, teachers, students, and guardians use it to sign in.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(enrolledSchool.code);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2500);
                  }}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-white inline-flex items-center gap-1.5 shrink-0 transition-colors"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
                </button>
              </div>

              {/* Summary of Submitted Details */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3 text-xs sm:text-sm">
                <div className="flex items-center justify-between gap-4 pb-2.5 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Verification Status</span>
                  <span className="font-semibold text-[#B45309]">Awaiting MINO Team Verification</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500 font-medium">School Name</span>
                  <span className="font-semibold text-slate-900 text-right">{enrolledSchool.name}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500 font-medium">Overall School Code</span>
                  <span className="font-mono font-bold text-slate-900">{enrolledSchool.code}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500 font-medium">Contact Phone</span>
                  <span className="font-medium text-slate-800">{enrolledSchool.phone}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500 font-medium">Admin Email</span>
                  <span className="font-medium text-slate-800 break-all text-right">{enrolledSchool.adminEmail}</span>
                </div>
              </div>

              <div className="pt-1 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={onBackToLanding}
                  className="w-full sm:flex-1 min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors"
                >
                  Return to Homepage
                </button>
                <button
                  type="button"
                  onClick={() => onGoToLogin(enrolledSchool.code)}
                  className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-sm font-semibold transition-colors"
                >
                  Go to Sign In
                </button>
              </div>
            </div>
          ) : (
            /* Guided 2-Step Onboarding Card */
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              {/* Onboarding Header & Progress Stepper */}
              <div className="p-6 sm:p-8 pb-5 border-b border-slate-200 space-y-5">
                <div className="space-y-1">
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                    {step === 1 ? 'Welcome to MINO — Enroll Your School' : 'Create Your Admin Account'}
                  </h1>
                  <p className="text-sm text-slate-600">
                    {step === 1
                      ? 'Start by telling us a few essential details about your school.'
                      : 'Set up the administrator email and password you will use to manage your school.'}
                  </p>
                </div>

                {/* 2-Step Progress Indicator */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-colors ${
                        step >= 1 ? 'bg-[#B45309]' : 'bg-slate-200'
                      }`}
                    />
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                      {step > 1 ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <span className="text-[#B45309] font-bold">1.</span>
                      )}
                      <span>School Details</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-colors ${
                        step === 2 ? 'bg-[#B45309]' : 'bg-slate-200'
                      }`}
                    />
                    <div
                      className={`flex items-center gap-1.5 text-xs font-semibold ${
                        step === 2 ? 'text-slate-900' : 'text-slate-400'
                      }`}
                    >
                      <span className={step === 2 ? 'text-[#B45309] font-bold' : ''}>2.</span>
                      <span>Admin Account</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Body */}
              <div className="p-6 sm:p-8 space-y-5">
                {error && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {step === 1 ? (
                  <form onSubmit={handleContinueToStep2} className="space-y-5">
                    {/* School Name */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700">
                        School Name <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          required
                          autoFocus
                          value={schoolName}
                          onChange={(e) => setSchoolName(e.target.value)}
                          placeholder="e.g., Gracefield International Academy"
                          className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#B45309] focus:ring-1 focus:ring-[#B45309]"
                        />
                      </div>
                    </div>

                    {/* Auto-Generated Overall School Code */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-slate-700">
                          School Code (Overall School ID)
                        </label>
                        <span className="text-[11px] text-slate-500">
                          Automatically assigned
                        </span>
                      </div>
                      <div className="relative">
                        <Hash className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          readOnly
                          tabIndex={-1}
                          value={generatedSchoolCode}
                          placeholder="Type your school name above to generate"
                          className="w-full pl-10 pr-3.5 py-2.5 text-sm font-mono font-bold uppercase tracking-wider rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:normal-case cursor-default focus:outline-none"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Your school&apos;s unique overall ID. Share this School Code with your teachers, students, and guardians to sign in.
                      </p>
                    </div>

                    {/* Optional Custom School Logo */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-slate-700">
                          School Logo
                        </label>
                        <span className="text-[11px] text-slate-500">
                          Optional — can also be set later in School Settings
                        </span>
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
                        <div className="w-11 h-11 rounded-lg bg-white border border-slate-200 flex items-center justify-center p-1 shrink-0 overflow-hidden">
                          {schoolLogoUrl ? (
                            <img
                              src={schoolLogoUrl}
                              alt="School Logo Preview"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <Building2 className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div className="flex-1 flex flex-wrap items-center gap-2">
                          <input
                            ref={logoInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                            onChange={handleLogoSelect}
                            className="hidden"
                          />
                          <button
                            type="button"
                            disabled={uploadingLogo}
                            onClick={() => logoInputRef.current?.click()}
                            className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-800 inline-flex items-center gap-1.5 transition-colors"
                          >
                            <Upload className="w-3.5 h-3.5 text-[#B45309]" />
                            <span>{uploadingLogo ? 'Processing...' : schoolLogoUrl ? 'Change Logo' : 'Upload School Logo'}</span>
                          </button>
                          {schoolLogoUrl && (
                            <button
                              type="button"
                              onClick={() => setSchoolLogoUrl('')}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-700 hover:bg-red-50 inline-flex items-center gap-1 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Contact Phone */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700">
                        Contact Phone <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="tel"
                          required
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          placeholder="e.g., +233 24 123 4567"
                          className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#B45309] focus:ring-1 focus:ring-[#B45309]"
                        />
                      </div>
                    </div>

                    {/* Physical Address */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700">
                        Physical Address <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                        <textarea
                          rows={2}
                          required
                          value={physicalAddress}
                          onChange={(e) => setPhysicalAddress(e.target.value)}
                          placeholder="e.g., 18 Independence Avenue, East Legon, Accra"
                          className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#B45309] focus:ring-1 focus:ring-[#B45309] resize-none"
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        className="w-full min-h-[46px] py-3 px-5 rounded-xl bg-[#B45309] hover:bg-[#92400E] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs"
                      >
                        <span>Continue to Admin Account</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleCompleteEnrollment} className="space-y-5">
                    {/* Summary of Step 1 */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {schoolLogoUrl && (
                          <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                            <img src={schoolLogoUrl} alt="School Logo" className="w-full h-full object-contain" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {schoolName}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            School Code: <span className="font-mono font-semibold text-slate-800">{generatedSchoolCode}</span> · {contactPhone}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setStep(1);
                        }}
                        className="text-xs font-semibold text-[#B45309] hover:text-[#92400E] shrink-0"
                      >
                        Edit
                      </button>
                    </div>

                    {/* Admin Email */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700">
                        Admin Email Address <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="email"
                          required
                          autoFocus
                          value={adminEmail}
                          onChange={(e) => setAdminEmail(e.target.value)}
                          placeholder="admin@yourschool.edu"
                          className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#B45309] focus:ring-1 focus:ring-[#B45309]"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500">
                        We will send your verification confirmation email to this address.
                      </p>
                    </div>

                    {/* Password */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700">
                        Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Create a secure password (min. 6 characters)"
                          className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#B45309] focus:ring-1 focus:ring-[#B45309]"
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

                    {/* Confirm Password */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-700">
                        Confirm Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Re-enter your password"
                          className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#B45309] focus:ring-1 focus:ring-[#B45309]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                          aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Navigation Actions */}
                    <div className="pt-2 flex flex-col-reverse sm:flex-row items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setStep(1);
                        }}
                        disabled={submitting}
                        className="w-full sm:w-auto min-h-[46px] px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back</span>
                      </button>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full sm:flex-1 min-h-[46px] py-3 px-6 rounded-xl bg-[#B45309] hover:bg-[#92400E] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors shadow-xs"
                      >
                        <span>{submitting ? 'Completing Enrollment...' : 'Complete Enrollment'}</span>
                        {!submitting && <CheckCircle2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Footer Sign-in Link */}
              <div className="px-6 sm:px-8 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <span>Already enrolled and verified?</span>
                <button
                  type="button"
                  onClick={() => onGoToLogin()}
                  className="font-semibold text-[#B45309] hover:text-[#92400E] hover:underline"
                >
                  Sign In to School
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
