/**
 * MINO-SMS Classes & Timetable Schedule Component
 * Class arms registry, student counts, assigned class teachers,
 * and comprehensive weekly period schedule matrix (Mon-Fri) with full CRUD.
 */

import React, { useState, useEffect } from 'react';
import {
  Layers,
  Calendar,
  Clock,
  BookOpen,
  User,
  MapPin,
  ChevronRight,
  PlusCircle,
  Trash2,
  Check,
  X,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import { NIGERIAN_CLASS_LEVELS } from '../types';
import type { ClassArm, Subject, StaffUser } from '../types';

interface ClassesTimetableProps {
  classes: ClassArm[];
  subjects: Subject[];
  staff: StaffUser[];
  currentRole?: string;
  userEmail?: string;
  onRefreshClasses?: () => void;
}

export const ClassesTimetable: React.FC<ClassesTimetableProps> = ({
  classes,
  subjects,
  staff,
  currentRole = 'admin',
  userEmail = 'admin@school.edu',
  onRefreshClasses
}) => {
  const [selectedClass, setSelectedClass] = useState<string>(classes[0]?.name || 'Primary 1');
  const [selectedDay, setSelectedDay] = useState<'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday'>('Monday');
  const [scheduleData, setScheduleData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Add Class Modal
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [newClassForm, setNewClassForm] = useState<{
    name: string;
    level: string;
    classTeacherId: string;
  }>({
    name: NIGERIAN_CLASS_LEVELS[0].name,
    level: NIGERIAN_CLASS_LEVELS[0].level,
    classTeacherId: ''
  });

  // Add Period Modal
  const [showAddPeriodModal, setShowAddPeriodModal] = useState(false);
  const [newPeriodForm, setNewPeriodForm] = useState({
    period: 1,
    time: '08:00 - 08:45',
    subject: subjects[0]?.name || 'Mathematics',
    teacher: staff[0]?.name || 'Faculty Member',
    room: 'Room 101'
  });

  useEffect(() => {
    if (classes.length > 0 && !classes.some(c => c.name === selectedClass)) {
      setSelectedClass(classes[0].name);
    }
  }, [classes]);

  useEffect(() => {
    loadSchedule();
  }, [selectedClass]);

  async function loadSchedule() {
    setLoading(true);
    try {
      const data = await api.getTimetable(selectedClass);
      setScheduleData(data.schedule || []);
    } catch (e) {
      console.warn('Error loading timetable', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddClassSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.createClass(newClassForm, userEmail);
      setFeedback({ type: 'success', message: `Class "${newClassForm.name}" added successfully.` });
      setShowAddClassModal(false);
      setNewClassForm({
        name: NIGERIAN_CLASS_LEVELS[0].name,
        level: NIGERIAN_CLASS_LEVELS[0].level,
        classTeacherId: ''
      });
      if (onRefreshClasses) onRefreshClasses();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to add class' });
    }
  }

  async function handleAddPeriodSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.saveTimetablePeriod({
        classArm: selectedClass,
        day: selectedDay,
        period: Number(newPeriodForm.period),
        time: newPeriodForm.time,
        subject: newPeriodForm.subject,
        teacher: newPeriodForm.teacher,
        room: newPeriodForm.room
      });
      setFeedback({ type: 'success', message: `Period ${newPeriodForm.period} scheduled for ${selectedDay}.` });
      setShowAddPeriodModal(false);
      loadSchedule();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to schedule period' });
    }
  }

  async function handleDeletePeriod(periodNum: number) {
    if (!confirm(`Delete period ${periodNum} from ${selectedDay}?`)) return;
    try {
      await api.deleteTimetablePeriod(selectedClass, selectedDay, periodNum);
      setFeedback({ type: 'success', message: `Period ${periodNum} removed from ${selectedDay}.` });
      loadSchedule();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  }

  const days: Array<'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday'> = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'
  ];

  const currentDaySchedule = scheduleData.find(d => d.day === selectedDay) || scheduleData[0];

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="bg-white border border-slate-200 rounded-[4px] p-4 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#B45309]" />
            <span>Class Arms & Weekly Master Timetable</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Class syllabus allocations, teacher room schedules, and period timetable.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase">Class:</span>
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
          {currentRole === 'admin' && (
            <button
              onClick={() => {
                const firstMissing = NIGERIAN_CLASS_LEVELS.find(
                  item => !classes.some(c => c.name.toLowerCase() === item.name.toLowerCase())
                ) || NIGERIAN_CLASS_LEVELS[0];
                setNewClassForm({
                  name: firstMissing.name,
                  level: firstMissing.level,
                  classTeacherId: ''
                });
                setShowAddClassModal(true);
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-[4px] bg-[#0F172A] hover:bg-[#1E293B] text-white transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Add Class</span>
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className={`p-3 rounded-[4px] text-xs flex items-center justify-between border ${
          feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-[#065F46]' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="font-bold ml-2">✕</button>
        </div>
      )}

      {/* Class Arm Info Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {classes.map((cls) => {
          const isCurrent = cls.name === selectedClass;
          // Look up assigned class teacher dynamically
          const assignedTeacher = staff.find(s => s.assignedClasses?.includes(cls.name));
          const teacherName = assignedTeacher ? assignedTeacher.name : 'Unassigned';

          return (
            <div
              key={cls.id}
              onClick={() => setSelectedClass(cls.name)}
              className={`p-3.5 rounded-[4px] border transition-all cursor-pointer ${
                isCurrent
                  ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                  : 'bg-white border-slate-200 hover:border-slate-300 text-slate-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-mono uppercase px-1.5 py-0.2 rounded-[2px] font-semibold ${
                  isCurrent ? 'bg-slate-800 text-amber-400' : 'bg-slate-100 text-slate-600'
                }`}>
                  {cls.level}
                </span>
                <span className={`text-xs font-bold font-tabular ${isCurrent ? 'text-slate-300' : 'text-slate-500'}`}>
                  Capacity: 35
                </span>
              </div>
              <h3 className="text-base font-bold mt-2">
                {cls.name}
              </h3>
              <div className={`text-xs mt-1.5 pt-1.5 border-t ${
                isCurrent ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-500'
              } flex justify-between items-center`}>
                <span>Class Teacher:</span>
                <span className={isCurrent ? 'text-white font-medium' : 'text-slate-800 font-medium'}>
                  {teacherName}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Weekly Timetable Schedule Matrix */}
      <div className="bg-white border border-slate-200 rounded-[4px] p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Weekly Routine Schedule: <span className="text-[#065F46] font-bold">{selectedClass}</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Select a weekday to inspect scheduled periods, designated instructors, and room allocations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Weekday Switcher Tabs */}
            <div className="flex p-0.5 bg-slate-100 rounded-[4px] border border-slate-200">
              {days.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDay(d)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-[3px] transition-colors ${
                    selectedDay === d
                      ? 'bg-[#0F172A] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {d.slice(0, 3)}
                </button>
              ))}
            </div>

            {/* Add Period Button */}
            {(currentRole === 'admin' || currentRole === 'teacher') && (
              <button
                onClick={() => setShowAddPeriodModal(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-[3px] bg-[#065F46] hover:bg-[#064E3B] text-white transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5 text-emerald-200" />
                <span>+ Period</span>
              </button>
            )}
          </div>
        </div>

        {/* Periods Grid */}
        {loading ? (
          <div className="text-center py-10 text-slate-400 text-xs">Loading class timetable...</div>
        ) : !currentDaySchedule || !currentDaySchedule.periods || currentDaySchedule.periods.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs">No periods scheduled for this day. Click "+ Period" to assign.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {currentDaySchedule.periods.map((period: any) => (
              <div
                key={period.period}
                className="p-3.5 border border-slate-200 rounded-[4px] bg-slate-50/60 hover:bg-slate-50 transition-colors space-y-2 relative group"
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                  <span className="text-[10px] font-bold uppercase font-mono px-1.5 py-0.2 rounded-[2px] bg-slate-200 text-slate-800">
                    Period {period.period}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600 font-tabular flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#B45309]" />
                      {period.time}
                    </span>
                    {(currentRole === 'admin' || currentRole === 'teacher') && (
                      <button
                        onClick={() => handleDeletePeriod(period.period)}
                        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity p-0.5"
                        title="Delete period"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {period.subject}
                  </h4>
                  <div className="mt-1 space-y-1 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{period.teacher}</span>
                    </div>
                    {period.room && (
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                        <MapPin className="w-3.5 h-3.5 text-[#065F46]" />
                        <span>{period.room}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Class Modal */}
      {showAddClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-[6px] bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Add Nigerian School Class
              </h3>
              <button onClick={() => setShowAddClassModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>
            <form onSubmit={handleAddClassSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Class *
                </label>
                <select
                  required
                  value={newClassForm.name}
                  onChange={(e) => {
                    const chosenName = e.target.value;
                    const matched = NIGERIAN_CLASS_LEVELS.find(item => item.name === chosenName);
                    setNewClassForm({
                      ...newClassForm,
                      name: chosenName,
                      level: matched ? matched.level : newClassForm.level
                    });
                  }}
                  className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                >
                  {NIGERIAN_CLASS_LEVELS.map(clsItem => (
                    <option key={clsItem.name} value={clsItem.name}>
                      {clsItem.name} ({clsItem.level})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Educational Level *
                </label>
                <select
                  value={newClassForm.level}
                  onChange={(e) => setNewClassForm({ ...newClassForm, level: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                >
                  <option value="Primary">Primary (Primary 1 – 6)</option>
                  <option value="Junior Secondary">Junior Secondary (JSS 1 – 3)</option>
                  <option value="Senior Secondary">Senior Secondary (SSS 1 – 3)</option>
                </select>
              </div>
              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-semibold rounded-[4px] bg-[#0F172A] text-white hover:bg-[#1E293B]"
                >
                  Add Class
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddClassModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-[4px] border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Timetable Period Modal */}
      {showAddPeriodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-[6px] bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Schedule Period ({selectedDay})
                </h3>
                <span className="text-xs text-slate-500 font-medium">{selectedClass}</span>
              </div>
              <button onClick={() => setShowAddPeriodModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>
            <form onSubmit={handleAddPeriodSubmit} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Period Number *
                  </label>
                  <select
                    value={newPeriodForm.period}
                    onChange={(e) => setNewPeriodForm({ ...newPeriodForm, period: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                      <option key={n} value={n}>Period {n}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Time Span *
                  </label>
                  <input
                    type="text"
                    required
                    value={newPeriodForm.time}
                    onChange={(e) => setNewPeriodForm({ ...newPeriodForm, time: e.target.value })}
                    placeholder="08:00 - 08:45"
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A] font-tabular"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Subject *
                </label>
                <select
                  value={newPeriodForm.subject}
                  onChange={(e) => setNewPeriodForm({ ...newPeriodForm, subject: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                >
                  {subjects.map(s => (
                    <option key={s.id} value={s.name}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Assigned Teacher *
                  </label>
                  <select
                    value={newPeriodForm.teacher}
                    onChange={(e) => setNewPeriodForm({ ...newPeriodForm, teacher: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  >
                    {staff.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Classroom / Lab
                  </label>
                  <input
                    type="text"
                    value={newPeriodForm.room}
                    onChange={(e) => setNewPeriodForm({ ...newPeriodForm, room: e.target.value })}
                    placeholder="e.g. Room 101"
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  />
                </div>
              </div>
              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-semibold rounded-[4px] bg-[#065F46] text-white hover:bg-[#064E3B]"
                >
                  Save Schedule Period
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddPeriodModal(false)}
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
};
