/**
 * MINO-SMS School Management Sidebar Component
 * Faithful implementation of the Figma Community School Management Admin Dashboard.
 * Aligned with the Complete Architecture Specification:
 * - Executive & Core Operations
 * - Academic & Assessment Modules
 * - Administration & Bursary
 * - Security & Cryptographic Vault
 */

import React from 'react';
import {
  LayoutDashboard,
  GraduationCap,
  Users,
  UserCheck,
  HeartHandshake,
  Layers,
  CalendarCheck,
  BookOpen,
  DollarSign,
  Bell,
  ShieldCheck,
  History,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings
} from 'lucide-react';
import { getSchoolLogoUrl, type UserRole, type SchoolTenant } from '../types';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  currentRole: UserRole;
  tenant: SchoolTenant | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onLogout: () => void;
  outboxCount: number;
  isSuperAdmin?: boolean;
  onReturnToSuperAdmin?: () => void;
}

interface NavSection {
  title?: string;
  items: {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  currentRole,
  tenant,
  collapsed,
  onToggleCollapse,
  onLogout,
  outboxCount,
  isSuperAdmin,
  onReturnToSuperAdmin
}) => {
  // Navigation sections by role
  const getNavSections = (): NavSection[] => {
    if (currentRole === 'teacher') {
      return [
        {
          title: 'Teaching & Academics',
          items: [
            { id: 'gradebook', label: 'Gradebook & Exams', icon: BookOpen },
            { id: 'attendance', label: 'Daily Roll Call', icon: CalendarCheck },
            { id: 'students', label: 'Class Pupils', icon: GraduationCap },
            { id: 'classes', label: 'Routine Timetable', icon: Layers },
            { id: 'notices', label: 'Staff Notices', icon: Bell }
          ]
        }
      ];
    }
    if (currentRole === 'parent') {
      return [
        {
          title: 'Family Portal',
          items: [
            { id: 'parent_portal', label: 'Ward Performance', icon: GraduationCap }
          ]
        }
      ];
    }
    if (currentRole === 'student') {
      return [
        {
          title: 'Learner Portal',
          items: [
            { id: 'student_portal', label: 'Academic Dossier', icon: GraduationCap }
          ]
        }
      ];
    }
    if (currentRole === 'bursar') {
      return [
        {
          title: 'Bursary & Finance',
          items: [
            { id: 'ledger', label: 'Fees & Bursary', icon: DollarSign },
            { id: 'dashboard', label: 'Overview Dashboard', icon: LayoutDashboard },
            { id: 'parents', label: 'Parents Directory', icon: HeartHandshake },
            { id: 'students', label: 'Students & Admissions', icon: GraduationCap },
            { id: 'notices', label: 'Notice Board', icon: Bell }
          ]
        },
        {
          title: 'Security & Integrity',
          items: [
            { id: 'vault', label: 'Security Vault', icon: ShieldCheck, badge: outboxCount > 0 ? String(outboxCount) : undefined },
            { id: 'audit', label: 'Audit Trail', icon: History }
          ]
        }
      ];
    }

    // Administrator / Principal
    return [
      {
        title: 'Academic Operations',
        items: [
          { id: 'dashboard', label: 'Overview Dashboard', icon: LayoutDashboard },
          { id: 'students', label: 'Students & Admissions', icon: GraduationCap },
          { id: 'classes', label: 'Classes & Timetable', icon: Layers },
          { id: 'attendance', label: 'Attendance Register', icon: CalendarCheck },
          { id: 'gradebook', label: 'Exams & Gradebook', icon: BookOpen }
        ]
      },
      {
        title: 'Institutional Administration',
        items: [
          { id: 'ledger', label: 'Fees & Bursary', icon: DollarSign },
          { id: 'staff', label: 'Faculty & Staff', icon: UserCheck },
          { id: 'parents', label: 'Parents Directory', icon: HeartHandshake },
          { id: 'notices', label: 'Notice Board', icon: Bell },
          { id: 'settings', label: 'School Settings', icon: Settings }
        ]
      },
      {
        title: 'Security & Integrity',
        items: [
          { id: 'vault', label: 'Security Vault', icon: ShieldCheck, badge: outboxCount > 0 ? String(outboxCount) : undefined },
          { id: 'audit', label: 'Audit Trail', icon: History }
        ]
      }
    ];
  };

  const sections = getNavSections();

  return (
    <aside
      className={`hidden md:flex h-screen sticky top-0 overflow-hidden bg-[#0F172A] text-white flex-col justify-between transition-all duration-200 z-30 shrink-0 border-r border-slate-800 no-print ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Brand Header (Fixed Top) */}
      <div className="h-16 flex items-center justify-between px-3.5 border-b border-slate-800 bg-[#0F172A] shrink-0">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center p-1 shrink-0 shadow-xs overflow-hidden">
            <img
              src={getSchoolLogoUrl(tenant)}
              alt={`${tenant?.name || 'School'} Logo`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain"
            />
          </div>
          {!collapsed && (
            <div className="truncate">
              <span className="font-bold text-sm tracking-tight text-white block truncate">
                {tenant ? tenant.name : 'MINO'}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-1 rounded-[3px] text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Sections (Independently Scrollable if Needed) */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <nav className="p-2 space-y-3 mt-1">
          {sections.map((section, sIdx) => (
            <div key={sIdx} className="space-y-1">
              {!collapsed && section.title && (
                <div className="px-3 pt-2 pb-1 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  {section.title}
                </div>
              )}
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectTab(item.id)}
                    title={collapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-[4px] transition-colors relative ${
                      isActive
                        ? 'bg-[#1E293B] text-white shadow-xs'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    } ${collapsed ? 'justify-center px-0' : ''}`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#B45309] rounded-r" />
                    )}
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-amber-400' : 'text-slate-400'
                      }`}
                    />
                    {!collapsed && (
                      <div className="flex-1 flex items-center justify-between truncate">
                        <span className="truncate">{item.label}</span>
                        {item.badge && (
                          <span className="px-1.5 py-0.2 rounded-[2px] bg-[#B45309] text-white text-[10px] font-mono font-bold">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Pinned Bottom Area */}
      <div className="p-3 border-t border-slate-800 space-y-2 bg-[#0F172A] shrink-0">
        {isSuperAdmin && onReturnToSuperAdmin && (
          <button
            onClick={onReturnToSuperAdmin}
            className={`w-full flex items-center gap-2 py-1.5 px-2 rounded-[3px] bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 text-xs font-semibold transition-colors ${
              collapsed ? 'justify-center px-0' : ''
            }`}
            title="Return to Mino Official Platform Console"
          >
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
            {!collapsed && <span className="truncate">Platform Console</span>}
          </button>
        )}

        {!collapsed ? (
          <div className="flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <span className="text-[10px] uppercase font-mono text-amber-400 font-bold block truncate">
                {currentRole} {tenant?.code ? `· ${tenant.code}` : ''}
              </span>
              <span className="text-xs font-medium text-slate-300 block truncate">
                {tenant?.currentSession} {tenant?.currentTerm ? `· ${tenant.currentTerm}` : ''}
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
  );
};
