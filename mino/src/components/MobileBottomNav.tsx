/**
 * MINO-SMS Mobile Bottom Navigation & Slide-Up Module Drawer
 * Ergonomic thumb-zone navigation (<768px) across Admin, Teacher, Parent, and Student roles.
 */

import React, { useState } from 'react';
import {
  LayoutDashboard,
  GraduationCap,
  CalendarCheck,
  DollarSign,
  LayoutGrid,
  BookOpen,
  Layers,
  UserCheck,
  HeartHandshake,
  Bell,
  ShieldCheck,
  History,
  LogOut,
  X,
  Award,
  Printer,
  Calendar,
  Settings
} from 'lucide-react';
import { getSchoolLogoUrl, type UserRole, type SchoolTenant } from '../types';

interface MobileBottomNavProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  currentRole: UserRole;
  tenant: SchoolTenant | null;
  outboxCount: number;
  onLogout: () => void;
  isSuperAdmin?: boolean;
  onReturnToSuperAdmin?: () => void;
  parentSubTab?: 'current' | 'history';
  onSelectParentSubTab?: (sub: 'current' | 'history') => void;
  studentSubTab?: 'results' | 'admit_card' | 'fees' | 'history';
  onSelectStudentSubTab?: (sub: 'results' | 'admit_card' | 'fees' | 'history') => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  currentRole,
  tenant,
  outboxCount,
  onLogout,
  isSuperAdmin,
  onReturnToSuperAdmin,
  parentSubTab = 'current',
  onSelectParentSubTab,
  studentSubTab = 'results',
  onSelectStudentSubTab
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleNavigate = (tabId: string) => {
    onSelectTab(tabId);
    setDrawerOpen(false);
  };

  // Student Role Bottom Bar
  if (currentRole === 'student') {
    const items = [
      { id: 'results' as const, label: 'Results', icon: Award },
      { id: 'admit_card' as const, label: 'Admit Card', icon: Calendar },
      { id: 'fees' as const, label: 'Fees', icon: DollarSign },
      { id: 'history' as const, label: 'History', icon: History }
    ];
    return (
      <nav
        aria-label="Student mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe no-print"
      >
        <div className="grid grid-cols-5 items-center h-16 px-1">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = studentSubTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab('student_portal');
                  onSelectStudentSubTab?.(item.id);
                }}
                className={`min-h-[44px] flex flex-col items-center justify-center relative transition-colors ${
                  isActive ? 'text-[#B45309]' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-[#B45309] rounded-full" />
                )}
                <Icon className="w-5 h-5 shrink-0" />
                <span className={`text-[10px] tracking-tight mt-1 whitespace-nowrap truncate max-w-[64px] ${isActive ? 'font-bold text-slate-900' : 'font-medium'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={onLogout}
            className="min-h-[44px] flex flex-col items-center justify-center text-slate-500 hover:text-red-700 transition-colors"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className="text-[10px] font-medium tracking-tight mt-1 whitespace-nowrap">Exit</span>
          </button>
        </div>
      </nav>
    );
  }

  // Parent Role Bottom Bar
  if (currentRole === 'parent') {
    return (
      <nav
        aria-label="Guardian mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe no-print"
      >
        <div className="grid grid-cols-4 items-center h-16 px-1">
          <button
            type="button"
            onClick={() => {
              onSelectTab('parent_portal');
              onSelectParentSubTab?.('current');
            }}
            className={`min-h-[44px] flex flex-col items-center justify-center relative transition-colors ${
              parentSubTab === 'current' ? 'text-[#B45309]' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {parentSubTab === 'current' && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-[#B45309] rounded-full" />
            )}
            <Award className="w-5 h-5 shrink-0" />
            <span className={`text-[10px] tracking-tight mt-1 whitespace-nowrap ${parentSubTab === 'current' ? 'font-bold text-slate-900' : 'font-medium'}`}>
              Report Card
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectTab('parent_portal');
              onSelectParentSubTab?.('history');
            }}
            className={`min-h-[44px] flex flex-col items-center justify-center relative transition-colors ${
              parentSubTab === 'history' ? 'text-[#B45309]' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {parentSubTab === 'history' && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-[#B45309] rounded-full" />
            )}
            <History className="w-5 h-5 shrink-0" />
            <span className={`text-[10px] tracking-tight mt-1 whitespace-nowrap ${parentSubTab === 'history' ? 'font-bold text-slate-900' : 'font-medium'}`}>
              History
            </span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="min-h-[44px] flex flex-col items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"
          >
            <Printer className="w-5 h-5 shrink-0" />
            <span className="text-[10px] font-medium tracking-tight mt-1 whitespace-nowrap">Print</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="min-h-[44px] flex flex-col items-center justify-center text-slate-500 hover:text-red-700 transition-colors"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className="text-[10px] font-medium tracking-tight mt-1 whitespace-nowrap">Exit</span>
          </button>
        </div>
      </nav>
    );
  }

  // Teacher, Bursar & Admin Primary Tabs + More Sheet
  const primaryTabs =
    currentRole === 'teacher'
      ? [
          { id: 'gradebook', label: 'Gradebook', icon: BookOpen },
          { id: 'attendance', label: 'Roll Call', icon: CalendarCheck },
          { id: 'students', label: 'Pupils', icon: GraduationCap },
          { id: 'classes', label: 'Timetable', icon: Layers }
        ]
      : currentRole === 'bursar'
      ? [
          { id: 'ledger', label: 'Fees', icon: DollarSign },
          { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
          { id: 'parents', label: 'Parents', icon: HeartHandshake },
          { id: 'students', label: 'Pupils', icon: GraduationCap }
        ]
      : [
          { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
          { id: 'students', label: 'Pupils', icon: GraduationCap },
          { id: 'attendance', label: 'Roll Call', icon: CalendarCheck },
          { id: 'ledger', label: 'Fees', icon: DollarSign }
        ];

  const moreModules =
    currentRole === 'teacher'
      ? [{ id: 'notices', label: 'Staff Notices', icon: Bell }]
      : currentRole === 'bursar'
      ? [
          { id: 'notices', label: 'Notice Board', icon: Bell },
          {
            id: 'vault',
            label: 'Security Vault',
            icon: ShieldCheck,
            badge: outboxCount > 0 ? String(outboxCount) : undefined
          },
          { id: 'audit', label: 'Audit Trail', icon: History }
        ]
      : [
          { id: 'gradebook', label: 'Exams & Gradebook', icon: BookOpen },
          { id: 'classes', label: 'Classes & Timetable', icon: Layers },
          { id: 'staff', label: 'Faculty & Staff', icon: UserCheck },
          { id: 'parents', label: 'Parents Directory', icon: HeartHandshake },
          { id: 'notices', label: 'Notice Board', icon: Bell },
          { id: 'settings', label: 'School Settings', icon: Settings },
          {
            id: 'vault',
            label: 'Security Vault',
            icon: ShieldCheck,
            badge: outboxCount > 0 ? String(outboxCount) : undefined
          },
          { id: 'audit', label: 'Audit Trail', icon: History }
        ];

  const isMoreActive = moreModules.some((m) => m.id === activeTab);

  return (
    <>
      {/* Slide-Up Bottom Sheet Drawer */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex flex-col justify-end no-print"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className="bg-white rounded-t-3xl border-t border-slate-200 px-4 pb-8 pt-2 shadow-2xl max-h-[82vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle */}
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto my-2.5" />

            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={getSchoolLogoUrl(tenant)}
                  alt={`${tenant?.name || 'School'} Logo`}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 object-contain shrink-0 rounded bg-white"
                />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 truncate">
                    {tenant?.name || 'School Workspace'}
                  </h3>
                  <p className="text-xs text-slate-500 capitalize">
                    {currentRole} · {tenant?.currentSession || 'Current Session'}
                    {tenant?.currentTerm ? ` · ${tenant.currentTerm}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {moreModules.map((mod) => {
                const Icon = mod.icon;
                const active = activeTab === mod.id;
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => handleNavigate(mod.id)}
                    className={`min-h-[52px] p-3 rounded-xl border text-left flex items-center gap-2.5 transition-colors ${
                      active
                        ? 'bg-[#0F172A] border-[#0F172A] text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-amber-400' : 'text-slate-600'}`} />
                    <span className="text-xs font-semibold truncate flex-1">{mod.label}</span>
                    {'badge' in mod && mod.badge && (
                      <span className="text-[10px] font-mono font-bold text-[#B45309]">{mod.badge}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
              {isSuperAdmin && onReturnToSuperAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    onReturnToSuperAdmin();
                  }}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4 text-[#B45309]" />
                  <span>Return to Platform Console</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  onLogout();
                }}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-800 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Bottom Navigation Tab Bar */}
      <nav
        aria-label="Mobile workspace navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe no-print"
      >
        <div className="grid grid-cols-5 items-center h-16 px-1">
          {primaryTabs.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id && !drawerOpen;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`min-h-[44px] flex flex-col items-center justify-center relative transition-colors ${
                  isActive ? 'text-[#B45309]' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-[#B45309] rounded-full" />
                )}
                <Icon className="w-5 h-5 shrink-0" />
                <span
                  className={`text-[10px] tracking-tight mt-1 whitespace-nowrap truncate max-w-[64px] ${
                    isActive ? 'font-bold text-slate-900' : 'font-medium'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setDrawerOpen(!drawerOpen)}
            className={`min-h-[44px] flex flex-col items-center justify-center relative transition-colors ${
              drawerOpen || isMoreActive ? 'text-[#B45309]' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {(drawerOpen || isMoreActive) && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-[#B45309] rounded-full" />
            )}
            <div className="relative">
              <LayoutGrid className="w-5 h-5 shrink-0" />
              {outboxCount > 0 && (
                <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-[#B45309]" />
              )}
            </div>
            <span
              className={`text-[10px] tracking-tight mt-1 whitespace-nowrap ${
                drawerOpen || isMoreActive ? 'font-bold text-slate-900' : 'font-medium'
              }`}
            >
              More
            </span>
          </button>
        </div>
      </nav>
    </>
  );
};
