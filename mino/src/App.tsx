/**
 * MINO-SMS (School Management System as a Service)
 * Master Application Shell
 * Complete implementation of the Figma Community School Management Admin Dashboard UI.
 * Features:
 * - Collapsible High-Fidelity Sidebar Navigation
 * - Top Bar Contract Header with Global Search, Notifications, Sync Status
 * - Executive Dashboard Overview (KPIs, Attendance Bar Chart, Financials, Calendar, Notice Board)
 * - Students Directory with Dossier Inspector & CSV Export
 * - Teachers & Staff Management with Subject Assignments
 * - Parents Directory with WhatsApp/SMS Dispatch
 * - Classes & Weekly Routine Timetable
 * - Daily Roll Call Attendance Register
 * - Academic Gradebook with Keyboard Navigation & Term Lock
 * - Financial Ledger & Fee Collection with SHA-256 Verified Receipts
 * - Notice Board & Official Broadcast Circulars
 * - Master 6-digit PIN AES-GCM-256 Encryption Vault
 * - Immutable Audit Trail & Cold JSON Backup/Restore
 */

import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Users,
  BookOpen,
  DollarSign,
  ShieldCheck,
  History,
  RefreshCw,
  Lock,
  Unlock,
  Wifi,
  WifiOff,
  Menu,
  X,
  School,
  PlusCircle,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { api } from './services/api';
import { localDb } from './services/db';
import type {
  SchoolTenant,
  ClassArm,
  Subject,
  Student,
  UserRole,
  LoginRole,
  StaffUser,
  DashboardSummary,
  Notice
} from './types';

// Core Dashboard Components
import { Sidebar } from './components/Sidebar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { TopHeader } from './components/TopHeader';
import { DashboardOverview } from './components/DashboardOverview';
import { StudentDirectory } from './components/StudentDirectory';
import { StaffManagement } from './components/StaffManagement';
import { ParentsDirectory } from './components/ParentsDirectory';
import { ClassesTimetable } from './components/ClassesTimetable';
import { AttendanceTracker } from './components/AttendanceTracker';
import { Gradebook } from './components/Gradebook';
import { FeeLedger } from './components/FeeLedger';
import { NoticeBoard } from './components/NoticeBoard';
import { ParentPortal } from './components/ParentPortal';
import { StudentPortal } from './components/StudentPortal';
import { AuditTrail } from './components/AuditTrail';
import { VaultModal } from './components/VaultModal';
import { StudentProfileModal } from './components/StudentProfileModal';
import { RoleSelectionPage } from './components/RoleSelectionPage';
import { RoleAuthPage } from './components/RoleAuthPage';
import { LandingPage } from './components/LandingPage';
import { AdminAuthPage } from './components/AdminAuthPage';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { EnrollSchoolPage } from './components/EnrollSchoolPage';
import { SchoolSettings } from './components/SchoolSettings';

function isAdminRoute(pathname: string = window.location.pathname): boolean {
  const normalized = pathname.replace(/\/+$/, '').toLowerCase();
  return normalized === '/admin' || normalized.startsWith('/admin/');
}

