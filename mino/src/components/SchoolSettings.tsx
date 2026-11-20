/**
 * MINO-SMS Institutional School Settings Module
 * Allows each school's Administrator to configure:
 * 1. Custom School Logo (Upload PNG/JPG/WEBP/SVG or direct URL) displayed across all school dashboards & documents
 * 2. Academic Calendar & 3-Term Switcher (1st Term, 2nd Term, 3rd Term) + Terminal Report Lock
 * 3. Institution Profile (School Name, Overall School Code, Contact Phone, Physical Address, Currency)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  Upload,
  Trash2,
  Calendar,
  Save,
  CheckCircle2,
  AlertCircle,
  Lock,
  Unlock,
  Copy,
  Check,
  Image as ImageIcon,
  Phone,
  MapPin,
  DollarSign
} from 'lucide-react';
import { api } from '../services/api';
import { processSchoolLogoFile } from '../utils/logoUpload';
import {
  ACADEMIC_TERMS,
  normalizeAcademicTerm,
  getSchoolLogoUrl,
  type AcademicTerm,
  type SchoolTenant
} from '../types';

interface SchoolSettingsProps {
  tenant: SchoolTenant | null;
  userEmail: string;
  onTenantUpdated: (updatedSchool: SchoolTenant) => void;
}

const CURRENCY_OPTIONS = [
  { currency: 'NGN', symbol: '₦', label: 'Nigerian Naira (₦)' },
  { currency: 'GHS', symbol: 'GH₵', label: 'Ghanaian Cedi (GH₵)' },
  { currency: 'USD', symbol: '$', label: 'US Dollar ($)' },
  { currency: 'GBP', symbol: '£', label: 'British Pound (£)' }
];

export const SchoolSettings: React.FC<SchoolSettingsProps> = ({
  tenant,
  userEmail,
  onTenantUpdated
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState(tenant?.name || '');
  const [logoUrl, setLogoUrl] = useState(tenant?.logoUrl || '');
  const [phone, setPhone] = useState(tenant?.phone || '');
  const [address, setAddress] = useState(tenant?.address || '');
  const [currency, setCurrency] = useState(tenant?.currency || 'NGN');
  const [currencySymbol, setCurrencySymbol] = useState(tenant?.currencySymbol || '₦');
  const [currentSession, setCurrentSession] = useState(tenant?.currentSession || '2025/2026');
  const [currentTerm, setCurrentTerm] = useState<AcademicTerm>(
    normalizeAcademicTerm(tenant?.currentTerm)
  );
  const [isReportsLocked, setIsReportsLocked] = useState<boolean>(tenant?.isReportsLocked || false);

  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  useEffect(() => {
    if (!tenant) return;
    setName(tenant.name || '');
    setLogoUrl(tenant.logoUrl || '');
    setPhone(tenant.phone || '');
    setAddress(tenant.address || '');
    setCurrency(tenant.currency || 'NGN');
    setCurrencySymbol(tenant.currencySymbol || '₦');
    setCurrentSession(tenant.currentSession || '2025/2026');
    setCurrentTerm(normalizeAcademicTerm(tenant.currentTerm));
    setIsReportsLocked(Boolean(tenant.isReportsLocked));
  }, [tenant]);

  async function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFeedback(null);
    setUploadingLogo(true);
    try {
      const processedDataUrl = await processSchoolLogoFile(file);
      setLogoUrl(processedDataUrl);
      setFeedback({
        type: 'success',
        message: 'School logo loaded. Click "Save School Settings" to apply across all dashboards.'
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Could not process selected logo image.'
      });
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setFeedback({ type: 'error', message: 'School name cannot be empty.' });
      return;
    }
    if (!currentSession.trim()) {
      setFeedback({ type: 'error', message: 'Academic session is required (e.g. 2025/2026).' });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const res = await api.updateTenantSettings(
        {
          name: name.trim(),
          logoUrl: logoUrl.trim(),
          phone: phone.trim(),
          address: address.trim(),
          currency,
          currencySymbol,
          currentSession: currentSession.trim(),
          currentTerm,
          isReportsLocked
        },
        userEmail
      );
      onTenantUpdated(res.school);
      setFeedback({
        type: 'success',
        message: 'School settings, custom logo, and active academic term updated across all dashboards.'
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to save school settings.'
      });
    } finally {
      setSaving(false);
    }
  }

  const activeLogoPreview = getSchoolLogoUrl({ logoUrl });
  const hasCustomLogo = Boolean(logoUrl.trim());

  return (
    <form onSubmit={handleSaveSettings} className="space-y-5 max-w-4xl">
      {/* Page Header */}
      <div className="bg-white border border-slate-200 rounded-[4px] p-5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">School Settings & Branding</h1>
          <p className="text-xs text-slate-500 mt-1">
            Customize your school&apos;s official logo, manage the 3-term academic calendar, and update institutional contact details.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-[4px] bg-[#0F172A] hover:bg-[#1E293B] disabled:opacity-50 text-white shadow-xs transition-colors shrink-0"
        >
          <Save className="w-3.5 h-3.5 text-amber-400" />
          <span>{saving ? 'Saving Changes...' : 'Save School Settings'}</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-[4px] border text-xs flex items-center justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#065F46] shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-700 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Section 1: School Logo & Brand Identity */}
      <div className="bg-white border border-slate-200 rounded-[4px] p-5 shadow-xs space-y-4">
        <div className="pb-3 border-b border-slate-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-[#B45309]" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              School Crest / Custom Logo
            </h2>
          </div>
          <span className="text-[11px] text-slate-500">
            Displayed on Admin, Teacher, Student &amp; Guardian dashboards
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Live Dashboard Preview Badge */}
          <div className="flex items-center gap-3.5 p-3.5 rounded-[4px] bg-[#0F172A] text-white border border-slate-800 min-w-[240px]">
            <div className="w-12 h-12 rounded-lg bg-white p-1.5 flex items-center justify-center shrink-0 overflow-hidden">
              <img
                src={activeLogoPreview}
                alt={`${name || 'School'} Logo`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-mono text-amber-400 font-bold block">
                Dashboard Header Preview
              </span>
              <span className="text-sm font-bold text-white truncate block max-w-[170px]">
                {name || tenant?.name || 'Your School Name'}
              </span>
              <span className="text-[11px] text-slate-400 font-tabular block">
                {currentSession} · {currentTerm}
              </span>
            </div>
          </div>

          {/* Upload & URL Controls */}
          <div className="flex-1 w-full space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleLogoFileChange}
                className="hidden"
              />
              <button
                type="button"
                disabled={uploadingLogo}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-[4px] bg-slate-900 hover:bg-slate-800 text-white transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                <span>{uploadingLogo ? 'Processing Image...' : 'Upload School Logo'}</span>
              </button>

              {hasCustomLogo && (
                <button
                  type="button"
                  onClick={() => setLogoUrl('')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-[4px] bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Custom Logo</span>
                </button>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Or paste direct Logo Image URL (optional)
              </label>
              <input
                type="text"
                value={logoUrl.startsWith('data:') ? '' : logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder={
                  logoUrl.startsWith('data:')
                    ? 'Custom uploaded image active — paste a URL here to replace'
                    : 'https://yourschool.edu.ng/logo.png'
                }
                className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#0F172A]"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Supports PNG, JPG, WEBP, or SVG (up to 5 MB). Appears on your school&apos;s sidebar, mobile menu, report cards, admit cards, and fee receipts.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Academic Calendar & 3-Term Configuration */}
      <div className="bg-white border border-slate-200 rounded-[4px] p-5 shadow-xs space-y-4">
        <div className="pb-3 border-b border-slate-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#065F46]" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Academic Session &amp; 3-Term Configuration
            </h2>
          </div>
          <span className="text-[11px] text-slate-500 font-tabular">
            Standard 3-Term School Calendar
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          <div className="md:col-span-4">
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Academic Session *
            </label>
            <input
              type="text"
              required
              value={currentSession}
              onChange={(e) => setCurrentSession(e.target.value)}
              placeholder="e.g. 2025/2026"
              className="w-full px-3 py-2 text-xs font-semibold font-tabular rounded-[4px] border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#0F172A]"
            />
          </div>

          <div className="md:col-span-8">
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Active School Term (3 Terms per Session) *
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {ACADEMIC_TERMS.map((termOption, idx) => {
                const isSelected = currentTerm === termOption;
                return (
                  <button
                    key={termOption}
                    type="button"
                    onClick={() => setCurrentTerm(termOption)}
                    className={`p-2.5 rounded-[4px] border text-left transition-colors ${
                      isSelected
                        ? 'bg-[#0F172A] border-[#0F172A] text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-mono uppercase font-bold ${
                          isSelected ? 'text-amber-400' : 'text-slate-400'
                        }`}
                      >
                        Term {idx + 1}
                      </span>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <div className="text-xs font-bold mt-0.5">{termOption}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Terminal Report Lock Toggle */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              {isReportsLocked ? (
                <Lock className="w-3.5 h-3.5 text-[#B45309]" />
              ) : (
                <Unlock className="w-3.5 h-3.5 text-[#065F46]" />
              )}
              <span>Terminal Gradebook &amp; Report Card Lock</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              When locked, teachers cannot alter continuous assessment or exam scores for {currentTerm}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsReportsLocked(!isReportsLocked)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-[4px] border transition-colors shrink-0 ${
              isReportsLocked
                ? 'bg-amber-50 border-amber-300 text-[#B45309] hover:bg-amber-100'
                : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {isReportsLocked ? 'Grades Locked (Click to Unlock)' : 'Grades Open (Click to Lock)'}
          </button>
        </div>
      </div>

      {/* Section 3: Institution Profile & Contact Details */}
      <div className="bg-white border border-slate-200 rounded-[4px] p-5 shadow-xs space-y-4">
        <div className="pb-3 border-b border-slate-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-700" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Institution Profile &amp; Sign-In Code
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
              School Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold rounded-[4px] border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#0F172A]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Overall School Code (Sign-In ID)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={tenant?.code || ''}
                className="flex-1 px-3 py-2 text-xs font-mono font-bold uppercase rounded-[4px] border border-slate-200 bg-slate-50 text-slate-800 cursor-default focus:outline-none"
              />
              {tenant?.code && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(tenant.code);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2000);
                  }}
                  className="px-3 py-2 text-xs font-semibold rounded-[4px] bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 inline-flex items-center gap-1.5 transition-colors"
                >
                  {copiedCode ? (
                    <Check className="w-3.5 h-3.5 text-[#065F46]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Contact Phone
            </label>
            <div className="relative">
              <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+234 803 000 0000"
                className="w-full pl-8 pr-3 py-2 text-xs rounded-[4px] border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#0F172A]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Reporting Currency
            </label>
            <div className="relative">
              <DollarSign className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <select
                value={currency}
                onChange={(e) => {
                  const found = CURRENCY_OPTIONS.find((c) => c.currency === e.target.value);
                  setCurrency(e.target.value);
                  if (found) setCurrencySymbol(found.symbol);
                }}
                className="w-full pl-8 pr-3 py-2 text-xs font-semibold rounded-[4px] border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#0F172A]"
              >
                {CURRENCY_OPTIONS.map((opt) => (
                  <option key={opt.currency} value={opt.currency}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Physical Address
            </label>
            <div className="relative">
              <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Campus street address and city"
                className="w-full pl-8 pr-3 py-2 text-xs rounded-[4px] border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#0F172A]"
              />
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-[4px] bg-[#065F46] hover:bg-[#064E3B] disabled:opacity-50 text-white transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save School Settings'}</span>
          </button>
        </div>
      </div>
    </form>
  );
};
