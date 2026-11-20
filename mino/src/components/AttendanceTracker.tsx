/**
 * MINO-SMS Daily Attendance Tracker & Roll Call Register
 * Allows teachers and administrators to take roll call, mark Present/Absent/Late/Excused,
 * bulk-mark present, and monitor class attendance percentages.
 */

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  HelpCircle,
  Users,
  Search,
  Check,
  RotateCcw
} from 'lucide-react';
import { api } from '../services/api';
import type { ClassArm, AttendanceStatus } from '../types';

interface AttendanceTrackerProps {
  classes: ClassArm[];
  userEmail: string;
}

export const AttendanceTracker: React.FC<AttendanceTrackerProps> = ({ classes, userEmail }) => {
  const [selectedClass, setSelectedClass] = useState<string>(
    classes.find(c => c.name === 'JSS 1')?.name || classes[0]?.name || 'JSS 1'
  );
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [records, setRecords] = useState<any[]>([]);
  const [stats, setStats] = useState<{ total: number; present: number; absent: number; late: number; excused: number; attendanceRate: number }>({
    total: 0,
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    attendanceRate: 100
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (classes.length > 0 && !classes.some(c => c.name === selectedClass)) {
      setSelectedClass(classes.find(c => c.name === 'JSS 1')?.name || classes[0].name);
    }
  }, [classes]);

  useEffect(() => {
    loadAttendance();
  }, [selectedClass, selectedDate]);

  async function loadAttendance() {
    setLoading(true);
    try {
      const data = await api.getAttendance(selectedClass, selectedDate);
      setRecords(data.records || []);
      setStats(data.stats || { total: 0, present: 0, absent: 0, late: 0, excused: 0, attendanceRate: 100 });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load attendance' });
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkStatus(studentId: string, status: AttendanceStatus, remark = '') {
    try {
      await api.markAttendance({
        date: selectedDate,
        classArm: selectedClass,
        studentId,
        status,
        remark,
        actorEmail: userEmail
      });

      // Update in memory
      setRecords(prev =>
        prev.map(r => (r.studentId === studentId ? { ...r, status, remark } : r))
      );

      // Recalculate stats
      const updated = records.map(r => (r.studentId === studentId ? { ...r, status } : r));
      const total = updated.length;
      const present = updated.filter(r => r.status === 'present').length;
      const absent = updated.filter(r => r.status === 'absent').length;
      const late = updated.filter(r => r.status === 'late').length;
      const excused = updated.filter(r => r.status === 'excused').length;
      const attendanceRate = total > 0 ? Math.round(((present + late) / total) * 100) : 100;

      setStats({ total, present, absent, late, excused, attendanceRate });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  }

  async function handleMarkAllPresent() {
    try {
      await api.markAllAttendance({
        date: selectedDate,
        classArm: selectedClass,
        status: 'present',
        actorEmail: userEmail
      });
      setFeedback({ type: 'success', message: `Marked all pupils in ${selectedClass} as Present.` });
      loadAttendance();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  }

  const filteredRecords = records.filter(r =>
    r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.admissionNo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Top Filter and Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-[4px]">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Class Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Class:</span>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-[4px] border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#0F172A]"
            >
              {classes.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-medium rounded-[4px] border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#0F172A] font-tabular"
            />
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search pupil..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A] w-40 sm:w-48"
            />
          </div>
        </div>

        {/* Quick Bulk Action */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleMarkAllPresent}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[4px] bg-[#065F46] hover:bg-[#064E3B] text-white shadow-sm transition-colors"
          >
            <Check className="w-3.5 h-3.5 text-emerald-300" />
            <span>Mark All Present</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`p-3 rounded-[4px] text-xs flex items-center justify-between border ${
          feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-[#065F46]' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="font-bold ml-2">×</button>
        </div>
      )}

      {/* Attendance Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
        <div className="p-3 bg-white border border-slate-200 rounded-[4px] text-center">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Roster Total</span>
          <div className="text-xl font-bold text-slate-900 font-tabular mt-0.5">{stats.total}</div>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-[4px] text-center">
          <span className="text-[10px] font-semibold text-[#065F46] uppercase tracking-wider block">Present</span>
          <div className="text-xl font-bold text-[#065F46] font-tabular mt-0.5">{stats.present}</div>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-[4px] text-center">
          <span className="text-[10px] font-semibold text-[#B45309] uppercase tracking-wider block">Late</span>
          <div className="text-xl font-bold text-[#B45309] font-tabular mt-0.5">{stats.late}</div>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-[4px] text-center">
          <span className="text-[10px] font-semibold text-red-700 uppercase tracking-wider block">Absent</span>
          <div className="text-xl font-bold text-red-700 font-tabular mt-0.5">{stats.absent}</div>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-[4px] text-center">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">Excused</span>
          <div className="text-xl font-bold text-slate-700 font-tabular mt-0.5">{stats.excused}</div>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-[4px] text-center">
          <span className="text-[10px] font-semibold text-slate-700 uppercase tracking-wider block">Turnout %</span>
          <div className="text-xl font-bold text-[#065F46] font-tabular mt-0.5">{stats.attendanceRate}%</div>
        </div>
      </div>

      {/* High-Density Roll Call Table */}
      <div className="bg-white border border-slate-200 rounded-[4px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="mino-table">
            <thead>
              <tr>
                <th className="w-28">Admission No</th>
                <th className="min-w-[180px]">Pupil Name</th>
                <th className="w-20">Gender</th>
                <th className="w-72 text-center">Roll Call Status</th>
                <th>Remarks / Reason</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-400">Loading attendance register...</td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-400">No pupils found for class {selectedClass}.</td>
                </tr>
              ) : (
                filteredRecords.map((st) => (
                  <tr key={st.studentId} className={st.status === 'absent' ? 'bg-red-50/30' : ''}>
                    <td className="font-mono text-xs text-slate-700">{st.admissionNo}</td>
                    <td className="font-semibold text-slate-900">{st.studentName}</td>
                    <td className="capitalize text-slate-600">{st.gender}</td>
                    <td className="p-1 text-center">
                      <div className="inline-flex p-0.5 bg-slate-100 rounded-[3px] border border-slate-200">
                        <button
                          type="button"
                          onClick={() => handleMarkStatus(st.studentId, 'present', st.remark)}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-[2px] transition-colors ${
                            st.status === 'present'
                              ? 'bg-[#065F46] text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Present
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMarkStatus(st.studentId, 'late', st.remark)}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-[2px] transition-colors ${
                            st.status === 'late'
                              ? 'bg-[#B45309] text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Late
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMarkStatus(st.studentId, 'absent', st.remark)}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-[2px] transition-colors ${
                            st.status === 'absent'
                              ? 'bg-red-700 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Absent
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMarkStatus(st.studentId, 'excused', st.remark)}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-[2px] transition-colors ${
                            st.status === 'excused'
                              ? 'bg-slate-700 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Excused
                        </button>
                      </div>
                    </td>
                    <td>
                      <input
                        type="text"
                        defaultValue={st.remark || ''}
                        onBlur={(e) => handleMarkStatus(st.studentId, st.status, e.target.value)}
                        placeholder="Add note (e.g. sick note, transit delay)..."
                        className="w-full px-2 py-1 text-xs rounded-[2px] border border-slate-200 focus:outline-none focus:border-[#0F172A] bg-transparent"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