export default function App() {
  // Master View Navigation: 'landing' | 'role_select' | 'role_auth' | 'enroll_school' | 'admin_login' | 'owner_dashboard' | 'school_app'
  const [appMode, setAppMode] = useState<'landing' | 'role_select' | 'role_auth' | 'enroll_school' | 'admin_login' | 'owner_dashboard' | 'school_app'>(() =>
    isAdminRoute() ? 'admin_login' : 'landing'
  );
  const [selectedAuthRole, setSelectedAuthRole] = useState<LoginRole>('admin');
  const [prefilledSchoolCode, setPrefilledSchoolCode] = useState<string>('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [appFeedback, setAppFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  function triggerFeedback(type: 'success' | 'error' | 'info', message: string) {
    setAppFeedback({ type, message });
    setTimeout(() => {
      setAppFeedback(prev => (prev?.message === message ? null : prev));
    }, 4500);
  }
  // Session & Authentication State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentRole, setCurrentRole] = useState<UserRole>('admin');
  const [studentPortalData, setStudentPortalData] = useState<any | null>(null);
  const [parentPortalData, setParentPortalData] = useState<any | null>(null);

  // Multi-Tenant State
  const [availableTenants, setAvailableTenants] = useState<{ id: string; name: string; code: string; currencySymbol: string; subscriptionStatus?: string }[]>([]);
  const [currentSchoolId, setCurrentSchoolId] = useState<string>('sch_oakridge_001');
  const [tenant, setTenant] = useState<SchoolTenant | null>(null);
  const [classes, setClasses] = useState<ClassArm[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [parentSubTab, setParentSubTab] = useState<'current' | 'history'>('current');
  const [studentSubTab, setStudentSubTab] = useState<'results' | 'admit_card' | 'fees' | 'history'>('results');

  // Sidebar Layout State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Connectivity & Outbox Sync state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [outboxCount, setOutboxCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Vault state
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);

  // Modals
  const [selectedStudentForDossier, setSelectedStudentForDossier] = useState<Student | null>(null);
  const [openGradebookImportModal, setOpenGradebookImportModal] = useState(false);
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [onboardForm, setOnboardForm] = useState({
    name: '',
    code: '',
    currency: 'NGN',
    currencySymbol: '₦',
    address: '',
    phone: '',
    currentSession: '2025/2026',
    currentTerm: '1st Term'
  });

  // Direct action modals
  const [showQuickEnrolModal, setShowQuickEnrolModal] = useState(false);
  const [quickEnrolForm, setQuickEnrolForm] = useState({
    admissionNo: '',
    firstName: '',
    lastName: '',
    email: '',
    studentPassword: 'student123',
    gender: 'female' as 'male' | 'female' | 'other',
    classArm: 'JSS 1',
    guardianName: '',
    guardianPhone: '',
    guardianEmail: '',
    guardianPassword: 'guardian123'
  });

  const [showQuickPaymentModal, setShowQuickPaymentModal] = useState(false);
  const [quickPaymentForm, setQuickPaymentForm] = useState({
    studentId: '',
    amountMajor: '',
    category: 'Tuition',
    description: '',
    paymentChannel: 'BANK_TRANSFER' as const,
    referenceNo: ''
  });

  const [showQuickNoticeModal, setShowQuickNoticeModal] = useState(false);
  const [quickNoticeForm, setQuickNoticeForm] = useState({
    title: '',
    content: '',
    priority: 'normal' as const,
    targetAudience: 'All' as const
  });

  const [showQuickEventModal, setShowQuickEventModal] = useState(false);
  const [quickEventForm, setQuickEventForm] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    time: '09:00 AM',
    location: 'Main Campus',
    category: 'Academic' as const,
    description: ''
  });

  useEffect(() => {
    loadTenantsList();
    loadAllTenantData(currentSchoolId);
    checkOutboxDepth();

    const handleOnline = () => {
      setIsOnline(true);
      triggerAutoSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(checkOutboxDepth, 4000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [currentSchoolId]);

  // Sync browser back/forward navigation for /admin route
  useEffect(() => {
    const handlePopState = () => {
      if (isAdminRoute()) {
        setAppMode(isSuperAdmin ? 'owner_dashboard' : 'admin_login');
      } else {
        setAppMode((prev) =>
          prev === 'admin_login' || prev === 'owner_dashboard'
            ? isLoggedIn
              ? 'school_app'
              : 'landing'
            : prev
        );
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isSuperAdmin, isLoggedIn]);

  function navigateToPublicLanding() {
    if (isAdminRoute()) {
      window.history.pushState({}, '', '/');
    }
    setAppMode('landing');
  }

  async function loadTenantsList() {
    try {
      const tenants = await api.getTenants();
      setAvailableTenants(tenants);
    } catch (e) {
      console.warn('Failed to load tenants list', e);
    }
  }

  async function loadAllTenantData(schoolId: string) {
    setLoading(true);
    try {
      api.setSchoolId(schoolId);
      const [tenantData, studentList, staffList, noticesList, summaryData] = await Promise.all([
        api.getTenant(schoolId),
        api.getStudents('all', false),
        api.getStaff(schoolId),
        api.getNotices(),
        api.getDashboardSummary()
      ]);

      setTenant(tenantData.school);
      setClasses(tenantData.classes || []);
      setSubjects(tenantData.subjects || []);
      setStudents(studentList || []);
      setStaff(staffList || []);
      setNotices(noticesList || []);
      setDashboardSummary(summaryData);
      if (tenantData.classes?.[0]?.name) {
        setQuickEnrolForm(prev => ({ ...prev, classArm: tenantData.classes[0].name }));
      }
    } catch (err) {
      console.error('Failed to load school tenant data', err);
    } finally {
      setLoading(false);
    }
  }

  async function checkOutboxDepth() {
    try {
      const count = await localDb.outbox.count();
      setOutboxCount(count);
      setIsVaultUnlocked(api.isVaultUnlocked());
    } catch {
      // safe fallback
    }
  }

  async function triggerAutoSync() {
    if (!navigator.onLine) return;
    setIsSyncing(true);
    try {
      const res = await api.syncOutbox();
      if (res.pushed > 0 || res.skipped > 0) {
        setSyncNotice(`Synced ${res.pushed} offline items. (${res.skipped} deduplicated)`);
        setTimeout(() => setSyncNotice(null), 4000);
      }
      await checkOutboxDepth();
      if (currentSchoolId) await loadAllTenantData(currentSchoolId);
    } catch (err: any) {
      console.warn('Sync attempt note:', err);
    } finally {
      setIsSyncing(false);
    }
  }

  function handleLockVault() {
    api.setCryptoKey(null);
    setIsVaultUnlocked(false);
    setSyncNotice('Offline vault locked. Keys wiped from active memory.');
    setTimeout(() => setSyncNotice(null), 3000);
  }

  async function handleToggleReportLock(locked: boolean) {
    if (!tenant) return;
    try {
      await api.toggleReportLock(locked, currentUser?.email || 'admin@school.edu');
      setTenant(prev => prev ? { ...prev, isReportsLocked: locked } : null);
      setSyncNotice(locked ? 'Term reports locked. Score mutations disabled.' : 'Term reports unlocked.');
      setTimeout(() => setSyncNotice(null), 3500);
    } catch (err: any) {
      triggerFeedback('error', err.message || 'Error updating report lock');
    }
  }

  function handleLoginSuccess(sessionData: {
    role: UserRole;
    user: any;
    school: SchoolTenant;
    studentPortalData?: any;
    parentPortalData?: any;
  }) {
    const resolvedSchoolId = sessionData.school.id;
    api.setSchoolId(resolvedSchoolId);
    if (resolvedSchoolId !== currentSchoolId) {
      setCurrentSchoolId(resolvedSchoolId);
    }
    loadAllTenantData(resolvedSchoolId);

    setIsLoggedIn(true);
    setCurrentRole(sessionData.role);
    setCurrentUser(sessionData.user);
    setTenant(sessionData.school);
    setStudentPortalData(sessionData.studentPortalData || null);
    setParentPortalData(sessionData.parentPortalData || null);
    setPrefilledSchoolCode('');

    // Route default tab by role
    if (sessionData.role === 'student') {
      setActiveTab('student_portal');
    } else if (sessionData.role === 'parent') {
      setActiveTab('parent_portal');
    } else if (sessionData.role === 'teacher') {
      setActiveTab('gradebook');
    } else if (sessionData.role === 'bursar') {
      setActiveTab('ledger');
    } else {
      setActiveTab('dashboard');
    }

    setAppMode('school_app');
  }

  function handleLogout() {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setStudentPortalData(null);
    setParentPortalData(null);
    setActiveTab('dashboard');
    if (isSuperAdmin) {
      if (!isAdminRoute()) {
        window.history.pushState({}, '', '/admin');
      }
      setAppMode('owner_dashboard');
    } else {
      navigateToPublicLanding();
    }
  }

  // Quick Action Submissions
  async function handleQuickEnrolSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.createStudent(quickEnrolForm, currentUser?.email || 'admin@school.edu');
      setShowQuickEnrolModal(false);
      const studentName = `${quickEnrolForm.firstName} ${quickEnrolForm.lastName}`;
      setQuickEnrolForm({
        admissionNo: '',
        firstName: '',
        lastName: '',
        email: '',
        studentPassword: 'student123',
        gender: 'female',
        classArm: classes[0]?.name || 'JSS 1',
        guardianName: '',
        guardianPhone: '',
        guardianEmail: '',
        guardianPassword: 'guardian123'
      });
      triggerFeedback('success', `Enrolled pupil ${studentName} successfully.`);
      loadAllTenantData(currentSchoolId);
    } catch (err: any) {
      triggerFeedback('error', err.message || 'Error enrolling student');
    }
  }

  async function handleQuickPaymentSubmit(e: React.FormEvent) {
    e.preventDefault();
    const majorVal = parseFloat(quickPaymentForm.amountMajor);
    if (isNaN(majorVal) || majorVal <= 0) {
      triggerFeedback('error', 'Please enter a valid positive payment amount');
      return;
    }
    try {
      const res = await api.recordPayment({
        studentId: quickPaymentForm.studentId,
        type: 'CREDIT_PAYMENT',
        amountMinor: Math.round(majorVal * 100),
        description: quickPaymentForm.description || `Tuition payment for ${quickPaymentForm.category}`,
        category: quickPaymentForm.category,
        paymentChannel: quickPaymentForm.paymentChannel,
        referenceNo: quickPaymentForm.referenceNo,
        actorEmail: currentUser?.email || 'bursar@school.edu'
      });
      setShowQuickPaymentModal(false);
      setQuickPaymentForm({
        studentId: '',
        amountMajor: '',
        category: 'Tuition',
        description: '',
        paymentChannel: 'BANK_TRANSFER',
        referenceNo: ''
      });
      triggerFeedback('success', `Payment recorded successfully. Receipt No: ${res?.receiptNo || 'Verified'}`);
      loadAllTenantData(currentSchoolId);
    } catch (err: any) {
      triggerFeedback('error', err.message || 'Error recording payment');
    }
  }

  async function handleQuickNoticeSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.createNotice(quickNoticeForm, currentUser?.name || 'Administrator');
      setShowQuickNoticeModal(false);
      setQuickNoticeForm({
        title: '',
        content: '',
        priority: 'normal',
        targetAudience: 'All'
      });
      triggerFeedback('success', 'Official circular broadcast to notice board.');
      loadAllTenantData(currentSchoolId);
    } catch (err: any) {
      triggerFeedback('error', err.message || 'Error publishing notice');
    }
  }

  async function handleQuickEventSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.createEvent(quickEventForm);
      setShowQuickEventModal(false);
      setQuickEventForm({
        title: '',
        date: new Date().toISOString().split('T')[0],
        time: '09:00 AM',
        location: 'Main Campus',
        category: 'Academic',
        description: ''
      });
      triggerFeedback('success', 'Event successfully scheduled on school calendar.');
      loadAllTenantData(currentSchoolId);
    } catch (err: any) {
      triggerFeedback('error', err.message || 'Error creating event');
    }
  }

  async function handleOnboardTenantSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const data = await api.onboardTenant(onboardForm);
      setShowOnboardModal(false);
      await loadTenantsList();
      setCurrentSchoolId(data.school.id);
      triggerFeedback('success', `Onboarded new school tenant: ${data.school.name}`);
    } catch (err: any) {
      triggerFeedback('error', err.message || 'Error onboarding tenant');
    }
  }

  // 1. Landing Page View (System Home)
  // Global Toast Component
  const renderGlobalToast = () => {
    if (!appFeedback) return null;
    return (
      <div className="fixed top-4 right-4 z-50 max-w-md bg-white border border-slate-200 shadow-xl rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs animate-slide-in">
        <div className="flex items-center gap-2">
          {appFeedback.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
          {appFeedback.type === 'error' && <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />}
          {appFeedback.type === 'info' && <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />}
          <span className="font-semibold text-slate-800">{appFeedback.message}</span>
        </div>
        <button
          onClick={() => setAppFeedback(null)}
          className="text-slate-400 hover:text-slate-700 font-bold ml-2 text-sm"
        >
          ✕
        </button>
      </div>
    );
  };

  // 1. Landing Page View (System Home)
  if (appMode === 'landing') {
    return (
      <>
        {renderGlobalToast()}
        <LandingPage
          onGoToSchoolLogin={() => {
            setPrefilledSchoolCode('');
            setAppMode('role_select');
          }}
          onGoToEnrollSchool={() => setAppMode('enroll_school')}
        />
      </>
    );
  }

  // 2. Role Selection Page (Strictly ONLY the 4 role containers + top-left back arrow)
  if (appMode === 'role_select') {
    return (
      <RoleSelectionPage
        onBack={navigateToPublicLanding}
        onSelectRole={(role) => {
          setSelectedAuthRole(role);
          setAppMode('role_auth');
        }}
      />
    );
  }

  // 3. Dedicated School Enrollment Page
  if (appMode === 'enroll_school') {
    return (
      <>
        {renderGlobalToast()}
        <EnrollSchoolPage
          onBackToLanding={navigateToPublicLanding}
          onGoToLogin={(schoolCode) => {
            loadTenantsList();
            if (schoolCode) {
              setPrefilledSchoolCode(schoolCode);
              setSelectedAuthRole('admin');
              setAppMode('role_auth');
            } else {
              setPrefilledSchoolCode('');
              setAppMode('role_select');
            }
          }}
        />
      </>
    );
  }

  // 4. Dedicated /admin Authentication Gate & Platform Owner Dashboard
  if (appMode === 'admin_login' || (appMode === 'owner_dashboard' && !isSuperAdmin)) {
    return (
      <>
        {renderGlobalToast()}
        <AdminAuthPage
          onBackToWebsite={navigateToPublicLanding}
          onSuccess={() => {
            setIsSuperAdmin(true);
            if (!isAdminRoute()) {
              window.history.replaceState({}, '', '/admin');
            }
            setAppMode('owner_dashboard');
          }}
        />
      </>
    );
  }

  if (appMode === 'owner_dashboard' && isSuperAdmin) {
    return (
      <>
        {renderGlobalToast()}
        <SuperAdminDashboard
          onLogout={() => {
            setIsSuperAdmin(false);
            if (!isAdminRoute()) {
              window.history.replaceState({}, '', '/admin');
            }
            setAppMode('admin_login');
          }}
          onBackToLanding={navigateToPublicLanding}
          onLaunchSchoolPortal={(schoolId) => {
            setCurrentSchoolId(schoolId);
            loadAllTenantData(schoolId);
            setIsLoggedIn(true);
            setCurrentRole('admin');
            setCurrentUser({
              name: 'Platform Director',
              email: 'owner@mino.com',
              role: 'admin'
            });
            setAppMode('school_app');
          }}
        />
      </>
    );
  }

  // 5. Dedicated Role Auth Page (Student, Teacher, Admin, Guardian using School Code + Email + Password)
  if (appMode === 'role_auth' || !isLoggedIn) {
    return (
      <>
        {renderGlobalToast()}
        <RoleAuthPage
          role={selectedAuthRole}
          initialSchoolCode={prefilledSchoolCode}
          onBackToRoleSelect={() => setAppMode('role_select')}
          onBackToLanding={navigateToPublicLanding}
          onGoToEnrollSchool={() => setAppMode('enroll_school')}
          onGoToPlatformAdmin={() => {
            window.history.pushState({}, '', '/admin');
            setAppMode(isSuperAdmin ? 'owner_dashboard' : 'admin_login');
          }}
          onLoginSuccess={handleLoginSuccess}
        />

        {/* Tenant Onboard Modal */}
        {showOnboardModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-[6px] bg-white p-6 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <School className="w-4 h-4 text-[#B45309]" />
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                    Onboard New School Tenant
                  </h3>
                </div>
                <button onClick={() => setShowOnboardModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">×</button>
              </div>
              <form onSubmit={handleOnboardTenantSubmit} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    School Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={onboardForm.name}
                    onChange={(e) => setOnboardForm({ ...onboardForm, name: e.target.value })}
                    placeholder="e.g. Greenwood Grammar School"
                    className="w-full px-3 py-2 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      School Code (Auto if blank)
                    </label>
                    <input
                      type="text"
                      maxLength={10}
                      value={onboardForm.code}
                      onChange={(e) => setOnboardForm({ ...onboardForm, code: e.target.value })}
                      placeholder="Auto-assigned"
                      className="w-full px-3 py-2 text-xs uppercase font-mono rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Currency Symbol
                    </label>
                    <input
                      type="text"
                      required
                      value={onboardForm.currencySymbol}
                      onChange={(e) => setOnboardForm({ ...onboardForm, currencySymbol: e.target.value })}
                      placeholder="₦ or $ or £"
                      className="w-full px-3 py-2 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                    />
                  </div>
                </div>
                <div className="pt-2 flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 py-2 text-xs font-semibold rounded-[4px] bg-[#0F172A] hover:bg-[#1E293B] text-white"
                  >
                    Provision School Tenant
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowOnboardModal(false)}
                    className="px-4 py-2 text-xs font-medium rounded-[4px] border border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    );
  }

  // 4. LOGGED-IN: Full-Featured Figma Community School Management Admin Dashboard UI
  return (
    <div className="h-screen overflow-hidden print:h-auto print:overflow-visible flex bg-slate-50 text-slate-900 font-sans antialiased">
      {renderGlobalToast()}
      {/* 1. Left Collapsible Fixed Sidebar (Never Scrolls with Content) */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tabId) => {
          setActiveTab(tabId);
        }}
        currentRole={currentRole}
        tenant={tenant}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onLogout={handleLogout}
        outboxCount={outboxCount}
        isSuperAdmin={isSuperAdmin}
        onReturnToSuperAdmin={() => setAppMode('owner_dashboard')}
      />

      {/* 2. Main Scrollable Workspace Layout */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto overflow-x-hidden print:h-auto print:overflow-visible">
        {/* Top Header */}
        <TopHeader
          tenant={tenant}
          activeTab={activeTab}
          currentRole={currentRole}
          currentUser={currentUser}
          isVaultUnlocked={isVaultUnlocked}
          onOpenVault={() => setIsVaultOpen(true)}
          onLockVault={handleLockVault}
          onLogout={handleLogout}
          students={students}
          staff={staff}
          notices={notices}
          onSelectStudent={(st) => setSelectedStudentForDossier(st)}
          onSelectTab={(tabId) => setActiveTab(tabId)}
        />

        {/* Sync / Security Notice Banner */}
        {syncNotice && (
          <div className="bg-[#B45309] text-white text-xs py-1.5 px-4 text-center font-medium shadow-sm transition-all flex items-center justify-center gap-2 font-tabular">
            <span>{syncNotice}</span>
          </div>
        )}

        {/* 3. Main Body Viewport */}
        <main className="p-4 sm:p-6 pb-20 md:pb-6 flex-1 max-w-7xl w-full mx-auto space-y-6">
          {/* TAB 1: OVERVIEW DASHBOARD */}
          {activeTab === 'dashboard' && (
            <DashboardOverview
              summary={dashboardSummary}
              tenant={tenant}
              currencySymbol={tenant?.currencySymbol || '₦'}
              currentRole={currentRole}
              onNavigateTab={(tabId) => setActiveTab(tabId)}
              onSelectStudent={(st) => setSelectedStudentForDossier(st)}
              onOpenEnrolStudent={() => setShowQuickEnrolModal(true)}
              onOpenRecordPayment={() => setShowQuickPaymentModal(true)}
              onOpenNewNotice={() => setShowQuickNoticeModal(true)}
              onOpenNewEvent={() => setShowQuickEventModal(true)}
              onOpenImportScoresJson={() => {
                setOpenGradebookImportModal(true);
                setActiveTab('gradebook');
              }}
            />
          )}

          {/* TAB 2: STUDENTS DIRECTORY */}
          {activeTab === 'students' && (
            <StudentDirectory
              currentRole={currentRole}
              userEmail={currentUser?.email || 'admin@school.edu'}
              classes={classes}
              tenantName={tenant?.name}
              onSelectStudentForDetails={(st) => setSelectedStudentForDossier(st)}
            />
          )}

          {/* TAB 3: TEACHERS & STAFF */}
          {activeTab === 'staff' && (
            <StaffManagement
              currentRole={currentRole}
              userEmail={currentUser?.email || 'admin@school.edu'}
              classes={classes}
              subjects={subjects}
              tenantName={tenant?.name}
              schoolCode={tenant?.code}
            />
          )}

          {/* TAB 4: PARENTS & GUARDIANS */}
          {activeTab === 'parents' && (
            <ParentsDirectory
              currencySymbol={tenant?.currencySymbol || '₦'}
              tenantName={tenant?.name}
            />
          )}

          {/* TAB 5: CLASSES & TIMETABLE */}
          {activeTab === 'classes' && (
            <ClassesTimetable
              classes={classes}
              subjects={subjects}
              staff={staff}
              currentRole={currentRole}
              userEmail={currentUser?.email || 'admin@school.edu'}
              onRefreshClasses={() => loadAllTenantData(currentSchoolId)}
            />
          )}

          {/* TAB 6: ATTENDANCE ROLL CALL */}
          {activeTab === 'attendance' && (
            <AttendanceTracker
              classes={classes}
              userEmail={currentUser?.email || 'teacher@school.edu'}
            />
          )}

          {/* TAB 7: GRADEBOOK & EXAMS */}
          {activeTab === 'gradebook' && (
            <Gradebook
              currentRole={currentRole}
              userEmail={currentUser?.email || 'admin@school.edu'}
              classes={classes}
              subjects={subjects}
              tenant={tenant}
              isReportsLocked={tenant?.isReportsLocked || false}
              onToggleReportLock={handleToggleReportLock}
              onSyncTriggered={triggerAutoSync}
              onScoresImported={() => loadAllTenantData(currentSchoolId)}
              initialOpenImportModal={openGradebookImportModal}
              onConsumeInitialImportModal={() => setOpenGradebookImportModal(false)}
              assignedClasses={currentUser?.assignedClasses}
              assignedSubjects={currentUser?.assignedSubjects}
              session={tenant?.currentSession}
              term={tenant?.currentTerm}
            />
          )}

          {/* TAB 8: FEES & LEDGER */}
          {activeTab === 'ledger' && (
            <FeeLedger
              currentRole={currentRole}
              userEmail={currentUser?.email || 'admin@school.edu'}
              students={students}
              currencySymbol={tenant?.currencySymbol || '₦'}
              tenant={tenant}
              classes={classes}
            />
          )}

          {/* TAB 9: NOTICE BOARD */}
          {activeTab === 'notices' && (
            <NoticeBoard
              currentRole={currentRole}
              userEmail={currentUser?.email || 'admin@school.edu'}
            />
          )}

          {/* TAB 10: SECURITY VAULT */}
          {activeTab === 'vault' && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-[4px] p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-[#065F46]" />
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                        Offline Hardware-Accelerated Encryption Vault
                      </h2>
                      <p className="text-xs text-slate-500 font-medium">
                        AES-GCM-256 with 100,000 PBKDF2 rounds. Your 6-digit Master PIN is never stored or transmitted.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsVaultOpen(true)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-[4px] bg-[#0F172A] hover:bg-[#1E293B] text-white"
                  >
                    {isVaultUnlocked ? 'Configure Vault' : 'Unlock Vault'}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-[4px]">
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Vault Status</span>
                    <span className={`text-base font-bold font-tabular mt-1 block ${
                      isVaultUnlocked ? 'text-[#065F46]' : 'text-[#B45309]'
                    }`}>
                      {isVaultUnlocked ? 'Active (Key in Memory)' : 'Locked'}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-[4px]">
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Offline Outbox Items</span>
                    <span className="text-base font-bold text-slate-900 font-tabular mt-1 block">
                      {outboxCount} Queued
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-[4px]">
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Firewall Protection</span>
                    <span className="text-base font-bold text-[#065F46] font-tabular mt-1 block">
                      Zero-Trust Rule Active
                    </span>
                  </div>
                </div>
              </div>
              <AuditTrail
                currentRole={currentRole}
                userEmail={currentUser?.email || 'admin@school.edu'}
                onDataRestored={() => loadAllTenantData(currentSchoolId)}
              />
            </div>
          )}

          {/* TAB 11: AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <AuditTrail
              currentRole={currentRole}
              userEmail={currentUser?.email || 'admin@school.edu'}
              onDataRestored={() => loadAllTenantData(currentSchoolId)}
            />
          )}

          {/* TAB 12: SCHOOL SETTINGS & BRANDING (Custom School Logo + 3-Term Calendar) */}
          {activeTab === 'settings' && (currentRole === 'admin' || currentRole === 'head_teacher') && (
            <SchoolSettings
              tenant={tenant}
              userEmail={currentUser?.email || 'admin@school.edu'}
              onTenantUpdated={(updatedSchool) => {
                setTenant(updatedSchool);
                loadTenantsList();
                loadAllTenantData(updatedSchool.id);
              }}
            />
          )}

          {/* ROLE PORTALS */}
          {activeTab === 'parent_portal' && (
            <ParentPortal
              initialReportData={parentPortalData}
              onLogout={handleLogout}
              activeSection={parentSubTab}
              onChangeSection={setParentSubTab}
            />
          )}

          {activeTab === 'student_portal' && studentPortalData && (
            <StudentPortal
              studentData={studentPortalData}
              onLogout={handleLogout}
              activeTab={studentSubTab}
              onChangeTab={setStudentSubTab}
            />
          )}
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <MobileBottomNav
          activeTab={activeTab}
          onSelectTab={(tabId) => setActiveTab(tabId)}
          currentRole={currentRole}
          tenant={tenant}
          outboxCount={outboxCount}
          onLogout={handleLogout}
          isSuperAdmin={isSuperAdmin}
          onReturnToSuperAdmin={() => setAppMode('owner_dashboard')}
          parentSubTab={parentSubTab}
          onSelectParentSubTab={setParentSubTab}
          studentSubTab={studentSubTab}
          onSelectStudentSubTab={setStudentSubTab}
        />
      </div>

      {/* Student Dossier Modal */}
      {selectedStudentForDossier && (
        <StudentProfileModal
          student={selectedStudentForDossier}
          onClose={() => setSelectedStudentForDossier(null)}
          currencySymbol={tenant?.currencySymbol || '₦'}
          tenant={tenant}
          onOpenPayment={(stdId) => {
            setQuickPaymentForm(prev => ({ ...prev, studentId: stdId }));
            setShowQuickPaymentModal(true);
          }}
        />
      )}

      {/* Offline AES-GCM Vault PIN Modal */}
      <VaultModal
        isOpen={isVaultOpen}
        onClose={() => setIsVaultOpen(false)}
        onUnlockSuccess={() => {
          setIsVaultUnlocked(true);
          setSyncNotice('Local AES-GCM-256 Vault unlocked.');
          setTimeout(() => setSyncNotice(null), 3000);
        }}
      />

      {/* Quick Enrol Pupil Modal */}
      {showQuickEnrolModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-[6px] bg-white p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Quick Enrol New Pupil
              </h3>
              <button onClick={() => setShowQuickEnrolModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">×</button>
            </div>
            <form onSubmit={handleQuickEnrolSubmit} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                    Admission No *
                  </label>
                  <input
                    type="text"
                    required
                    value={quickEnrolForm.admissionNo}
                    onChange={(e) => setQuickEnrolForm({ ...quickEnrolForm, admissionNo: e.target.value })}
                    placeholder="e.g. OMA/2026/015"
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                    Class Arm *
                  </label>
                  <select
                    value={quickEnrolForm.classArm}
                    onChange={(e) => setQuickEnrolForm({ ...quickEnrolForm, classArm: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={quickEnrolForm.firstName}
                    onChange={(e) => setQuickEnrolForm({ ...quickEnrolForm, firstName: e.target.value })}
                    placeholder="First Name"
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={quickEnrolForm.lastName}
                    onChange={(e) => setQuickEnrolForm({ ...quickEnrolForm, lastName: e.target.value })}
                    placeholder="Surname"
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  />
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Student Portal Credentials</label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="email"
                    value={quickEnrolForm.email}
                    onChange={(e) => setQuickEnrolForm({ ...quickEnrolForm, email: e.target.value })}
                    placeholder="Student Email (auto if blank)"
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  />
                  <input
                    type="text"
                    value={quickEnrolForm.studentPassword}
                    onChange={(e) => setQuickEnrolForm({ ...quickEnrolForm, studentPassword: e.target.value })}
                    placeholder="Student Password"
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  />
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <label className="block text-[11px] font-semibold text-slate-700 uppercase">Guardian Info & Portal Login</label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={quickEnrolForm.guardianName}
                    onChange={(e) => setQuickEnrolForm({ ...quickEnrolForm, guardianName: e.target.value })}
                    placeholder="Guardian Name"
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  />
                  <input
                    type="tel"
                    value={quickEnrolForm.guardianPhone}
                    onChange={(e) => setQuickEnrolForm({ ...quickEnrolForm, guardianPhone: e.target.value })}
                    placeholder="Guardian Phone"
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="email"
                    value={quickEnrolForm.guardianEmail}
                    onChange={(e) => setQuickEnrolForm({ ...quickEnrolForm, guardianEmail: e.target.value })}
                    placeholder="Guardian Login Email"
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  />
                  <input
                    type="text"
                    value={quickEnrolForm.guardianPassword}
                    onChange={(e) => setQuickEnrolForm({ ...quickEnrolForm, guardianPassword: e.target.value })}
                    placeholder="Guardian Password"
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  />
                </div>
              </div>
              <div className="pt-3 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-semibold rounded-[4px] bg-[#0F172A] hover:bg-[#1E293B] text-white"
                >
                  Enrol Pupil
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuickEnrolModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-[4px] border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Record Payment Modal */}
      {showQuickPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-[6px] bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Record Fee Payment
              </h3>
              <button onClick={() => setShowQuickPaymentModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">×</button>
            </div>
            <form onSubmit={handleQuickPaymentSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Select Pupil *</label>
                <select
                  required
                  value={quickPaymentForm.studentId}
                  onChange={(e) => setQuickPaymentForm({ ...quickPaymentForm, studentId: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                >
                  <option value="">-- Choose Pupil --</option>
                  {students.filter(s => !s.isDeleted).map(s => (
                    <option key={s.id} value={s.id}>
                      {s.firstName} {s.lastName} ({s.admissionNo}) - {s.classArm}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                    Amount ({tenant?.currencySymbol || '₦'}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={quickPaymentForm.amountMajor}
                    onChange={(e) => setQuickPaymentForm({ ...quickPaymentForm, amountMajor: e.target.value })}
                    placeholder="e.g. 50000"
                    className="w-full px-3 py-1.5 text-xs font-bold rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#065F46]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Channel</label>
                  <select
                    value={quickPaymentForm.paymentChannel}
                    onChange={(e) => setQuickPaymentForm({ ...quickPaymentForm, paymentChannel: e.target.value as any })}
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CASH">Cash</option>
                    <option value="POS">POS Terminal</option>
                    <option value="ONLINE">Online Portal</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Bank Reference</label>
                <input
                  type="text"
                  value={quickPaymentForm.referenceNo}
                  onChange={(e) => setQuickPaymentForm({ ...quickPaymentForm, referenceNo: e.target.value })}
                  placeholder="e.g. TX-992831"
                  className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                />
              </div>
              <div className="pt-3 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-semibold rounded-[4px] bg-[#065F46] hover:bg-[#064E3B] text-white"
                >
                  Record Payment & Issue Receipt
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuickPaymentModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-[4px] border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Notice Modal */}
      {showQuickNoticeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-[6px] bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Publish School Notice
              </h3>
              <button onClick={() => setShowQuickNoticeModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">×</button>
            </div>
            <form onSubmit={handleQuickNoticeSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Notice Title *</label>
                <input
                  type="text"
                  required
                  value={quickNoticeForm.title}
                  onChange={(e) => setQuickNoticeForm({ ...quickNoticeForm, title: e.target.value })}
                  placeholder="e.g. Science Fair Registration Open"
                  className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Priority</label>
                  <select
                    value={quickNoticeForm.priority}
                    onChange={(e) => setQuickNoticeForm({ ...quickNoticeForm, priority: e.target.value as any })}
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  >
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent Alert</option>
                    <option value="info">General Info</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Target Audience</label>
                  <select
                    value={quickNoticeForm.targetAudience}
                    onChange={(e) => setQuickNoticeForm({ ...quickNoticeForm, targetAudience: e.target.value as any })}
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  >
                    <option value="All">All School</option>
                    <option value="Teachers">Teachers Only</option>
                    <option value="Parents">Parents Only</option>
                    <option value="Students">Students Only</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Content *</label>
                <textarea
                  rows={3}
                  required
                  value={quickNoticeForm.content}
                  onChange={(e) => setQuickNoticeForm({ ...quickNoticeForm, content: e.target.value })}
                  placeholder="Enter notice details..."
                  className="w-full p-2 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                />
              </div>
              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-semibold rounded-[4px] bg-[#0F172A] hover:bg-[#1E293B] text-white"
                >
                  Publish Notice
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuickNoticeModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-[4px] border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Event Modal */}
      {showQuickEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-[6px] bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Add Calendar Event
              </h3>
              <button onClick={() => setShowQuickEventModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">×</button>
            </div>
            <form onSubmit={handleQuickEventSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Event Title *</label>
                <input
                  type="text"
                  required
                  value={quickEventForm.title}
                  onChange={(e) => setQuickEventForm({ ...quickEventForm, title: e.target.value })}
                  placeholder="e.g. Inter-House Sports Competition"
                  className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={quickEventForm.date}
                    onChange={(e) => setQuickEventForm({ ...quickEventForm, date: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Time</label>
                  <input
                    type="text"
                    value={quickEventForm.time}
                    onChange={(e) => setQuickEventForm({ ...quickEventForm, time: e.target.value })}
                    placeholder="e.g. 09:00 AM"
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Category</label>
                  <select
                    value={quickEventForm.category}
                    onChange={(e) => setQuickEventForm({ ...quickEventForm, category: e.target.value as any })}
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  >
                    <option value="Academic">Academic</option>
                    <option value="Sports">Sports</option>
                    <option value="Holiday">Holiday</option>
                    <option value="PTA">PTA Meeting</option>
                    <option value="Cultural">Cultural</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Location</label>
                  <input
                    type="text"
                    value={quickEventForm.location}
                    onChange={(e) => setQuickEventForm({ ...quickEventForm, location: e.target.value })}
                    placeholder="e.g. Sports Complex"
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Description</label>
                <textarea
                  rows={2}
                  value={quickEventForm.description}
                  onChange={(e) => setQuickEventForm({ ...quickEventForm, description: e.target.value })}
                  placeholder="Optional brief description..."
                  className="w-full p-2 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                />
              </div>
              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-semibold rounded-[4px] bg-[#0F172A] hover:bg-[#1E293B] text-white"
                >
                  Save Event
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuickEventModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-[4px] border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
