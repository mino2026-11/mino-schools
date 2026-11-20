/**
 * MINO-SMS Student Profile & Academic Dossier Modal
 * Comprehensive student card with academic transcript, attendance rate,
 * fee clearance breakdown, and instant WhatsApp communication.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  MessageSquare,
  Award,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  Calendar,
  BookOpen,
  DollarSign,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { api } from '../services/api';
import type { Student, ScoreEvent, SchoolTenant } from '../types';

interface StudentProfileModalProps {
  student: Student | null;
  onClose: () => void;
  currencySymbol: string;
  tenant?: SchoolTenant | null;
  onOpenPayment?: (studentId: string) => void;
}

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({
  student,
  onClose,
  currencySymbol,
  tenant,
  onOpenPayment
}) => {
  const [scores, setScores] = useState<ScoreEvent[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [attendanceRate, setAttendanceRate] = useState<string>('100%');
  const [financials, setFinancials] = useState<{ totalBilled: number; totalPaid: number; arrears: number }>({
    totalBilled: 0,
    totalPaid: 0,
    arrears: 0
  });

  useEffect(() => {
    if (!student) return;
    loadStudentDetails();
  }, [student]);

  async function loadStudentDetails() {
    if (!student) return;
    setLoading(true);
    try {
      const activeSession = tenant?.currentSession || '2025/2026';
      const activeTerm = tenant?.currentTerm || '2nd Term';
      const [allScores, tenantData, ledgerData, attendanceData] = await Promise.all([
        api.getScores(student.classArm, undefined, activeSession, activeTerm),
        api.getTenant(),
        api.getLedger(student.id),
        api.getAttendance(student.classArm)
      ]);
      setSubjects(tenantData.subjects || []);
      const studentScores = allScores.filter(sc => sc.studentId === student.id);
      setScores(studentScores);
      const bal = ledgerData.studentBalances[student.id] || { totalBilled: 0, totalPaid: 0, arrears: 0 };
      setFinancials(bal);

      const studentAtt = (attendanceData.records || []).filter((r: any) => r.studentId === student.id);
      if (studentAtt.length > 0) {
        const present = studentAtt.filter((r: any) => r.status === 'present' || r.status === 'late').length;
        setAttendanceRate(`${Math.round((present / studentAtt.length) * 100)}%`);
      } else {
        setAttendanceRate('100%');
      }
    } catch (e) {
      console.warn('Error loading student profile details', e);
    } finally {
      setLoading(false);
    }
  }

  if (!student) return null;

  const subjectsMap: Record<string, string> = {};
  subjects.forEach(sub => {
    subjectsMap[sub.id] = sub.name;
  });

  const totalScoreSum = scores.reduce((acc, sc) => acc + (sc.total || 0), 0);
  const averageScore = scores.length > 0 ? (totalScoreSum / scores.length).toFixed(1) : 'N/A';
  const formatMoney = (minor: number) => {
    return `${currencySymbol}${(minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const isCleared = financials.arrears <= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-[6px] bg-white p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-[#B45309]" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Pupil Academic & Administrative Dossier
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 font-bold p-1 rounded hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Profile Card Banner */}
        <div className="mt-4 p-4 rounded-[4px] bg-slate-900 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 rounded-[4px] bg-[#1E293B] border border-slate-700 flex items-center justify-center text-xl font-bold text-amber-400">
              {student.firstName[0]}{student.lastName[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  {student.firstName} {student.lastName}
                </h3>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded-[2px] bg-slate-800 text-slate-300 font-semibold">
                  {student.classArm}
                </span>
              </div>
              <div className="text-xs text-slate-400 font-mono mt-0.5">
                Admission No: <span className="text-white font-bold">{student.admissionNo}</span> · Gender: <span className="capitalize text-slate-300">{student.gender}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:self-center">
            {isCleared ? (
              <span className="px-2.5 py-1 text-xs font-semibold rounded-[4px] bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Fees Cleared
              </span>
            ) : (
              <span className="px-2.5 py-1 text-xs font-semibold rounded-[4px] bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" /> Arrears Due
              </span>
            )}
            <button
              onClick={() => window.print()}
              className="px-2.5 py-1 text-xs font-medium rounded-[4px] bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
          </div>
        </div>

        {/* 3 Overview Quick Panels */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-[4px]">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Academic Average</span>
            <div className="text-xl font-bold text-slate-900 font-tabular mt-1">{averageScore}%</div>
            <span className="text-[11px] text-slate-500">{scores.length} Subjects Evaluated</span>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-[4px]">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Attendance Rate</span>
            <div className="text-xl font-bold text-[#065F46] font-tabular mt-1">{attendanceRate}</div>
            <span className="text-[11px] text-slate-500">Term Roll Call Record</span>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-[4px]">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Tuition Arrears</span>
            <div className={`text-xl font-bold font-tabular mt-1 ${isCleared ? 'text-slate-400' : 'text-[#B45309]'}`}>
              {formatMoney(financials.arrears)}
            </div>
            <span className="text-[11px] text-slate-500">Total Billed: {formatMoney(financials.totalBilled)}</span>
          </div>
        </div>

        {/* Guardian Contact Section */}
        <div className="mt-4 p-3.5 bg-white border border-slate-200 rounded-[4px] space-y-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Guardian & Emergency Contact
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              Portal PIN: <strong className="text-slate-800">{student.accessPin}</strong>
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Guardian Name</span>
              <span className="font-semibold text-slate-900">{student.guardianName || 'Unassigned'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Phone</span>
              <span className="font-tabular text-slate-800">{student.guardianPhone || 'N/A'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Email</span>
              <span className="text-slate-800 truncate block">{student.guardianEmail || 'N/A'}</span>
            </div>
          </div>
          {student.guardianPhone && (
            <div className="pt-2 flex gap-2">
              <a
                href={`https://wa.me/${student.guardianPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello ${student.guardianName}, regarding student ${student.firstName} ${student.lastName} (${student.admissionNo}): Term average is ${averageScore}%. Fee status: ${isCleared ? 'Cleared' : `Outstanding balance of ${formatMoney(financials.arrears)}`}.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 text-xs font-semibold rounded-[3px] bg-[#065F46] text-white hover:bg-[#064E3B] inline-flex items-center gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5" /> WhatsApp Guardian
              </a>
              {onOpenPayment && !isCleared && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenPayment(student.id);
                  }}
                  className="px-2.5 py-1 text-xs font-semibold rounded-[3px] bg-[#B45309] text-white hover:bg-[#92400E] inline-flex items-center gap-1.5"
                >
                  <DollarSign className="w-3.5 h-3.5" /> Collect Payment
                </button>
              )}
            </div>
          )}
        </div>

        {/* Academic Marks Roster */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Terminal Subject Evaluation
            </h4>
            <span className="text-[11px] text-slate-500 font-tabular">
              Session {tenant?.currentSession || '2025/2026'} · {tenant?.currentTerm || '2nd Term'}
            </span>
          </div>
          <div className="border border-slate-200 rounded-[4px] overflow-hidden">
            <table className="mino-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th className="text-center w-16">CA1 (15)</th>
                  <th className="text-center w-16">CA2 (15)</th>
                  <th className="text-center w-16">Mid (20)</th>
                  <th className="text-center w-16">Exam (50)</th>
                  <th className="text-center w-20 font-bold">Total (100)</th>
                  <th className="text-center w-16">Grade</th>
                  <th>Remark</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-6 text-slate-400">Loading student marks...</td>
                  </tr>
                ) : scores.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-6 text-slate-400">No continuous assessment records entered yet.</td>
                  </tr>
                ) : (
                  scores.map((sc, i) => (
                    <tr key={i}>
                      <td className="font-semibold text-slate-900">
                        {subjectsMap[sc.subjectId] || sc.subjectId}
                      </td>
                      <td className="text-center font-tabular text-slate-700">{sc.ca1}</td>
                      <td className="text-center font-tabular text-slate-700">{sc.ca2}</td>
                      <td className="text-center font-tabular text-slate-700">{sc.midterm}</td>
                      <td className="text-center font-tabular text-slate-700">{sc.exam}</td>
                      <td className="text-center font-tabular font-bold text-slate-900">{sc.total}</td>
                      <td className="text-center font-bold">
                        <span className={`inline-block px-1.5 py-0.2 rounded-[2px] text-xs ${
                          sc.grade === 'A' ? 'bg-emerald-100 text-[#065F46]' :
                          sc.grade === 'B' ? 'bg-emerald-50 text-emerald-800' :
                          sc.grade === 'C' ? 'bg-amber-100 text-[#B45309]' : 'bg-red-50 text-red-800'
                        }`}>
                          {sc.grade}
                        </span>
                      </td>
                      <td className="text-xs text-slate-600">{sc.remark}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 pt-3 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-[4px] bg-[#0F172A] text-white hover:bg-[#1E293B]"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
};
