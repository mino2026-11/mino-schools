/**
 * MINO-SMS Dashboard Overview Component
 * Faithful implementation of the Figma School Management Admin Dashboard UI.
 * Key features:
 * - 4 Stat Cards (Students, Teachers, Parents, Revenue)
 * - Weekly Student Attendance Rate Visualizer (Boys vs Girls)
 * - Financial Cashflow & Invoicing Comparison
 * - Academic Grade Distribution Analysis
 * - School Circulars / Notice Board Widget
 * - Upcoming School Calendar & Events
 * - Quick Actions Launcher
 * - Recent Registered Pupils Table
 */

import React, { useState } from 'react';
import {
  Users,
  GraduationCap,
  DollarSign,
  HeartHandshake,
  Calendar,
  Bell,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  BookOpen,
  Award,
  ChevronRight,
  TrendingUp,
  Clock,
  MapPin,
  Copy,
  Check,
  Settings,
  Upload
} from 'lucide-react';
import { getSchoolLogoUrl, type DashboardSummary, type Student, type SchoolTenant } from '../types';

interface DashboardOverviewProps {
  summary: DashboardSummary | null;
  tenant: SchoolTenant | null;
  currencySymbol: string;
  currentRole?: string;
  onNavigateTab: (tabId: string) => void;
  onSelectStudent: (student: Student) => void;
  onOpenEnrolStudent: () => void;
  onOpenRecordPayment: () => void;
  onOpenNewNotice: () => void;
  onOpenNewEvent?: () => void;
  onOpenImportScoresJson?: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  summary,
  tenant,
  currencySymbol,
  currentRole,
  onNavigateTab,
  onSelectStudent,
  onOpenEnrolStudent,
  onOpenRecordPayment,
  onOpenNewNotice,
  onOpenNewEvent,
  onOpenImportScoresJson
}) => {
  const [selectedDay, setSelectedDay] = useState<string>('Wed');
  const [copiedSchoolCode, setCopiedSchoolCode] = useState(false);

  if (!summary) {
    return (
      <div className="p-8 text-center text-slate-400 bg-white border border-slate-200 rounded-[4px]">
        Loading dashboard analytics...
      </div>
    );
  }

  const formatMoney = (minor: number) => {
    return `${currencySymbol}${(minor / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const activeDayData = summary.weeklyAttendance.find(d => d.day === selectedDay) || summary.weeklyAttendance[2];

  return (
    <div className="space-y-5">
      {/* Welcome Banner & Session Info */}
      <div className="bg-white border border-slate-200 rounded-[4px] p-5 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 p-1.5 flex items-center justify-center shrink-0 overflow-hidden">
            <img
              src={getSchoolLogoUrl(tenant)}
              alt={`${tenant?.name || 'School'} Logo`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-900">
                {tenant?.name || 'School Dashboard'}
              </h1>
              {tenant?.code && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(tenant.code);
                    setCopiedSchoolCode(true);
                    setTimeout(() => setCopiedSchoolCode(false), 2000);
                  }}
                  title="Copy overall School Code to share with staff, students, and guardians"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-mono font-bold text-slate-800 transition-colors"
                >
                  <span className="font-sans font-medium text-slate-500">School Code:</span>
                  <span>{tenant.code}</span>
                  {copiedSchoolCode ? (
                    <Check className="w-3 h-3 text-[#065F46]" />
                  ) : (
                    <Copy className="w-3 h-3 text-slate-400" />
                  )}
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1 font-tabular">
              {tenant?.currentSession} · {tenant?.currentTerm || '2nd Term'} — Overview of academic operations, attendance, faculty allocations, and fee receipts.
            </p>
          </div>
        </div>

        {/* Quick Action Shortcuts Strip */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenEnrolStudent}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[4px] bg-[#0F172A] hover:bg-[#1E293B] text-white shadow-sm transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Enrol Pupil</span>
          </button>
          <button
            onClick={onOpenRecordPayment}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[4px] bg-[#065F46] hover:bg-[#064E3B] text-white shadow-sm transition-colors"
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-300" />
            <span>Record Fee</span>
          </button>
          <button
            onClick={() => onNavigateTab('attendance')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[4px] bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-colors"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-700" />
            <span>Take Roll Call</span>
          </button>
          {(currentRole === 'admin' || currentRole === 'head_teacher' || currentRole === 'super_admin') && onOpenImportScoresJson && (
            <button
              onClick={onOpenImportScoresJson}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[4px] bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-[#B45309]" />
              <span>Upload Teacher JSON</span>
            </button>
          )}
          <button
            onClick={() => onNavigateTab('settings')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[4px] bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-colors"
          >
            <Settings className="w-3.5 h-3.5 text-slate-700" />
            <span>School Logo &amp; Term</span>
          </button>
        </div>
      </div>

      {/* 4 Hero KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Students */}
        <div
          onClick={() => onNavigateTab('students')}
          className="p-4 bg-white border border-slate-200 rounded-[4px] shadow-sm hover:border-slate-400 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Enrolled Pupils
            </span>
            <div className="w-8 h-8 rounded-[4px] bg-slate-100 group-hover:bg-slate-900 group-hover:text-amber-400 text-slate-700 flex items-center justify-center transition-colors">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-tabular mt-2">
            {summary.totalStudents.toLocaleString()}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
            <span>
              <strong className="text-slate-800">{summary.maleStudentsCount}</strong> Boys · <strong className="text-slate-800">{summary.femaleStudentsCount}</strong> Girls
            </span>
            <span className="text-[#065F46] font-semibold flex items-center">
              Active <ChevronRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
        </div>

        {/* Card 2: Faculty */}
        <div
          onClick={() => onNavigateTab('staff')}
          className="p-4 bg-white border border-slate-200 rounded-[4px] shadow-sm hover:border-slate-400 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Teaching Faculty
            </span>
            <div className="w-8 h-8 rounded-[4px] bg-emerald-50 group-hover:bg-[#065F46] group-hover:text-white text-[#065F46] flex items-center justify-center transition-colors">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-tabular mt-2">
            {summary.totalTeachers}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
            <span>
              Across <strong className="text-slate-800">{summary.totalClasses}</strong> Class Arms
            </span>
            <span className="text-[#065F46] font-semibold flex items-center">
              100% Assigned <ChevronRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
        </div>

        {/* Card 3: Parents */}
        <div
          onClick={() => onNavigateTab('parents')}
          className="p-4 bg-white border border-slate-200 rounded-[4px] shadow-sm hover:border-slate-400 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Guardians Linked
            </span>
            <div className="w-8 h-8 rounded-[4px] bg-amber-50 group-hover:bg-[#B45309] group-hover:text-white text-[#B45309] flex items-center justify-center transition-colors">
              <HeartHandshake className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 font-tabular mt-2">
            {summary.totalParents}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
            <span>
              Portal Access Enabled
            </span>
            <span className="text-[#B45309] font-semibold flex items-center">
              SMS / WhatsApp <ChevronRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
        </div>

        {/* Card 4: Fee Revenue */}
        <div
          onClick={() => onNavigateTab('ledger')}
          className="p-4 bg-white border border-slate-200 rounded-[4px] shadow-sm hover:border-slate-400 transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Fee Collections
            </span>
            <div className="w-8 h-8 rounded-[4px] bg-slate-100 group-hover:bg-slate-900 group-hover:text-emerald-400 text-slate-700 flex items-center justify-center transition-colors">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#065F46] font-tabular mt-2">
            {formatMoney(summary.financial.totalPaidMinor)}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100">
            <div className="flex justify-between items-center text-[10px] text-slate-500 font-tabular mb-1">
              <span>Collection Progress</span>
              <span className="font-bold text-slate-800">{summary.financial.collectionPercentage}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-[2px] h-1.5 overflow-hidden">
              <div
                className="bg-[#065F46] h-full rounded-[2px] transition-all"
                style={{ width: `${Math.min(100, summary.financial.collectionPercentage)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Interactive Attendance Trend + Financial Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Attendance Visualizer (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-[4px] p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#B45309]" />
                <span>Weekly Pupil Attendance Analysis</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Daily roll call turnout across boys and girls
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                <span className="w-2.5 h-2.5 bg-[#0F172A] rounded-[2px] inline-block" /> Boys
              </span>
              <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                <span className="w-2.5 h-2.5 bg-[#B45309] rounded-[2px] inline-block" /> Girls
              </span>
              <button
                onClick={() => onNavigateTab('attendance')}
                className="text-[11px] font-semibold text-[#065F46] hover:underline ml-1"
              >
                Open Register →
              </button>
            </div>
          </div>

          {/* Interactive Bar Chart Representation */}
          <div className="grid grid-cols-5 gap-3 pt-2">
            {summary.weeklyAttendance.map((item) => {
              const isSelected = selectedDay === item.day;
              return (
                <div
                  key={item.day}
                  onClick={() => setSelectedDay(item.day)}
                  className={`p-2.5 rounded-[4px] border transition-all cursor-pointer text-center flex flex-col justify-between ${
                    isSelected
                      ? 'bg-slate-50 border-[#0F172A] ring-1 ring-[#0F172A]'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-800">{item.day}</div>
                  {/* Bars container */}
                  <div className="h-28 flex items-end justify-center gap-1.5 py-2">
                    {/* Boys Bar */}
                    <div className="w-3.5 bg-slate-200 rounded-t-[2px] h-full flex items-end">
                      <div
                        className="w-full bg-[#0F172A] rounded-t-[2px] transition-all"
                        style={{ height: `${item.boysRate}%` }}
                        title={`Boys: ${item.boysRate}%`}
                      />
                    </div>
                    {/* Girls Bar */}
                    <div className="w-3.5 bg-slate-200 rounded-t-[2px] h-full flex items-end">
                      <div
                        className="w-full bg-[#B45309] rounded-t-[2px] transition-all"
                        style={{ height: `${item.girlsRate}%` }}
                        title={`Girls: ${item.girlsRate}%`}
                      />
                    </div>
                  </div>
                  <div className="text-[11px] font-bold text-slate-900 font-tabular">
                    {item.averageRate}%
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Day Inspector */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-[3px] flex items-center justify-between text-xs font-tabular">
            <div>
              <span className="font-semibold text-slate-800">{activeDayData.day} Roll Call Detail: </span>
              <span className="text-slate-600">Boys {activeDayData.boysRate}% · Girls {activeDayData.girlsRate}%</span>
            </div>
            <div className="text-[#065F46] font-bold">
              Aggregate Turnout: {activeDayData.averageRate}%
            </div>
          </div>
        </div>

        {/* Grade Distribution & Academic Performance (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-[4px] p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                <Award className="w-4 h-4 text-[#065F46]" />
                <span>Grade Distribution ({tenant?.currentTerm || 'Term'})</span>
              </h3>
              <button
                onClick={() => onNavigateTab('gradebook')}
                className="text-[11px] font-semibold text-[#0F172A] hover:underline"
              >
                Gradebook →
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Performance breakdown across continuous assessment and examination scores.
            </p>

            <div className="space-y-2.5 mt-4">
              {summary.gradeDistribution.map((gd) => (
                <div key={gd.grade} className="space-y-1">
                  <div className="flex justify-between text-xs font-tabular">
                    <span className="font-semibold text-slate-800 flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ backgroundColor: gd.color }}
                      />
                      Grade {gd.grade} ({gd.label})
                    </span>
                    <span className="text-slate-600">
                      <strong>{gd.count}</strong> pupils ({gd.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-[2px] h-2 overflow-hidden">
                    <div
                      className="h-full rounded-[2px] transition-all"
                      style={{
                        width: `${Math.max(5, gd.percentage)}%`,
                        backgroundColor: gd.color
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-[3px] text-[11px] text-slate-600 flex justify-between items-center">
            <span>Terminal Average: <strong className="text-slate-900 font-tabular">{summary.terminalAverage !== undefined ? `${summary.terminalAverage}%` : 'N/A'}</strong></span>
            <span className="text-[#065F46] font-semibold">Pass Rate: {summary.passRate !== undefined ? `${summary.passRate}%` : '100%'}</span>
          </div>
        </div>
      </div>

      {/* Row 3: Notice Board & Circulars + Upcoming Events */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Notice Board Widget (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-[4px] p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#B45309]" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                School Notice Board & Urgent Circulars
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenNewNotice}
                className="text-[11px] font-semibold text-white bg-[#0F172A] hover:bg-[#1E293B] px-2.5 py-1 rounded-[3px]"
              >
                + Post Notice
              </button>
              <button
                onClick={() => onNavigateTab('notices')}
                className="text-[11px] font-semibold text-slate-600 hover:text-slate-900"
              >
                View All →
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            {summary.recentNotices.map((notice) => (
              <div
                key={notice.id}
                className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-[4px] transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded-[2px] ${
                          notice.priority === 'urgent'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {notice.priority}
                      </span>
                      <span className="text-xs font-bold text-slate-900">{notice.title}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed line-clamp-2">
                      {notice.content}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
                    {notice.date}
                  </span>
                </div>
                <div className="mt-2 text-[10px] text-slate-500 flex justify-between border-t border-slate-200/60 pt-1.5">
                  <span>Author: <strong>{notice.author}</strong></span>
                  <span>Audience: <strong className="text-slate-700">{notice.targetAudience}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Academic Calendar & Events (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-[4px] p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#065F46]" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Academic Calendar & Milestones
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {onOpenNewEvent && (
                <button
                  onClick={onOpenNewEvent}
                  className="text-[11px] font-semibold text-white bg-[#065F46] hover:bg-[#064E3B] px-2.5 py-1 rounded-[3px] transition-colors"
                >
                  + Add Event
                </button>
              )}
              <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                {tenant?.currentTerm || '2nd Term'}
              </span>
            </div>
          </div>

          <div className="space-y-2.5">
            {summary.upcomingEvents.map((evt) => (
              <div
                key={evt.id}
                className="p-3 border border-slate-200 rounded-[4px] bg-slate-50/50 hover:bg-slate-50 transition-colors flex items-start gap-3"
              >
                <div className="p-2 rounded-[4px] bg-[#0F172A] text-white text-center shrink-0 w-11">
                  <div className="text-[9px] uppercase font-bold text-amber-400">
                    {new Date(evt.date).toLocaleString('en-US', { month: 'short' })}
                  </div>
                  <div className="text-sm font-bold font-tabular">
                    {new Date(evt.date).getDate()}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900 truncate">{evt.title}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {evt.time}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3" /> {evt.location}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Recent Pupils Registered Table */}
      <div className="bg-white border border-slate-200 rounded-[4px] overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Recently Enrolled Pupils
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Click any pupil to open their verified dossier, marks transcript, and parent links.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('students')}
            className="text-xs font-semibold text-[#0F172A] hover:underline flex items-center gap-1"
          >
            <span>Full Directory</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="mino-table">
            <thead>
              <tr>
                <th className="w-32">Admission No</th>
                <th>Pupil Name</th>
                <th>Class Arm</th>
                <th>Guardian Contact</th>
                <th>Portal PIN</th>
                <th>Registration Date</th>
                <th className="text-right">Dossier</th>
              </tr>
            </thead>
            <tbody>
              {summary.recentStudents.map((st) => (
                <tr
                  key={st.id}
                  onClick={() => onSelectStudent(st)}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  <td className="font-mono font-medium text-slate-900">{st.admissionNo}</td>
                  <td className="font-semibold text-slate-900">
                    {st.firstName} {st.lastName}
                  </td>
                  <td>
                    <span className="font-medium text-slate-700">{st.classArm}</span>
                  </td>
                  <td className="text-slate-600">
                    <div>{st.guardianName || 'Unassigned'}</div>
                    <div className="text-[10px] text-slate-400 font-tabular">{st.guardianPhone}</div>
                  </td>
                  <td>
                    <span className="font-mono text-xs font-semibold text-slate-700">
                      {st.accessPin}
                    </span>
                  </td>
                  <td className="text-xs text-slate-500 font-tabular">
                    {new Date(st.createdAt).toLocaleDateString()}
                  </td>
                  <td className="text-right">
                    <span className="px-2 py-1 text-xs font-semibold rounded-[2px] bg-slate-100 text-slate-800 group-hover:bg-slate-200 inline-flex items-center gap-1">
                      View Dossier
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
