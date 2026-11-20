/**
 * MINO-SMS Role Selection Page
 * Strictly renders ONLY the 4 role containers (Student, Teacher, Admin, Guardian).
 * Clicking any container opens the dedicated login page for that role.
 */

import React from 'react';
import {
  GraduationCap,
  BookOpen,
  ShieldCheck,
  HeartHandshake,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import type { LoginRole } from '../types';

interface RoleSelectionPageProps {
  onSelectRole: (role: LoginRole) => void;
  onBack: () => void;
}

interface RoleCardConfig {
  role: LoginRole;
  title: string;
  description: string;
  actionLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  iconContainerClass: string;
  hoverBorderClass: string;
}

const ROLE_CARDS: RoleCardConfig[] = [
  {
    role: 'student',
    title: 'Student',
    description: 'View terminal exam results, Continuous Assessment marks, admit cards, and fee clearance.',
    actionLabel: 'Sign in as Student',
    icon: GraduationCap,
    iconContainerClass: 'bg-sky-50 text-sky-700 border-sky-200/80 group-hover:bg-sky-700 group-hover:text-white group-hover:border-sky-700',
    hoverBorderClass: 'hover:border-sky-600 focus-visible:ring-sky-600/30'
  },
  {
    role: 'teacher',
    title: 'Teacher',
    description: 'Record daily attendance roll calls, enter CA & examination grades, and manage class timetables.',
    actionLabel: 'Sign in as Teacher',
    icon: BookOpen,
    iconContainerClass: 'bg-emerald-50 text-[#065F46] border-emerald-200/80 group-hover:bg-[#065F46] group-hover:text-white group-hover:border-[#065F46]',
    hoverBorderClass: 'hover:border-[#065F46] focus-visible:ring-[#065F46]/30'
  },
  {
    role: 'admin',
    title: 'Admin',
    description: 'Oversee school admissions, faculty assignments, bursary fee ledgers, and academic operations.',
    actionLabel: 'Sign in as Admin',
    icon: ShieldCheck,
    iconContainerClass: 'bg-slate-100 text-[#0F172A] border-slate-300/80 group-hover:bg-[#0F172A] group-hover:text-amber-400 group-hover:border-[#0F172A]',
    hoverBorderClass: 'hover:border-[#0F172A] focus-visible:ring-[#0F172A]/30'
  },
  {
    role: 'guardian',
    title: 'Guardian',
    description: 'Follow your child’s academic progress, terminal report cards, attendance, and fee receipts.',
    actionLabel: 'Sign in as Guardian',
    icon: HeartHandshake,
    iconContainerClass: 'bg-amber-50 text-[#B45309] border-amber-200/80 group-hover:bg-[#B45309] group-hover:text-white group-hover:border-[#B45309]',
    hoverBorderClass: 'hover:border-[#B45309] focus-visible:ring-[#B45309]/30'
  }
];

export const RoleSelectionPage: React.FC<RoleSelectionPageProps> = ({ onSelectRole, onBack }) => {
  return (
    <main className="relative min-h-screen bg-slate-50 flex items-center justify-center p-4 pt-16 sm:p-8 font-sans antialiased">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to homepage"
        title="Back"
        className="fixed top-4 left-4 sm:top-6 sm:left-6 z-20 w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-xs hover:bg-slate-100 hover:border-slate-300 text-slate-700 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      <div className="w-full max-w-4xl grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {ROLE_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.role}
              type="button"
              onClick={() => onSelectRole(card.role)}
              className={`group bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 text-left shadow-xs hover:shadow-md transition-all duration-150 flex flex-col justify-between gap-6 cursor-pointer focus:outline-none focus-visible:ring-2 ${card.hoverBorderClass}`}
            >
              <div className="space-y-4">
                <div
                  className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-colors duration-150 ${card.iconContainerClass}`}
                >
                  <Icon className="w-6 h-6" />
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    {card.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {card.description}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs sm:text-sm font-semibold text-slate-900">
                <span>{card.actionLabel}</span>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all" />
              </div>
            </button>
          );
        })}
      </div>
    </main>
  );
};
