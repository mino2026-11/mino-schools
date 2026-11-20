/**
 * MINO-SMS Top Navigation Header
 * Top Bar Contract compliant:
 * - Breadcrumbs / Brand path on the left
 * - Global Instant Search across pupils, staff, classes, and notices
 * - Online/Offline Sync, Vault status, Notifications Bell, Profile & Sign Out on the right
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Lock,
  Unlock,
  Bell,
  LogOut,
  ChevronDown,
  GraduationCap,
  Users,
  X
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { getSchoolLogoUrl, type SchoolTenant, type Student, type StaffUser, type Notice, type UserRole } from '../types';

interface TopHeaderProps {
  tenant: SchoolTenant | null;
  activeTab: string;
  currentRole: UserRole;
  currentUser: any;
  isVaultUnlocked: boolean;
  onOpenVault: () => void;
  onLockVault: () => void;
  onLogout: () => void;
  students: Student[];
  staff: StaffUser[];
  notices: Notice[];
  onSelectStudent: (student: Student) => void;
  onSelectTab: (tabId: string) => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  tenant,
  activeTab,
  currentRole,
  currentUser,
  isVaultUnlocked,
  onOpenVault,
  onLockVault,
  onLogout,
  students,
  staff,
  notices,
  onSelectStudent,
  onSelectTab
}) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const noticesRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
      if (noticesRef.current && !noticesRef.current.contains(e.target as Node)) {
        setNoticesOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const tabTitles: Record<string, string> = {
    dashboard: 'Overview Dashboard',
    students: 'Pupils Directory',
    staff: 'Faculty & Duty Assignments',
    parents: 'Parents & Guardians',
    classes: 'Classes & Weekly Routine',
    attendance: 'Daily Roll Call Register',
    gradebook: 'Gradebook & Exams',
    ledger: 'Fees & Financial Ledger',
    notices: 'Notice Board & Circulars',
    vault: 'Security & Encryption Vault',
    audit: 'Immutable Audit Trail',
    settings: 'School Settings & Branding',
    student_portal: 'Student Portal',
    parent_portal: 'Guardian Portal'
  };

  // Filter search results
  const q = searchQuery.toLowerCase().trim();
  const searchResults = {
    students: q ? students.filter(s => !s.isDeleted && (`${s.firstName} ${s.lastName} ${s.admissionNo} ${s.classArm}`).toLowerCase().includes(q)).slice(0, 4) : [],
    staff: q ? staff.filter(s => (`${s.name} ${s.email} ${s.role}`).toLowerCase().includes(q)).slice(0, 3) : [],
    notices: q ? notices.filter(n => (`${n.title} ${n.content}`).toLowerCase().includes(q)).slice(0, 2) : []
  };

  const hasResults = searchResults.students.length > 0 || searchResults.staff.length > 0 || searchResults.notices.length > 0;

  return (
    <header className="h-14 sm:h-16 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between gap-2.5 sm:gap-4 sticky top-0 z-20 shadow-xs no-print">
      {/* Zone 1: Brand Avatar on Mobile + Breadcrumb & Title */}
      <div className="flex items-center gap-2 min-w-0">
        <img
          src={getSchoolLogoUrl(tenant)}
          alt={`${tenant?.name || 'School'} Logo`}
          referrerPolicy="no-referrer"
          className="w-8 h-8 object-contain md:hidden shrink-0 rounded bg-white"
        />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide truncate hidden lg:inline">
          {tenant?.name || 'MINO'}
        </span>
        <span className="text-slate-300 hidden lg:inline">/</span>
        <h1 className="text-sm font-bold text-slate-900 truncate">
          {tabTitles[activeTab] || 'Dashboard'}
        </h1>
        <span className="text-xs text-slate-400 hidden xl:inline" aria-hidden="true">·</span>
        <span className="text-xs text-slate-500 font-medium hidden xl:inline whitespace-nowrap">
          {tenant?.currentTerm || '2nd Term'}
        </span>
      </div>

      {/* Zone 2: Global Instant Search with Dropdown Results */}
      <div className="flex-1 max-w-[180px] sm:max-w-md relative" ref={searchRef}>
        <div className="relative">
          <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onFocus={() => setSearchOpen(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchOpen(true);
            }}
            placeholder="Search..."
            className="w-full pl-8 sm:pl-9 pr-7 py-1.5 text-xs rounded-lg sm:rounded-[4px] border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#0F172A] transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSearchOpen(false);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Live Search Autocomplete Popover */}
        {searchOpen && searchQuery.trim() && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-[4px] shadow-xl p-3 z-50 max-h-96 overflow-y-auto space-y-3">
            {!hasResults ? (
              <div className="text-center py-4 text-xs text-slate-400">
                No records found matching "{searchQuery}".
              </div>
            ) : (
              <>
                {/* Pupils */}
                {searchResults.students.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <GraduationCap className="w-3 h-3" /> Pupils
                    </div>
                    <div className="space-y-1">
                      {searchResults.students.map((st) => (
                        <div
                          key={st.id}
                          onClick={() => {
                            onSelectStudent(st);
                            setSearchOpen(false);
                            setSearchQuery('');
                          }}
                          className="p-1.5 rounded-[3px] hover:bg-slate-50 cursor-pointer flex justify-between items-center text-xs"
                        >
                          <div>
                            <span className="font-semibold text-slate-900">{st.firstName} {st.lastName}</span>
                            <span className="text-[11px] text-slate-500 ml-1.5">({st.admissionNo})</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-600">{st.classArm}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Faculty */}
                {searchResults.staff.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Users className="w-3 h-3" /> Faculty
                    </div>
                    <div className="space-y-1">
                      {searchResults.staff.map((s) => (
                        <div
                          key={s.id}
                          onClick={() => {
                            onSelectTab('staff');
                            setSearchOpen(false);
                            setSearchQuery('');
                          }}
                          className="p-1.5 rounded-[3px] hover:bg-slate-50 cursor-pointer flex justify-between items-center text-xs"
                        >
                          <span className="font-semibold text-slate-900">{s.name}</span>
                          <span className="text-[10px] uppercase text-slate-500">{s.role}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notices */}
                {searchResults.notices.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Bell className="w-3 h-3" /> Notices
                    </div>
                    <div className="space-y-1">
                      {searchResults.notices.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => {
                            onSelectTab('notices');
                            setSearchOpen(false);
                            setSearchQuery('');
                          }}
                          className="p-1.5 rounded-[3px] hover:bg-slate-50 cursor-pointer text-xs"
                        >
                          <div className="font-semibold text-slate-900 truncate">{n.title}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Zone 3: Controls (Vault, Notices, Profile) */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <PWAInstallButton />

        {/* Offline Vault Lock Button */}
        <button
          onClick={() => {
            if (isVaultUnlocked) {
              onLockVault();
            } else {
              onOpenVault();
            }
          }}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-[4px] border transition-colors ${
            isVaultUnlocked
              ? 'bg-emerald-50 border-emerald-300 text-[#065F46] hover:bg-emerald-100'
              : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
          }`}
          title={isVaultUnlocked ? 'Vault Unlocked: Click to Lock.' : 'Unlock Local Encrypted Vault'}
        >
          {isVaultUnlocked ? (
            <>
              <Unlock className="w-3.5 h-3.5 text-[#065F46]" />
              <span className="hidden lg:inline text-xs">Vault Active</span>
            </>
          ) : (
            <>
              <Lock className="w-3.5 h-3.5 text-[#B45309]" />
              <span className="hidden lg:inline text-xs">Unlock Vault</span>
            </>
          )}
        </button>

        {/* Notifications Bell */}
        <div className="relative" ref={noticesRef}>
          <button
            onClick={() => setNoticesOpen(!noticesOpen)}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-[4px] relative transition-colors"
            title="School Circulars & Notifications"
          >
            <Bell className="w-4 h-4" />
            {notices.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#B45309]" />
            )}
          </button>

          {/* Notifications Dropdown Drawer */}
          {noticesOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-[4px] shadow-xl p-3 z-50 space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Official Circulars ({notices.length})
                </span>
                <button
                  onClick={() => {
                    onSelectTab('notices');
                    setNoticesOpen(false);
                  }}
                  className="text-[11px] font-semibold text-[#0F172A] hover:underline"
                >
                  View All
                </button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {notices.slice(0, 4).map((n) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      onSelectTab('notices');
                      setNoticesOpen(false);
                    }}
                    className="p-2 rounded-[3px] bg-slate-50 hover:bg-slate-100 cursor-pointer text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] font-bold uppercase px-1 py-0.2 rounded ${
                        n.priority === 'urgent' ? 'bg-red-100 text-red-800' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {n.priority}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{n.date}</span>
                    </div>
                    <div className="font-semibold text-slate-900 leading-tight">{n.title}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Dropdown */}
        <div className="relative pl-1 border-l border-slate-200" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 p-1 rounded-[4px] hover:bg-slate-100 transition-colors"
          >
            <div className="w-7 h-7 rounded-[4px] bg-[#0F172A] text-amber-400 flex items-center justify-center font-bold text-xs">
              {currentUser?.name?.[0] || 'A'}
            </div>
            <div className="text-left hidden sm:block">
              <span className="text-xs font-bold text-slate-900 block truncate max-w-[100px]">
                {currentUser?.name || 'Admin'}
              </span>
              <span className="text-[10px] font-mono text-slate-500 capitalize block">
                {currentRole}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-[4px] shadow-xl p-2 z-50 space-y-1">
              <div className="px-2 py-1.5 border-b border-slate-100 text-xs">
                <span className="font-bold text-slate-900 block">{currentUser?.name || 'Administrator'}</span>
                <span className="text-[11px] text-slate-500 font-mono">{currentUser?.email || 'admin@school.edu'}</span>
              </div>
              {(currentRole === 'admin' || currentRole === 'head_teacher') && (
                <>
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      onSelectTab('dashboard');
                    }}
                    className="w-full text-left px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded-[3px]"
                  >
                    Overview Console
                  </button>
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      onSelectTab('settings');
                    }}
                    className="w-full text-left px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded-[3px]"
                  >
                    School Settings &amp; Logo
                  </button>
                  <button
                    onClick={() => {
                      setProfileOpen(false);
                      onSelectTab('vault');
                    }}
                    className="w-full text-left px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded-[3px]"
                  >
                    Offline Security Vault
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  setProfileOpen(false);
                  onLogout();
                }}
                className="w-full text-left px-2 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 rounded-[3px] flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
