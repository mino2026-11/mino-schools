/**
 * MINO Official - Platform Owner & Super Administrator Console
 * Unified institutional design matching all school dashboards:
 * - Consistent slate-50 background, white card surfaces, slate-200 borders
 * - Left collapsible navigation sidebar (bg-[#0F172A]) with brand logo
 * - TopHeader bar with breadcrumb, cluster status indicator, and quick actions
 * - Standardized metric stat cards with tabular figures
 * - Clean institutional tables with filterable school tenants, status tags, and portal launcher
 * - Secure PBKDF2 master password management
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  School,
  Users,
  GraduationCap,
  DollarSign,
  PlusCircle,
  Search,
  ShieldCheck,
  Power,
  Settings,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  LogOut,
  Building2,
  Calendar,
  Lock,
  Edit3,
  KeyRound,
  Eye,
  EyeOff,
  Check,
  Layers,
  ChevronRight,
  ChevronLeft,
  Server,
  Database,
  Globe,
  Copy,
  Upload,
  Trash2
} from 'lucide-react';
import { api } from '../services/api';
import { processSchoolLogoFile } from '../utils/logoUpload';
import {
  ACADEMIC_TERMS,
  normalizeAcademicTerm,
  type PlatformAnalytics,
  type PlatformSchoolStats,
  type SchoolTenant
} from '../types';

interface SuperAdminDashboardProps {
  onLogout: () => void;
  onLaunchSchoolPortal: (schoolId: string) => void;
  onBackToLanding: () => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  onLogout,
  onLaunchSchoolPortal,
  onBackToLanding
}) => {
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'active' | 'suspended'>('all');
  const [verifyingSchoolId, setVerifyingSchoolId] = useState<string | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Active navigation tab within Owner Console
  const [activeTab, setActiveTab] = useState<'tenants' | 'analytics' | 'security' | 'architecture'>('tenants');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Platform owner password & security state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [ownerSecurityStatus, setOwnerSecurityStatus] = useState<{ email: string; lastPasswordChange: string; hasCustomPassword: boolean } | null>(null);

  // Onboard modal state
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [provisionForm, setProvisionForm] = useState({
    name: '',
    code: '',
    currency: 'NGN',
    currencySymbol: '₦',
    address: '',
    phone: '',
    currentSession: '2025/2026',
    currentTerm: '1st Term',
    subscriptionPlan: 'Enterprise' as const,
    adminEmail: '',
    adminPasscode: 'admin123'
  });

  // Edit school modal state
  const [editingSchool, setEditingSchool] = useState<PlatformSchoolStats | null>(null);
  const editLogoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadPlatformData();
    loadOwnerSecurityStatus();
  }, []);

  async function loadPlatformData() {
    setLoading(true);
    try {
      const data = await api.getPlatformOverview();
      setAnalytics(data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load platform analytics' });
    } finally {
      setLoading(false);
    }
  }

  async function loadOwnerSecurityStatus() {
    try {
      const status = await api.getPlatformOwnerStatus();
      setOwnerSecurityStatus(status);
    } catch {
      // Ignore if unavailable
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword) {
      setFeedback({ type: 'error', message: 'Current password is required.' });
      return;
    }
    if (newPassword.length < 6) {
      setFeedback({ type: 'error', message: 'New password must be at least 6 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedback({ type: 'error', message: 'New password and confirmation do not match.' });
      return;
    }

    setSubmittingPassword(true);
    try {
      const res = await api.changePlatformOwnerPassword({
        currentPassword,
        newPassword,
        confirmPassword,
        actorEmail: ownerSecurityStatus?.email || 'owner@mino.com'
      });
      setFeedback({ type: 'success', message: res.message || 'Platform master password updated successfully!' });
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      loadOwnerSecurityStatus();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update owner password' });
    } finally {
      setSubmittingPassword(false);
    }
  }

  function derivePreviewSchoolCode(schoolName: string): string {
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
    if (base.length < 3) base = (base + 'SCH').slice(0, 4);
    const taken = new Set((analytics?.schools || []).map(s => s.code.toUpperCase()));
    let seq = 1001 + (analytics?.schools.length || 0);
    let candidate = `${base}-${seq}`;
    while (taken.has(candidate)) {
      seq++;
      candidate = `${base}-${seq}`;
    }
    return candidate;
  }

  async function handleProvisionSchool(e: React.FormEvent) {
    e.preventDefault();
    try {
      const generatedOrCustomCode = (provisionForm.code || derivePreviewSchoolCode(provisionForm.name)).toUpperCase();
      const res = await api.provisionSchool({
        name: provisionForm.name,
        code: generatedOrCustomCode,
        currency: provisionForm.currency,
        currencySymbol: provisionForm.currencySymbol,
        address: provisionForm.address,
        phone: provisionForm.phone,
        currentSession: provisionForm.currentSession,
        currentTerm: provisionForm.currentTerm,
        subscriptionPlan: provisionForm.subscriptionPlan,
        adminEmail: provisionForm.adminEmail,
        adminPasscode: provisionForm.adminPasscode
      });

      const assignedCode = res?.school?.code || generatedOrCustomCode;
      setFeedback({
        type: 'success',
        message: `School "${provisionForm.name}" provisioned! Assigned Overall School Code: ${assignedCode}`
      });
      setShowProvisionModal(false);
      setProvisionForm({
        name: '',
        code: '',
        currency: 'NGN',
        currencySymbol: '₦',
        address: '',
        phone: '',
        currentSession: '2025/2026',
        currentTerm: '1st Term',
        subscriptionPlan: 'Enterprise',
        adminEmail: '',
        adminPasscode: 'admin123'
      });
      loadPlatformData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to provision school' });
    }
  }

  async function handleUpdateSchool(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSchool) return;

    try {
      await api.updateSchoolConfig(editingSchool.id, {
        name: editingSchool.name,
        logoUrl: editingSchool.logoUrl || '',
        address: editingSchool.address,
        phone: editingSchool.phone,
        currentSession: editingSchool.currentSession,
        currentTerm: normalizeAcademicTerm(editingSchool.currentTerm),
        subscriptionPlan: editingSchool.subscriptionPlan
      });

      setFeedback({ type: 'success', message: `Configuration updated for ${editingSchool.name}` });
      setEditingSchool(null);
      loadPlatformData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update school configuration' });
    }
  }

  async function handleVerifySchool(school: PlatformSchoolStats) {
    setVerifyingSchoolId(school.id);
    try {
      const res = await api.verifyPlatformSchool(school.id);
      setFeedback({
        type: 'success',
        message: res.message || `Verified "${school.name}" and sent confirmation email to ${school.adminEmail}.`
      });
      await loadPlatformData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to verify school' });
    } finally {
      setVerifyingSchoolId(null);
    }
  }

  async function handleToggleStatus(school: PlatformSchoolStats) {
    const currentStatus = school.subscriptionStatus || school.status || 'active';
    try {
      await api.toggleSchoolStatus(school.id, currentStatus);
      setFeedback({ type: 'success', message: `School status changed to ${currentStatus === 'active' ? 'suspended' : 'active'}` });
      loadPlatformData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to toggle status' });
    }
  }

  const filteredSchools = (analytics?.schools || []).filter(school => {
    const schoolStatus = school.subscriptionStatus || school.status || 'active';
    const matchesSearch =
      school.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      school.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      school.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ? true :
      statusFilter === 'pending' ? schoolStatus === 'pending' :
      statusFilter === 'active' ? schoolStatus === 'active' :
      schoolStatus === 'suspended';

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="h-screen overflow-hidden print:h-auto print:overflow-visible bg-slate-50 flex flex-col md:flex-row text-slate-800 font-sans">
      {/* Platform Owner Unified Sidebar (Fixed Desktop) */}
      <aside
        className={`hidden md:flex h-screen sticky top-0 overflow-hidden bg-[#0F172A] text-white flex-col justify-between transition-all duration-200 z-30 shrink-0 border-r border-slate-800 no-print ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Brand Header (Fixed Top) */}
        <div className="h-16 flex items-center justify-between px-3.5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center p-1 shrink-0 shadow-xs overflow-hidden">
              <img
                src="/assets/aistudio/logo_234aadf4.png"
                alt="MINO Logo"
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
            </div>
            {!sidebarCollapsed && (
              <div className="truncate">
                <span className="font-bold text-sm tracking-tight text-white block truncate">
                  MINO Platform
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1 rounded-[3px] text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Links (Independently Scrollable if Needed) */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <nav className="p-2 space-y-1 mt-2">
            {!sidebarCollapsed && (
              <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Platform Operations
              </div>
            )}

            <button
              onClick={() => setActiveTab('tenants')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-[4px] transition-colors relative ${
                activeTab === 'tenants'
                  ? 'bg-[#1E293B] text-white shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
              title={sidebarCollapsed ? 'Institutions Directory' : undefined}
            >
              {activeTab === 'tenants' && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#B45309] rounded-r" />
              )}
              <Building2 className={`w-4 h-4 shrink-0 ${activeTab === 'tenants' ? 'text-amber-400' : 'text-slate-400'}`} />
              {!sidebarCollapsed && (
                <div className="flex-1 flex items-center justify-between truncate">
                  <span className="truncate">Institutions Directory</span>
                  <span className="px-1.5 py-0.2 rounded-[2px] bg-slate-800 text-slate-300 text-[10px] font-mono font-bold">
                    {analytics?.totalSchools || 0}
                  </span>
                </div>
              )}
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-[4px] transition-colors relative ${
                activeTab === 'analytics'
                  ? 'bg-[#1E293B] text-white shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
              title={sidebarCollapsed ? 'Platform Metrics' : undefined}
            >
              {activeTab === 'analytics' && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#B45309] rounded-r" />
              )}
              <TrendingUp className={`w-4 h-4 shrink-0 ${activeTab === 'analytics' ? 'text-amber-400' : 'text-slate-400'}`} />
              {!sidebarCollapsed && <span className="truncate">Cluster Metrics</span>}
            </button>

            <button
              onClick={() => setActiveTab('security')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-[4px] transition-colors relative ${
                activeTab === 'security'
                  ? 'bg-[#1E293B] text-white shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
              title={sidebarCollapsed ? 'Owner Security' : undefined}
            >
              {activeTab === 'security' && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#B45309] rounded-r" />
              )}
              <ShieldCheck className={`w-4 h-4 shrink-0 ${activeTab === 'security' ? 'text-amber-400' : 'text-slate-400'}`} />
              {!sidebarCollapsed && <span className="truncate">Master Security</span>}
            </button>

            <button
              onClick={() => setActiveTab('architecture')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-[4px] transition-colors relative ${
                activeTab === 'architecture'
                  ? 'bg-[#1E293B] text-white shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
              title={sidebarCollapsed ? 'Architecture Spec' : undefined}
            >
              {activeTab === 'architecture' && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#B45309] rounded-r" />
              )}
              <Layers className={`w-4 h-4 shrink-0 ${activeTab === 'architecture' ? 'text-amber-400' : 'text-slate-400'}`} />
              {!sidebarCollapsed && <span className="truncate">System Architecture</span>}
            </button>
          </nav>
        </div>

        {/* Pinned Bottom Area */}
        <div className="p-3 border-t border-slate-800 space-y-2 shrink-0">
          <button
            onClick={() => setShowProvisionModal(true)}
            className={`w-full flex items-center gap-2 py-1.5 px-2 rounded-[3px] bg-[#B45309] hover:bg-[#92400E] text-white text-xs font-semibold transition-colors shadow-xs ${
              sidebarCollapsed ? 'justify-center px-0' : ''
            }`}
            title="Provision New School"
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span className="truncate">Provision School</span>}
          </button>

          <button
            onClick={onBackToLanding}
            className={`w-full flex items-center gap-2 py-1.5 px-2 rounded-[3px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors ${
              sidebarCollapsed ? 'justify-center px-0' : ''
            }`}
            title="Public Website"
          >
            <Globe className="w-4 h-4 shrink-0 text-slate-400" />
            {!sidebarCollapsed && <span className="truncate">Public Website</span>}
          </button>

          {!sidebarCollapsed ? (
            <div className="flex items-center justify-between pt-1">
              <div className="min-w-0 pr-2">
                <span className="text-[10px] uppercase font-mono text-amber-400 font-bold block truncate">
                  Platform Owner
                </span>
                <span className="text-xs font-medium text-slate-300 block truncate">
                  {ownerSecurityStatus?.email || 'owner@mino.com'}
                </span>
              </div>
              <button
                onClick={onLogout}
                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-[3px] transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onLogout}
              className="w-full flex justify-center p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-[3px] transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Scrollable Content Container */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto overflow-x-hidden print:h-auto print:overflow-visible">
        {/* Top Header - Consistent with Institutional Dashboards */}
        <header className="h-14 sm:h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20 shadow-2xs shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/assets/aistudio/logo_234aadf4.png"
              alt="MINO Logo"
              referrerPolicy="no-referrer"
              className="w-8 h-8 object-contain md:hidden shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-slate-900 truncate">
                {activeTab === 'tenants' && 'Institutions & School Tenants'}
                {activeTab === 'analytics' && 'Cluster Analytics & Turnover'}
                {activeTab === 'security' && 'Master Security & Credentials'}
                {activeTab === 'architecture' && 'System Architecture'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={() => setShowPasswordModal(true)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition-colors"
              title="Change platform owner master password"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-700" />
              <span className="hidden sm:inline">Change Password</span>
            </button>

            <button
              onClick={() => setShowProvisionModal(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#0F172A] hover:bg-[#1E293B] text-white transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Provision School</span>
            </button>

            <button
              onClick={onLogout}
              className="p-2 rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50 border border-slate-200 transition-colors"
              title="Sign Out of Platform Console"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-4 sm:p-6 pb-20 md:pb-6 space-y-6">
          {feedback && (
            <div
              className={`p-3.5 rounded-lg text-xs flex items-center justify-between border shadow-2xs ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              <div className="flex items-center gap-2">
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{feedback.message}</span>
              </div>
              <button
                onClick={() => setFeedback(null)}
                className="font-bold text-slate-400 hover:text-slate-700 ml-3"
              >
                ✕
              </button>
            </div>
          )}

          {/* Welcome & Executive Summary Banner */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Platform Master Executive Console
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Monitor registered institutions, inspect enrollments, manage subscriptions, and launch school portals.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  loadPlatformData();
                  loadOwnerSecurityStatus();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-colors"
                title="Refresh cluster data"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Refresh Data</span>
              </button>
            </div>
          </div>

          {/* 4 Consistent Stat Cards - Exactly matching DashboardOverview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Total Institutions
                </span>
                <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200/60 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-[#B45309]" />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900 font-tabular mt-2">
                {analytics?.totalSchools || 0}
              </div>
              <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
                <span className="text-emerald-700 font-bold">{analytics?.activeSchools || 0} Active</span>
                <span>·</span>
                <span className={(analytics?.pendingSchools || 0) > 0 ? 'text-amber-700 font-bold' : ''}>
                  {analytics?.pendingSchools || 0} Pending
                </span>
              </div>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Total Enrolled Pupils
                </span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200/60 flex items-center justify-center">
                  <GraduationCap className="w-4 h-4 text-blue-700" />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900 font-tabular mt-2">
                {analytics?.totalStudents.toLocaleString() || 0}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Active student accounts across cluster
              </div>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Faculty & Staff
                </span>
                <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-200/60 flex items-center justify-center">
                  <Users className="w-4 h-4 text-purple-700" />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900 font-tabular mt-2">
                {analytics?.totalStaff || 0}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Educators, Bursars & Administrators
              </div>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Platform Turnover
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200/60 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-[#065F46]" />
                </div>
              </div>
              <div className="text-2xl font-bold text-[#065F46] font-tabular mt-2">
                ₦{((analytics?.totalPlatformRevenueMinor || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Aggregated tuition & fee receipts
              </div>
            </div>
          </div>

          {/* TAB 1: SCHOOL TENANTS DIRECTORY */}
          {activeTab === 'tenants' && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
              {/* Directory Filter & Search Header */}
              <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#B45309]" />
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                    School Institutions Directory
                  </h3>
                  <span className="text-xs text-slate-500">
                    ({filteredSchools.length} tenants)
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  {/* Status Segmented Control */}
                  <div className="flex p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs">
                    {(['all', 'pending', 'active', 'suspended'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setStatusFilter(tab)}
                        className={`px-3 py-1 font-semibold rounded-md capitalize transition-colors flex items-center gap-1 ${
                          statusFilter === tab
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span>{tab}</span>
                        {tab === 'pending' && (analytics?.pendingSchools || 0) > 0 && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-600 text-white text-[10px] font-bold">
                            {analytics?.pendingSchools}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Search Input */}
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search institutions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Institutions Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[11px] font-bold">
                    <tr>
                      <th className="py-3 px-4">Institution Name</th>
                      <th className="py-3 px-4">School Code</th>
                      <th className="py-3 px-4">Academic Session</th>
                      <th className="py-3 px-4 text-center">Pupils</th>
                      <th className="py-3 px-4 text-center">Faculty</th>
                      <th className="py-3 px-4">Plan</th>
                      <th className="py-3 px-4 text-right">Tuition Volume</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400">
                          Loading school tenants...
                        </td>
                      </tr>
                    ) : filteredSchools.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400">
                          No institutions match your search criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredSchools.map((school) => {
                        const schoolStatus = school.subscriptionStatus || school.status || 'active';
                        return (
                        <tr key={school.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              {school.logoUrl ? (
                                <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 p-0.5 flex items-center justify-center shrink-0 overflow-hidden">
                                  <img
                                    src={school.logoUrl}
                                    alt={`${school.name} Logo`}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-contain"
                                  />
                                </div>
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200/80 flex items-center justify-center text-[#B45309] font-bold text-xs shrink-0">
                                  {school.name.substring(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <span className="font-bold text-slate-900 block">
                                  {school.name}
                                </span>
                                <span className="text-[11px] text-slate-500 block truncate max-w-xs">
                                  {school.address || 'Address on file'}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(school.code);
                                setCopiedCodeId(school.id);
                                setTimeout(() => setCopiedCodeId(null), 2000);
                              }}
                              title="Click to copy School Code"
                              className="inline-flex items-center gap-1.5 font-mono font-bold px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition-colors"
                            >
                              <span>{school.code}</span>
                              {copiedCodeId === school.id ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3 text-slate-400" />
                              )}
                            </button>
                          </td>

                          <td className="py-3.5 px-4 text-slate-600 font-medium">
                            <div>{school.currentSession}</div>
                            <div className="text-[10px] text-slate-400">{school.currentTerm}</div>
                          </td>

                          <td className="py-3.5 px-4 text-center font-bold text-slate-900 font-tabular">
                            {school.studentCount}
                          </td>

                          <td className="py-3.5 px-4 text-center font-semibold text-slate-700 font-tabular">
                            {school.staffCount}
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                              {school.subscriptionPlan}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right font-bold text-slate-900 font-tabular">
                            {school.currencySymbol}{((school.totalRevenueMinor || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold capitalize ${
                                schoolStatus === 'active'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : schoolStatus === 'pending'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-300'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              {schoolStatus === 'pending' ? 'Pending Verification' : schoolStatus}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {schoolStatus === 'pending' ? (
                                <button
                                  onClick={() => handleVerifySchool(school)}
                                  disabled={verifyingSchoolId === school.id}
                                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white shadow-2xs transition-colors"
                                  title={`Verify ${school.name} and send confirmation email to ${school.adminEmail}`}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>{verifyingSchoolId === school.id ? 'Verifying...' : 'Verify & Email'}</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => onLaunchSchoolPortal(school.id)}
                                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-[#0F172A] hover:bg-[#1E293B] text-white shadow-2xs transition-colors"
                                  title={`Launch ${school.name} dashboard`}
                                >
                                  <span>Launch</span>
                                  <ExternalLink className="w-3 h-3 text-amber-400" />
                                </button>
                              )}

                              <button
                                onClick={() => setEditingSchool(school)}
                                className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                                title="Edit school configuration"
                              >
                                <Settings className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleToggleStatus(school)}
                                className={`p-1 rounded transition-colors ${
                                  schoolStatus === 'active'
                                    ? 'text-slate-400 hover:text-amber-700 hover:bg-amber-50'
                                    : 'text-slate-400 hover:text-emerald-700 hover:bg-emerald-50'
                                }`}
                                title={schoolStatus === 'active' ? 'Suspend institution' : 'Activate institution'}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 gap-2">
                <span>
                  Showing {filteredSchools.length} of {analytics?.totalSchools || 0} registered institutions
                </span>
                <span className="font-mono text-[11px]">
                  All institutions cryptographically isolated with separate namespaces
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: PLATFORM METRICS & REVENUE */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Institution Breakdown Card */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide pb-2 border-b border-slate-100 flex items-center justify-between">
                    <span>Enrollment Distribution</span>
                    <GraduationCap className="w-4 h-4 text-[#B45309]" />
                  </h3>

                  <div className="space-y-3">
                    {analytics?.schools.map(s => {
                      const totalStudents = analytics.totalStudents || 1;
                      const percentage = Math.round((s.studentCount / totalStudents) * 100);
                      return (
                        <div key={s.id} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-semibold text-slate-800">{s.name} ({s.code})</span>
                            <span className="font-tabular text-slate-600">{s.studentCount} pupils ({percentage}%)</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#B45309] rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Financial Turnover Card */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide pb-2 border-b border-slate-100 flex items-center justify-between">
                    <span>Tuition Volume by Tenant</span>
                    <DollarSign className="w-4 h-4 text-[#065F46]" />
                  </h3>

                  <div className="space-y-3">
                    {analytics?.schools.map(s => {
                      const totalRev = analytics.totalPlatformRevenueMinor || 1;
                      const percentage = Math.round(((s.totalRevenueMinor || 0) / totalRev) * 100);
                      return (
                        <div key={s.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-900 block text-xs">{s.name}</span>
                            <span className="text-[11px] text-slate-500">Plan: {s.subscriptionPlan}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-[#065F46] font-tabular text-sm block">
                              {s.currencySymbol}{((s.totalRevenueMinor || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}
                            </span>
                            <span className="text-[10px] text-slate-500 font-tabular">{percentage}% of cluster total</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MASTER SECURITY & PBKDF2 CREDENTIALS */}
          {activeTab === 'security' && (
            <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
                <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
                  <KeyRound className="w-5 h-5 text-[#B45309]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Platform Master Security
                  </h3>
                  <p className="text-xs text-slate-500">
                    PBKDF2 SHA-256 encrypted authentication for the platform owner console.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Owner Identifier:</span>
                  <span className="font-mono font-bold text-slate-900">{ownerSecurityStatus?.email || 'owner@mino.com'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Last Password Change:</span>
                  <span className="font-tabular text-slate-700">
                    {ownerSecurityStatus?.lastPasswordChange
                      ? new Date(ownerSecurityStatus.lastPasswordChange).toLocaleString()
                      : 'Initial Provisioning'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cryptographic Standard:</span>
                  <span className="font-mono text-emerald-700 font-bold">PBKDF2 · 100,000 Iterations · Salted SHA-256</span>
                </div>
              </div>

              <button
                onClick={() => setShowPasswordModal(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#0F172A] hover:bg-[#1E293B] text-white font-semibold text-xs shadow-xs transition-colors"
              >
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>Update Master Owner Password</span>
              </button>
            </div>
          )}

          {/* TAB 4: SYSTEM ARCHITECTURE (Grounded in uploaded architecture document) */}
          {activeTab === 'architecture' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-2xs space-y-6">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
                <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
                  <Layers className="w-5 h-5 text-blue-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    School Management System - Architecture Alignment
                  </h3>
                  <p className="text-xs text-slate-500">
                    Verified against the complete architecture & implementation specification.
                  </p>
                </div>
              </div>

              {/* 6 Frontend Portals Grid */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  6 Frontend Portals (Architecture Layer 1)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    { name: 'Public Website', desc: 'School information, admissions portal, news & academic showcase', status: 'Implemented' },
                    { name: 'Student Portal (PWA)', desc: 'Personalized dashboard, transcripts, admit cards, fee ledger', status: 'Implemented' },
                    { name: 'Teacher Portal', desc: 'Class roster, digital roll call, continuous assessment, rubrics', status: 'Implemented' },
                    { name: 'Administrative Portal', desc: 'Lifecycle management, faculty allocations, fee collection, audit trail', status: 'Implemented' },
                    { name: 'Principal Portal', desc: 'Executive dashboard, institution-wide KPIs, academic & financial oversight', status: 'Implemented' },
                    { name: 'Platform Owner Console', desc: 'Multi-tenant provisioning, cross-school analytics, master credentials', status: 'Active' },
                  ].map((portal, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{portal.name}</span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                          {portal.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">{portal.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 10 Specialized Microservices */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Core Microservices & Domain Services
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
                  {[
                    'User Management', 'Student Lifecycle', 'Teacher Service', 'Academic Timetable',
                    'Examination Service', 'Attendance Service', 'Financial Service', 'Communication Hub',
                    'Audit & Compliance', 'Reporting Service'
                  ].map((service, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2">
                      <Server className="w-3.5 h-3.5 text-[#B45309] shrink-0" />
                      <span className="font-medium text-slate-800 text-[11px] truncate">{service}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 25 Core Database Entities */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  25 Core Database Entities (Multi-Tenant Isolated)
                </h4>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[11px] text-slate-700 flex flex-wrap gap-2">
                  {[
                    'users', 'user_roles', 'schools', 'academic_years', 'classes',
                    'subjects', 'class_subjects', 'students', 'attendance', 'exam_results',
                    'examinations', 'exam_schedule', 'admit_cards', 'mark_sheets', 'fees',
                    'fee_payments', 'announcements', 'notifications', 'events', 'audit_logs',
                    'parents', 'staff', 'curriculum', 'grade_scales', 'receipts'
                  ].map((table) => (
                    <span key={table} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-800">
                      {table}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* PROVISION NEW SCHOOL MODAL - Institutional Light Design */}
      {showProvisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-[#B45309]" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Provision New School</h3>
                  <p className="text-xs text-slate-500">Configure institutional profile & dedicated database namespace</p>
                </div>
              </div>
              <button
                onClick={() => setShowProvisionModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProvisionSchool} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">School Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. St. Jude's International School"
                  value={provisionForm.name}
                  onChange={(e) => {
                    const nextName = e.target.value;
                    setProvisionForm({
                      ...provisionForm,
                      name: nextName,
                      code: derivePreviewSchoolCode(nextName)
                    });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Overall School Code (Auto-Assigned)</label>
                  <input
                    type="text"
                    readOnly
                    placeholder="Auto-generated from name"
                    value={provisionForm.code}
                    className="w-full px-3 py-2 font-mono font-bold uppercase bg-slate-100 border border-slate-200 rounded-lg text-slate-800 cursor-default focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Subscription Plan</label>
                  <select
                    value={provisionForm.subscriptionPlan}
                    onChange={(e) => setProvisionForm({ ...provisionForm, subscriptionPlan: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
                  >
                    <option value="Standard">Standard</option>
                    <option value="Professional">Professional</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Academic Session</label>
                  <input
                    type="text"
                    required
                    value={provisionForm.currentSession}
                    onChange={(e) => setProvisionForm({ ...provisionForm, currentSession: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Current Term</label>
                  <select
                    value={provisionForm.currentTerm}
                    onChange={(e) => setProvisionForm({ ...provisionForm, currentTerm: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
                  >
                    {ACADEMIC_TERMS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Campus Address</label>
                <input
                  type="text"
                  placeholder="e.g. 14 University Crescent, Victoria Island, Lagos"
                  value={provisionForm.address}
                  onChange={(e) => setProvisionForm({ ...provisionForm, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Head Administrator Email</label>
                  <input
                    type="email"
                    required
                    placeholder="admin@school.com"
                    value={provisionForm.adminEmail}
                    onChange={(e) => setProvisionForm({ ...provisionForm, adminEmail: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Default Admin PIN / Passcode</label>
                  <input
                    type="text"
                    required
                    value={provisionForm.adminPasscode}
                    onChange={(e) => setProvisionForm({ ...provisionForm, adminPasscode: e.target.value })}
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowProvisionModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#0F172A] hover:bg-[#1E293B] text-white shadow-xs"
                >
                  Provision School Tenant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SCHOOL CONFIGURATION MODAL */}
      {editingSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-base text-slate-900">Configure School Settings</h3>
                <p className="text-xs text-slate-500">{editingSchool.name} ({editingSchool.code})</p>
              </div>
              <button
                onClick={() => setEditingSchool(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateSchool} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">School Logo</label>
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                    {editingSchool.logoUrl ? (
                      <img src={editingSchool.logoUrl} alt="School Logo" className="w-full h-full object-contain" />
                    ) : (
                      <Building2 className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  <input
                    ref={editLogoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const dataUrl = await processSchoolLogoFile(file);
                        setEditingSchool({ ...editingSchool, logoUrl: dataUrl });
                      } catch (err: any) {
                        setFeedback({ type: 'error', message: err.message || 'Invalid logo file' });
                      }
                      if (editLogoInputRef.current) editLogoInputRef.current.value = '';
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => editLogoInputRef.current?.click()}
                    className="px-2.5 py-1.5 rounded bg-white hover:bg-slate-100 border border-slate-300 font-semibold text-slate-800 inline-flex items-center gap-1"
                  >
                    <Upload className="w-3.5 h-3.5 text-[#B45309]" />
                    <span>{editingSchool.logoUrl ? 'Replace Logo' : 'Upload Logo'}</span>
                  </button>
                  {editingSchool.logoUrl && (
                    <button
                      type="button"
                      onClick={() => setEditingSchool({ ...editingSchool, logoUrl: '' })}
                      className="px-2 py-1.5 rounded text-red-700 hover:bg-red-50 font-semibold inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">School Name</label>
                <input
                  type="text"
                  required
                  value={editingSchool.name}
                  onChange={(e) => setEditingSchool({ ...editingSchool, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={editingSchool.address}
                  onChange={(e) => setEditingSchool({ ...editingSchool, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Academic Session</label>
                  <input
                    type="text"
                    value={editingSchool.currentSession}
                    onChange={(e) => setEditingSchool({ ...editingSchool, currentSession: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Current Term</label>
                  <select
                    value={normalizeAcademicTerm(editingSchool.currentTerm)}
                    onChange={(e) => setEditingSchool({ ...editingSchool, currentTerm: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
                  >
                    {ACADEMIC_TERMS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Subscription Plan</label>
                <select
                  value={editingSchool.subscriptionPlan}
                  onChange={(e) => setEditingSchool({ ...editingSchool, subscriptionPlan: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
                >
                  <option value="Standard">Standard</option>
                  <option value="Professional">Professional</option>
                  <option value="Enterprise">Enterprise</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingSchool(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#0F172A] hover:bg-[#1E293B] text-white shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHANGE MASTER PASSWORD MODAL */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
                  <KeyRound className="w-4 h-4 text-[#B45309]" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Change Master Password</h3>
                  <p className="text-xs text-slate-500">Secure owner console with PBKDF2 salt</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter current master password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Master Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900">
                Updating your master password immediately recalculates the cryptographic salt and PBKDF2 hash on the server. Write it down or save it securely.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPassword}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#0F172A] hover:bg-[#1E293B] text-white shadow-xs disabled:opacity-50"
                >
                  {submittingPassword ? 'Encrypting & Saving...' : 'Save New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Platform owner mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe no-print"
      >
        <div className="grid grid-cols-5 items-center h-16 px-1">
          {[
            { id: 'tenants' as const, label: 'Schools', icon: Building2 },
            { id: 'analytics' as const, label: 'Metrics', icon: TrendingUp },
            { id: 'security' as const, label: 'Security', icon: ShieldCheck },
            { id: 'architecture' as const, label: 'System', icon: Layers }
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`min-h-[44px] flex flex-col items-center justify-center relative transition-colors ${
                  isActive ? 'text-[#B45309]' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-[#B45309] rounded-full" />
                )}
                <Icon className="w-5 h-5 shrink-0" />
                <span className={`text-[10px] tracking-tight mt-1 whitespace-nowrap ${isActive ? 'font-bold text-slate-900' : 'font-medium'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setShowProvisionModal(true)}
            className="min-h-[44px] flex flex-col items-center justify-center text-[#0F172A] transition-colors"
          >
            <PlusCircle className="w-5 h-5 text-[#B45309] shrink-0" />
            <span className="text-[10px] font-semibold tracking-tight mt-1 whitespace-nowrap">Provision</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
