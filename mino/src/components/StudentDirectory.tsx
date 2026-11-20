/**
 * MINO-SMS Pupils Directory & Bulk CSV Batch Staging Tool
 * High-density tabular layout, keyboard efficiency, soft-delete worker, and CSV batch engine.
 */

import React, { useState, useEffect } from 'react';
import { UserPlus, Upload, Search, Trash2, RotateCcw, Check, AlertCircle, FileSpreadsheet, Eye, Shield, Edit3 } from 'lucide-react';
import { api } from '../services/api';
import type { Student, ClassArm } from '../types';

interface StudentDirectoryProps {
  currentRole: string;
  userEmail: string;
  classes: ClassArm[];
  tenantName?: string;
  onSelectStudentForDetails?: (student: Student) => void;
}

export const StudentDirectory: React.FC<StudentDirectoryProps> = ({
  currentRole,
  userEmail,
  classes,
  tenantName,
  onSelectStudentForDetails
}) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);

  // Modals
  const [showEnrolModal, setShowEnrolModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Enrol Form State
  const [enrolForm, setEnrolForm] = useState({
    admissionNo: '',
    firstName: '',
    lastName: '',
    email: '',
    studentPassword: 'student123',
    gender: 'female' as 'male' | 'female' | 'other',
    classArm: classes[0]?.name || 'JSS 1',
    guardianName: '',
    guardianPhone: '',
    guardianEmail: '',
    guardianPassword: 'guardian123'
  });

  // CSV Staging State
  const [csvRawText, setCsvRawText] = useState('');
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    loadStudents();
  }, [classFilter, includeDeleted]);

  async function loadStudents() {
    setLoading(true);
    try {
      const data = await api.getStudents(classFilter, includeDeleted);
      setStudents(data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load students' });
    } finally {
      setLoading(false);
    }
  }

  async function handleEnrolSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.createStudent(enrolForm, userEmail);
      setFeedback({ type: 'success', message: `Enrolled pupil ${enrolForm.firstName} ${enrolForm.lastName} successfully.` });
      setShowEnrolModal(false);
      setEnrolForm({
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
      loadStudents();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error enrolling student' });
    }
  }

  async function handleSoftDelete(studentId: string, studentName: string) {
    if (!confirm(`Are you sure you want to soft-delete pupil: ${studentName}?`)) return;
    try {
      await api.deleteStudent(studentId, userEmail);
      setFeedback({ type: 'success', message: `Pupil ${studentName} soft-deleted. Can be restored from deleted archive.` });
      loadStudents();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  }

  async function handleRestore(studentId: string, studentName: string) {
    try {
      await api.restoreStudent(studentId, userEmail);
      setFeedback({ type: 'success', message: `Pupil ${studentName} restored to active register.` });
      loadStudents();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingStudent) return;
    try {
      await api.updateStudent(editingStudent.id, {
        admissionNo: editingStudent.admissionNo,
        firstName: editingStudent.firstName,
        lastName: editingStudent.lastName,
        email: editingStudent.email,
        studentPassword: editingStudent.studentPassword,
        gender: editingStudent.gender,
        classArm: editingStudent.classArm,
        guardianName: editingStudent.guardianName,
        guardianPhone: editingStudent.guardianPhone,
        guardianEmail: editingStudent.guardianEmail,
        guardianPassword: editingStudent.guardianPassword,
        status: editingStudent.status
      }, userEmail);
      setFeedback({ type: 'success', message: `Updated details for ${editingStudent.firstName} ${editingStudent.lastName}.` });
      setEditingStudent(null);
      loadStudents();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error updating pupil record' });
    }
  }

  // Parse CSV Staging
  function parseCsvInput(text: string) {
    setCsvRawText(text);
    const lines = text.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) {
      setParsedRows([]);
      setCsvErrors(['CSV must contain a header row and at least one data row.']);
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));
    const rows: any[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      if (cols.length < 3) {
        errors.push(`Row ${i + 1}: Insufficient columns. Minimum: admissionNo, firstName, lastName.`);
        continue;
      }

      const rowObj: any = {
        admissionNo: cols[0] || '',
        firstName: cols[1] || '',
        lastName: cols[2] || '',
        gender: cols[3] || 'other',
        classArm: cols[4] || 'JSS 1',
        guardianName: cols[5] || '',
        guardianPhone: cols[6] || '',
        guardianEmail: cols[7] || ''
      };

      if (!rowObj.admissionNo || !rowObj.firstName || !rowObj.lastName) {
        errors.push(`Row ${i + 1}: Missing required values (Admission No, First Name, Last Name).`);
      } else {
        rows.push(rowObj);
      }
    }

    setParsedRows(rows);
    setCsvErrors(errors);
  }

  async function commitCsvBatch() {
    if (parsedRows.length === 0) return;
    setImporting(true);
    try {
      const res = await api.bulkImportCsv(parsedRows, userEmail);
      setFeedback({
        type: 'success',
        message: `Successfully imported ${res.importedCount} pupils via CSV batch. (Skipped: ${res.skippedCount})`
      });
      setShowCsvModal(false);
      setCsvRawText('');
      setParsedRows([]);
      loadStudents();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'CSV batch import failed.' });
    } finally {
      setImporting(false);
    }
  }

  const [genderFilter, setGenderFilter] = useState('all');

  function exportCsv() {
    if (students.length === 0) return;
    const headers = ['AdmissionNo', 'FirstName', 'LastName', 'Gender', 'ClassArm', 'GuardianName', 'GuardianPhone', 'GuardianEmail', 'Status'];
    const rows = students.map(s => [
      `"${s.admissionNo}"`,
      `"${s.firstName}"`,
      `"${s.lastName}"`,
      `"${s.gender}"`,
      `"${s.classArm}"`,
      `"${s.guardianName || ''}"`,
      `"${s.guardianPhone || ''}"`,
      `"${s.guardianEmail || ''}"`,
      `"${s.isDeleted ? 'Archived' : 'Active'}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PUPILS_DIRECTORY_${classFilter}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const filteredStudents = students.filter(s => {
    const full = `${s.firstName} ${s.lastName} ${s.admissionNo} ${s.email || ''} ${s.guardianName} ${s.guardianEmail || ''}`.toLowerCase();
    const matchesSearch = full.includes(searchQuery.toLowerCase());
    const matchesGender = genderFilter === 'all' || s.gender === genderFilter;
    return matchesSearch && matchesGender;
  });

  return (
    <div className="space-y-4">
      {/* Top Action & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-[4px]">
        <div className="flex flex-wrap items-center gap-2">
          {/* Class Filter */}
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-medium rounded-[4px] border border-slate-300 bg-white text-slate-800 focus:outline-none focus:border-[#0F172A]"
          >
            <option value="all">All Class Arms</option>
            {classes.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>

          {/* Gender Filter */}
          <select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-medium rounded-[4px] border border-slate-300 bg-white text-slate-800 focus:outline-none focus:border-[#0F172A]"
          >
            <option value="all">All Genders</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, ID..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A] w-48 sm:w-56"
            />
          </div>

          <label className="flex items-center gap-1.5 text-xs text-slate-600 select-none cursor-pointer pl-1">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => setIncludeDeleted(e.target.checked)}
              className="rounded-[2px] border-slate-300 text-[#0F172A] focus:ring-0"
            />
            <span>Include Archived</span>
          </label>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[4px] bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 transition-colors"
            title="Download CSV"
          >
            <Upload className="w-3.5 h-3.5 rotate-180 text-slate-600" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
          {currentRole === 'admin' && (
            <>
              <button
                onClick={() => setShowCsvModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[4px] bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#B45309]" />
                <span className="hidden sm:inline">CSV Import</span>
              </button>
              <button
                onClick={() => setShowEnrolModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[4px] bg-[#0F172A] hover:bg-[#1E293B] text-white transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5 text-[#B45309]" />
                <span>Enrol Pupil</span>
              </button>
            </>
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

      {/* High-Density Pupil Roster Table */}
      <div className="bg-white border border-slate-200 rounded-[4px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="mino-table">
            <thead>
              <tr>
                <th className="w-32">Admission No</th>
                <th>Pupil Name</th>
                <th>Gender</th>
                <th>Class Arm</th>
                <th>Guardian Contact</th>
                <th>Parent Portal Token</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">Loading student directory...</td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">No pupils match the current criteria.</td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.id} className={student.isDeleted ? 'bg-slate-50 opacity-60' : ''}>
                    <td className="font-mono font-medium text-slate-900">{student.admissionNo}</td>
                    <td className="font-semibold text-slate-900">
                      <button
                        type="button"
                        onClick={() => onSelectStudentForDetails && onSelectStudentForDetails(student)}
                        className="text-left hover:text-[#B45309] hover:underline block"
                        title="Click to view full pupil dossier"
                      >
                        {student.firstName} {student.lastName}
                      </button>
                      {student.email && (
                        <div className="text-[11px] text-slate-400 font-mono font-normal">{student.email}</div>
                      )}
                    </td>
                    <td className="capitalize text-slate-600">{student.gender}</td>
                    <td>
                      <span className="font-medium text-slate-700">{student.classArm}</span>
                    </td>
                    <td className="text-slate-600">
                      <div>{student.guardianName || '—'}</div>
                      <div className="text-[11px] text-slate-400 font-tabular">{student.guardianEmail || student.guardianPhone}</div>
                    </td>
                    <td>
                      <div className="font-mono text-xs font-semibold text-slate-700">PIN: {student.accessPin}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{student.accessToken?.slice(0, 10)}...</div>
                    </td>
                    <td>
                      {student.isDeleted ? (
                        <span className="text-[11px] font-semibold text-red-700">Archived</span>
                      ) : (
                        <span className="text-[11px] font-semibold text-[#065F46] flex items-center gap-1">
                          <Check className="w-3 h-3 text-[#065F46]" /> Active
                        </span>
                      )}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      {onSelectStudentForDetails && (
                        <button
                          type="button"
                          onClick={() => onSelectStudentForDetails(student)}
                          className="px-2 py-1 text-xs font-semibold text-[#0F172A] bg-slate-100 hover:bg-slate-200 rounded-[2px] mr-1.5 inline-flex items-center gap-1"
                          title="View complete pupil dossier"
                        >
                          <Eye className="w-3 h-3 text-[#B45309]" /> Dossier
                        </button>
                      )}
                      {currentRole === 'admin' ? (
                        <>
                          <button
                            onClick={() => setEditingStudent(student)}
                            className="px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 rounded-[2px] font-medium mr-1"
                            title="Edit pupil details"
                          >
                            <Edit3 className="w-3.5 h-3.5 inline mr-1 text-slate-500" /> Edit
                          </button>
                          {student.isDeleted ? (
                            <button
                              onClick={() => handleRestore(student.id, `${student.firstName} ${student.lastName}`)}
                              className="px-2 py-1 text-xs text-[#065F46] hover:bg-emerald-50 rounded-[2px] font-medium"
                              title="Restore pupil"
                            >
                              <RotateCcw className="w-3.5 h-3.5 inline mr-1" /> Restore
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSoftDelete(student.id, `${student.firstName} ${student.lastName}`)}
                              className="px-2 py-1 text-xs text-red-700 hover:bg-red-50 rounded-[2px] font-medium"
                              title="Soft delete pupil"
                            >
                              <Trash2 className="w-3.5 h-3.5 inline mr-1" /> Archive
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">Read Only</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center font-tabular">
          <span>Showing {filteredStudents.length} enrolled pupils</span>
          <span>{tenantName || 'Institution'} Multi-Tenant Partition</span>
        </div>
      </div>

      {/* Enrol Pupil Modal */}
      {showEnrolModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-[6px] bg-white p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Enrol New Pupil</h3>
              <button onClick={() => setShowEnrolModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>

            <form onSubmit={handleEnrolSubmit} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Admission Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={enrolForm.admissionNo}
                    onChange={(e) => setEnrolForm({ ...enrolForm, admissionNo: e.target.value })}
                    placeholder="e.g. OMA/2026/012"
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Class Arm *
                  </label>
                  <select
                    value={enrolForm.classArm}
                    onChange={(e) => setEnrolForm({ ...enrolForm, classArm: e.target.value })}
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
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={enrolForm.firstName}
                    onChange={(e) => setEnrolForm({ ...enrolForm, firstName: e.target.value })}
                    placeholder="First Name"
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={enrolForm.lastName}
                    onChange={(e) => setEnrolForm({ ...enrolForm, lastName: e.target.value })}
                    placeholder="Surname"
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Gender
                </label>
                <div className="flex gap-4 text-xs text-slate-700">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      checked={enrolForm.gender === 'female'}
                      onChange={() => setEnrolForm({ ...enrolForm, gender: 'female' })}
                    />
                    <span>Female</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="gender"
                      checked={enrolForm.gender === 'male'}
                      onChange={() => setEnrolForm({ ...enrolForm, gender: 'male' })}
                    />
                    <span>Male</span>
                  </label>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">Student Portal Credentials</h4>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="email"
                    value={enrolForm.email}
                    onChange={(e) => setEnrolForm({ ...enrolForm, email: e.target.value })}
                    placeholder="Student Email (auto if blank)"
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  />
                  <input
                    type="text"
                    value={enrolForm.studentPassword}
                    onChange={(e) => setEnrolForm({ ...enrolForm, studentPassword: e.target.value })}
                    placeholder="Student Password"
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">Guardian Information & Portal Login</h4>
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={enrolForm.guardianName}
                      onChange={(e) => setEnrolForm({ ...enrolForm, guardianName: e.target.value })}
                      placeholder="Guardian Full Name"
                      className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                    />
                    <input
                      type="tel"
                      value={enrolForm.guardianPhone}
                      onChange={(e) => setEnrolForm({ ...enrolForm, guardianPhone: e.target.value })}
                      placeholder="Phone (e.g. +234...)"
                      className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="email"
                      value={enrolForm.guardianEmail}
                      onChange={(e) => setEnrolForm({ ...enrolForm, guardianEmail: e.target.value })}
                      placeholder="Guardian Login Email"
                      className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                    />
                    <input
                      type="text"
                      value={enrolForm.guardianPassword}
                      onChange={(e) => setEnrolForm({ ...enrolForm, guardianPassword: e.target.value })}
                      placeholder="Guardian Password"
                      className="w-full px-3 py-1.5 text-xs font-mono rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-semibold rounded-[4px] bg-[#0F172A] text-white hover:bg-[#1E293B]"
                >
                  Save & Enrol Pupil
                </button>
                <button
                  type="button"
                  onClick={() => setShowEnrolModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-[4px] border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Batch Staging & Import Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-[6px] bg-white p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-[#B45309]" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Bulk CSV Batch Staging & Validation</h3>
              </div>
              <button onClick={() => setShowCsvModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>

            <div className="mt-4 space-y-3.5">
              <div className="text-xs text-slate-600 leading-relaxed">
                Paste CSV data or write comma-separated records below. Minimum columns:
                <code className="ml-1 px-1.5 py-0.5 rounded-[2px] bg-slate-100 font-mono text-[11px] text-slate-800">
                  admissionNo, firstName, lastName, gender, classArm, guardianName, guardianPhone, guardianEmail
                </code>
              </div>

              <textarea
                rows={6}
                value={csvRawText}
                onChange={(e) => parseCsvInput(e.target.value)}
                placeholder={`admissionNo, firstName, lastName, gender, classArm, guardianName, guardianPhone, guardianEmail\nOMA/2026/020, Tariq, Al-Mansoor, male, JSS 1, General Mansoor, +234 809 111 4400, mansoor@example.com\nOMA/2026/021, Ngozi, Okonjo, female, SSS 1, Dr. Okonjo, +234 803 222 5500, okonjo@example.com`}
                className="w-full p-2.5 text-xs font-mono rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
              />

              {csvErrors.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-[4px] text-xs text-red-800 space-y-1">
                  <div className="font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                    Validation Notices:
                  </div>
                  {csvErrors.map((err, i) => (
                    <div key={i} className="pl-4 text-[11px]">• {err}</div>
                  ))}
                </div>
              )}

              {parsedRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span>Staged Pupils Preview ({parsedRows.length} valid records)</span>
                    <span className="text-[#065F46] flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Schema Validated
                    </span>
                  </div>
                  <div className="border border-slate-200 rounded-[4px] max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="p-2">ID</th>
                          <th className="p-2">Name</th>
                          <th className="p-2">Gender</th>
                          <th className="p-2">Class</th>
                          <th className="p-2">Guardian</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.map((r, idx) => (
                          <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="p-2">{r.admissionNo}</td>
                            <td className="p-2 font-sans font-medium">{r.firstName} {r.lastName}</td>
                            <td className="p-2">{r.gender}</td>
                            <td className="p-2">{r.classArm}</td>
                            <td className="p-2 text-slate-500 font-sans">{r.guardianName || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  disabled={importing || parsedRows.length === 0}
                  onClick={commitCsvBatch}
                  className="flex-1 py-2 text-xs font-semibold rounded-[4px] bg-[#B45309] text-white hover:bg-[#92400E] disabled:opacity-50 transition-colors"
                >
                  {importing ? 'Processing Batch...' : `Commit ${parsedRows.length} Pupils to Register`}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCsvModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-[4px] border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Pupil Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-[6px] bg-white p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Edit Pupil Details
              </h3>
              <button onClick={() => setEditingStudent(null)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Admission Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingStudent.admissionNo}
                    onChange={(e) => setEditingStudent({ ...editingStudent, admissionNo: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Class Arm *
                  </label>
                  <select
                    value={editingStudent.classArm}
                    onChange={(e) => setEditingStudent({ ...editingStudent, classArm: e.target.value })}
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
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingStudent.firstName}
                    onChange={(e) => setEditingStudent({ ...editingStudent, firstName: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingStudent.lastName}
                    onChange={(e) => setEditingStudent({ ...editingStudent, lastName: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Gender
                  </label>
                  <select
                    value={editingStudent.gender}
                    onChange={(e) => setEditingStudent({ ...editingStudent, gender: e.target.value as any })}
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  >
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Enrollment Status
                  </label>
                  <select
                    value={editingStudent.status}
                    onChange={(e) => setEditingStudent({ ...editingStudent, status: e.target.value as any })}
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="graduated">Graduated</option>
                    <option value="withdrawn">Withdrawn</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">Student Portal Credentials</h4>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="email"
                    value={editingStudent.email || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, email: e.target.value })}
                    placeholder="Student Login Email"
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  />
                  <input
                    type="text"
                    value={editingStudent.studentPassword || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, studentPassword: e.target.value })}
                    placeholder="Student Password"
                    className="w-full px-3 py-1.5 text-xs font-mono rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">Guardian Contact & Portal Login</h4>
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={editingStudent.guardianName || ''}
                      onChange={(e) => setEditingStudent({ ...editingStudent, guardianName: e.target.value })}
                      placeholder="Guardian Full Name"
                      className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                    />
                    <input
                      type="tel"
                      value={editingStudent.guardianPhone || ''}
                      onChange={(e) => setEditingStudent({ ...editingStudent, guardianPhone: e.target.value })}
                      placeholder="Phone (e.g. +234...)"
                      className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="email"
                      value={editingStudent.guardianEmail || ''}
                      onChange={(e) => setEditingStudent({ ...editingStudent, guardianEmail: e.target.value })}
                      placeholder="Guardian Login Email"
                      className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                    />
                    <input
                      type="text"
                      value={editingStudent.guardianPassword || ''}
                      onChange={(e) => setEditingStudent({ ...editingStudent, guardianPassword: e.target.value })}
                      placeholder="Guardian Password"
                      className="w-full px-3 py-1.5 text-xs font-mono rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-semibold rounded-[4px] bg-[#0F172A] text-white hover:bg-[#1E293B]"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
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
