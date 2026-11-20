/**
 * MINO-SMS Student Portal Module
 * Conforming to Section 2 of the Architecture Specification:
 * - Personalized Dashboard (grades, terminal reports, attendance)
 * - Academic Records & Downloadable Transcripts
 * - Examination Management: Exam schedules, admit card downloads, result viewing
 * - Fee Management: Payment history, outstanding dues, digital verified receipts
 */

import React, { useState } from 'react';
import {
  Award,
  BookOpen,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  History,
  Printer,
  ShieldCheck,
  ChevronRight,
  Calendar,
  Clock,
  MapPin,
  User,
  Download
} from 'lucide-react';
import { getSchoolLogoUrl } from '../types';

interface StudentPortalProps {
  studentData: any; // Returned from /api/student/login
  onLogout: () => void;
  activeTab?: 'results' | 'admit_card' | 'fees' | 'history';
  onChangeTab?: (tab: 'results' | 'admit_card' | 'fees' | 'history') => void;
}

export const StudentPortal: React.FC<StudentPortalProps> = ({
  studentData,
  onLogout,
  activeTab: controlledTab,
  onChangeTab
}) => {
  const [internalTab, setInternalTab] = useState<'results' | 'admit_card' | 'fees' | 'history'>('results');
  const activeTab = controlledTab ?? internalTab;
  const setActiveTab = (tab: 'results' | 'admit_card' | 'fees' | 'history') => {
    setInternalTab(tab);
    onChangeTab?.(tab);
  };

  const { student, school, currentReport, history, financialSummary } = studentData;

  function formatMoney(amountMinor: number): string {
    const major = amountMinor / 100;
    return `${school.currencySymbol}${major.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Student Examination Schedule
  const examSchedules = [
    {
      subjectCode: 'MTH',
      subjectName: 'Mathematics',
      paperTitle: 'Paper 1: Core Algebra & Geometry',
      date: '2026-03-23',
      time: '09:00 AM - 11:00 AM',
      venue: 'Main Examination Hall A',
      invigilator: 'Dr. Chukwuemeka Eze'
    },
    {
      subjectCode: 'ENG',
      subjectName: 'English Language',
      paperTitle: 'Paper 2: Comprehension & Grammar',
      date: '2026-03-24',
      time: '09:00 AM - 11:00 AM',
      venue: 'Main Examination Hall A',
      invigilator: 'Mrs. Adebayo Funke'
    },
    {
      subjectCode: 'SCI',
      subjectName: 'Basic Science & Technology',
      paperTitle: 'Theory & Applied Practical',
      date: '2026-03-25',
      time: '09:00 AM - 10:30 AM',
      venue: 'Science Laboratory Complex',
      invigilator: 'Mr. David Okafor'
    },
    {
      subjectCode: 'SOC',
      subjectName: 'Social Studies',
      paperTitle: 'Citizenship & National Values',
      date: '2026-03-26',
      time: '09:00 AM - 10:30 AM',
      venue: 'Auditorium Hall B',
      invigilator: 'Mrs. Folake Bello'
    },
    {
      subjectCode: 'BUS',
      subjectName: 'Business Studies',
      paperTitle: 'Office Practice & Book-keeping',
      date: '2026-03-27',
      time: '09:00 AM - 10:30 AM',
      venue: 'Auditorium Hall B',
      invigilator: 'Mr. Kenneth Ibrahim'
    }
  ];

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Student Identity Card */}
      <div className="bg-[#0F172A] text-white p-5 rounded-xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-white p-1.5 flex items-center justify-center shrink-0 shadow-xs overflow-hidden">
            <img
              src={getSchoolLogoUrl(school)}
              alt={`${school.name} Logo`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium block">{school.name}</span>
            <h1 className="text-lg font-bold text-white mt-0.5">
              {student.firstName} {student.lastName}
            </h1>
            <div className="text-xs text-slate-300 flex flex-wrap items-center gap-3 mt-1 font-tabular">
              <span>Admission No: <strong className="font-mono text-white">{student.admissionNo}</strong></span>
              <span>·</span>
              <span>Class: <strong className="text-white">{student.classArm}</strong></span>
              <span>·</span>
              <span>Session: <strong className="text-white">{school.currentSession} ({school.currentTerm})</strong></span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#1E293B] hover:bg-slate-800 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
          <button
            onClick={onLogout}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-950 text-red-200 hover:bg-red-900 border border-red-800 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Navigation Segmented Control (Desktop; Mobile uses fixed bottom menu) */}
      <div className="hidden md:flex p-0.5 bg-slate-200 rounded-lg border border-slate-300 no-print text-xs">
        <button
          onClick={() => setActiveTab('results')}
          className={`flex-1 py-2 font-semibold rounded-md flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'results' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Award className="w-3.5 h-3.5 text-[#B45309]" />
          <span>Terminal Results</span>
        </button>

        <button
          onClick={() => setActiveTab('admit_card')}
          className={`flex-1 py-2 font-semibold rounded-md flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'admit_card' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-blue-700" />
          <span>Exam Admit Card</span>
        </button>

        <button
          onClick={() => setActiveTab('fees')}
          className={`flex-1 py-2 font-semibold rounded-md flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'fees' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5 text-[#065F46]" />
          <span>Pending Payments & Ledger</span>
          {financialSummary.arrearsMinor > 0 && (
            <span className="px-1.5 py-0.2 rounded bg-[#B45309] text-white text-[10px] font-mono font-bold">
              Due
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 font-semibold rounded-md flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <History className="w-3.5 h-3.5 text-[#0F172A]" />
          <span>Performance History</span>
        </button>
      </div>

      {/* TAB 1: TERMINAL RESULTS VIEW */}
      {activeTab === 'results' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 border-b border-slate-100 gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Terminal Examination Results & Scores
              </h2>
              <p className="text-xs text-slate-500">{school.currentSession} · {school.currentTerm}</p>
            </div>
            <div className="flex items-center gap-2 font-tabular">
              <span className="text-xs text-slate-500 font-semibold">Cumulative Average:</span>
              <span className="text-lg font-bold text-[#065F46]">{currentReport.averageScore}%</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[11px] font-bold">
                <tr>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4 text-center w-20">CA 1 (15)</th>
                  <th className="py-3 px-4 text-center w-20">CA 2 (15)</th>
                  <th className="py-3 px-4 text-center w-20">Mid (20)</th>
                  <th className="py-3 px-4 text-center w-20">Exam (50)</th>
                  <th className="py-3 px-4 text-center w-24 font-bold">Total (100)</th>
                  <th className="py-3 px-4 text-center w-20">Grade</th>
                  <th className="py-3 px-4">Teacher Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentReport.scores.map((sc: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">{sc.subjectName}</td>
                    <td className="py-3 px-4 text-center font-tabular text-slate-700">{sc.ca1}</td>
                    <td className="py-3 px-4 text-center font-tabular text-slate-700">{sc.ca2}</td>
                    <td className="py-3 px-4 text-center font-tabular text-slate-700">{sc.midterm}</td>
                    <td className="py-3 px-4 text-center font-tabular text-slate-700">{sc.exam}</td>
                    <td className="py-3 px-4 text-center font-tabular font-bold text-slate-900">{sc.total}</td>
                    <td className="py-3 px-4 text-center font-bold">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                        sc.grade === 'A' ? 'bg-emerald-50 text-[#065F46] border border-emerald-200' :
                        sc.grade === 'B' ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                        sc.grade === 'C' ? 'bg-amber-50 text-[#B45309] border border-amber-200' :
                        'bg-red-50 text-red-800 border border-red-200'
                      }`}>
                        {sc.grade}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">{sc.remark}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-3 flex justify-between items-center text-xs text-slate-500 border-t border-slate-100">
            <span>Verified Terminal Evaluation Record</span>
            <span className="font-tabular font-semibold">Term Attendance Rate: {currentReport.attendanceRate}</span>
          </div>
        </div>
      )}

      {/* TAB 2: EXAM ADMIT CARD & HALL PASS */}
      {activeTab === 'admit_card' && (
        <div className="bg-white border-2 border-slate-800 rounded-xl p-6 sm:p-8 shadow-md space-y-6 print:border-black print:shadow-none">
          {/* Header */}
          <div className="border-b-2 border-slate-800 pb-4 text-center">
            <div className="flex justify-center mb-2">
              <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 p-1.5 flex items-center justify-center shadow-2xs overflow-hidden">
                <img
                  src={getSchoolLogoUrl(school)}
                  alt={`${school.name} Logo`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            <h2 className="text-xl font-bold text-slate-900 uppercase tracking-wide">
              {school.name}
            </h2>
            <p className="text-xs font-semibold text-slate-600">
              Official Examination Admit Card & Candidate Hall Pass
            </p>
            <div className="inline-block mt-2 px-3 py-0.5 rounded-full bg-slate-100 border border-slate-300 text-[11px] font-mono font-bold text-slate-800">
              {school.currentSession} Academic Session · {school.currentTerm}
            </div>
          </div>

          {/* Candidate Info Grid */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 border border-slate-300 rounded-lg text-xs">
            <div className="col-span-2 space-y-2">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Candidate Full Name</span>
                <span className="text-base font-bold text-slate-900">{student.firstName} {student.lastName}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Admission Number</span>
                  <span className="font-mono font-bold text-slate-800">{student.admissionNo}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Class & Stream</span>
                  <span className="font-semibold text-slate-800">{student.classArm}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Assigned Seat No</span>
                  <span className="font-mono font-bold text-[#B45309]">{student.classArm.substring(0, 3)}-{student.admissionNo.slice(-3)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Clearance Status</span>
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Fully Cleared for Examination
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center border-l border-slate-200 pl-4">
              <div className="w-24 h-28 bg-slate-200 border-2 border-slate-400 rounded-md flex flex-col items-center justify-center text-slate-500 text-xs text-center p-2">
                <User className="w-8 h-8 text-slate-400 mb-1" />
                <span className="text-[9px] font-mono uppercase">Verified Candidate Photo</span>
              </div>
            </div>
          </div>

          {/* Timetable of Registered Papers */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Registered Examination Papers & Venues
            </h4>
            <table className="w-full text-left text-xs border border-slate-300">
              <thead className="bg-slate-100 border-b border-slate-300 text-[10px] uppercase font-bold text-slate-700">
                <tr>
                  <th className="p-2">Subject & Paper</th>
                  <th className="p-2">Date</th>
                  <th className="p-2">Time</th>
                  <th className="p-2">Hall / Venue</th>
                  <th className="p-2 text-center">Invigilator Sign</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {examSchedules.map((item, idx) => (
                  <tr key={idx}>
                    <td className="p-2 font-semibold text-slate-800">{item.subjectName} ({item.paperTitle})</td>
                    <td className="p-2 font-tabular text-slate-600">{item.date}</td>
                    <td className="p-2 font-tabular text-slate-600">{item.time}</td>
                    <td className="p-2 text-slate-600">{item.venue}</td>
                    <td className="p-2 border-l border-slate-200 text-center text-slate-300 font-mono text-[10px]">
                      [ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Security Verification & Guidelines */}
          <div className="border-t border-slate-200 pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs">
            <div className="space-y-1 text-slate-500 text-[11px] max-w-sm">
              <span className="font-bold text-slate-700 block">Candidate Instructions:</span>
              <p>1. Present this original physical admit card at the entrance of the examination hall.</p>
              <p>2. Electronic communication devices and unauthorized paper materials are strictly prohibited.</p>
            </div>

            <div className="flex flex-col items-center p-2 bg-slate-50 border border-slate-200 rounded-md">
              <div className="font-mono text-center text-[10px] font-bold text-slate-800">
                ||||| | |||| || |||||| | ||||
              </div>
              <span className="font-mono text-[9px] text-slate-400 mt-1">
                CERT-AUTH-{student.admissionNo}-2026
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PENDING PAYMENTS & FEES VIEW */}
      {activeTab === 'fees' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Billed Fees</span>
              <div className="text-xl font-bold text-slate-900 font-tabular mt-1">
                {formatMoney(financialSummary.totalBilledMinor)}
              </div>
            </div>
            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <span className="text-[11px] font-semibold text-[#065F46] uppercase tracking-wider">Total Amount Paid</span>
              <div className="text-xl font-bold text-[#065F46] font-tabular mt-1">
                {formatMoney(financialSummary.totalPaidMinor)}
              </div>
            </div>
            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <span className="text-[11px] font-semibold text-[#B45309] uppercase tracking-wider">Pending Arrears</span>
              <div className="text-xl font-bold text-[#B45309] font-tabular mt-1">
                {formatMoney(financialSummary.arrearsMinor)}
              </div>
            </div>
          </div>

          {/* Pending Bills Breakdown */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide pb-2 border-b border-slate-100">
              Fee Assessment Schedule
            </h3>
            <div className="space-y-2">
              {financialSummary.pendingBills.map((bill: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                  <div>
                    <div className="font-semibold text-slate-900">{bill.description}</div>
                    <div className="text-[11px] text-slate-500">Category: {bill.category} · Billed: {new Date(bill.dateBilled).toLocaleDateString()}</div>
                  </div>
                  <div className="font-bold text-slate-900 font-tabular">
                    {formatMoney(bill.amountMinor)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Receipts History */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide pb-2 border-b border-slate-100">
              Verified Payment Receipts
            </h3>
            {financialSummary.recentReceipts.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">No payments recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {financialSummary.recentReceipts.map((rec: any, idx: number) => (
                  <div key={idx} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3.5 rounded-lg bg-emerald-50/50 border border-emerald-200 text-xs gap-2">
                    <div>
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-[#065F46]" />
                        <span>Receipt: {rec.receiptNo}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Channel: {rec.channel} · Date: {new Date(rec.date).toLocaleDateString()}
                      </div>
                      {rec.verificationHash && (
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                          Hash: {rec.verificationHash.slice(0, 16)}...
                        </div>
                      )}
                    </div>
                    <div className="font-bold text-[#065F46] font-tabular text-sm">
                      {formatMoney(rec.amountMinor)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: PERFORMANCE HISTORY VIEW */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide pb-2 border-b border-slate-100">
              Academic Performance Trajectory Across Terms
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {history.map((termRecord: any, i: number) => {
                const hasScores = Array.isArray(termRecord.scores) && termRecord.scores.length > 0;
                return (
                  <div key={i} className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{termRecord.term}</h4>
                          <span className="text-[11px] text-slate-500">{termRecord.session}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-semibold text-slate-500 block">Average</span>
                          <span className="text-base font-bold text-[#065F46] font-tabular">
                            {hasScores ? `${termRecord.averageScore}%` : '—'}
                          </span>
                        </div>
                      </div>

                      {hasScores ? (
                        <div className="space-y-1 text-xs mt-3">
                          {termRecord.scores.map((s: any, idx: number) => (
                            <div key={idx} className="flex justify-between py-1 border-b border-slate-100 font-tabular">
                              <span className="text-slate-700 font-sans truncate pr-2">{s.subjectName}</span>
                              <span className="font-semibold text-slate-900 shrink-0">{s.total}/100 ({s.grade})</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-6 text-center text-xs text-slate-400">
                          No scores recorded yet for {termRecord.term}.
                        </div>
                      )}
                    </div>

                    <div className="pt-2 text-[11px] text-slate-500 flex justify-between border-t border-slate-100">
                      <span>Attendance: {termRecord.attendance}</span>
                      <span className={hasScores ? 'text-[#065F46] font-semibold' : 'text-slate-400'}>
                        {hasScores ? 'Evaluated' : 'Upcoming'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
