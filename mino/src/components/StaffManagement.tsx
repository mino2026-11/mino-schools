/**
 * MINO-SMS Staff & Subject Assignment Management (Admin / Head Teacher)
 * Onboard staff, remove staff, assign subjects & class arms, appoint Head Teacher,
 * and generate/manage staff login passcodes with credentials voucher.
 */

import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  UserPlus,
  Trash2,
  Award,
  BookOpen,
  Layers,
  Phone,
  Mail,
  Check,
  AlertCircle,
  KeyRound,
  Copy,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import { api } from '../services/api';
import type { StaffUser, ClassArm, Subject, UserRole } from '../types';

interface StaffManagementProps {
  currentRole: string;
  userEmail: string;
  classes: ClassArm[];
  subjects: Subject[];
  tenantName?: string;
  schoolCode?: string;
}

export const StaffManagement: React.FC<StaffManagementProps> = ({
  currentRole,
  userEmail,
  classes,
  subjects,
  tenantName,
  schoolCode
}) => {
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState<StaffUser | null>(null);
  const [createdVoucher, setCreatedVoucher] = useState<{ name: string; email: string; role: string; passcode: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showPasscodes, setShowPasscodes] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form state
  const [staffForm, setStaffForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'teacher' as UserRole,
    passcode: 'TCH-' + Math.floor(1000 + Math.random() * 9000),
    isHeadTeacher: false,
    assignedClasses: [] as string[],
    assignedSubjects: [] as string[]
  });

  useEffect(() => {
    loadStaff();
  }, []);

  async function loadStaff() {
    setLoading(true);
    try {
      const data = await api.getStaff();
      setStaffList(data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load staff list' });
    } finally {
      setLoading(false);
    }
  }

  function generateNewPasscode() {
    const code = (staffForm.role === 'admin' ? 'ADM-' : staffForm.role === 'bursar' ? 'BUR-' : 'TCH-') +
      Math.floor(1000 + Math.random() * 9000);
    setStaffForm(prev => ({ ...prev, passcode: code }));
  }

  async function handleAddStaff(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await api.createStaff(staffForm, userEmail);
      setFeedback({ type: 'success', message: `Staff member ${staffForm.name} onboarded successfully.` });
      setShowAddModal(false);

      // Show credentials voucher modal
      setCreatedVoucher({
        name: staffForm.name,
        email: staffForm.email,
        role: staffForm.role,
        passcode: res.temporaryPasscode || staffForm.passcode
      });

      setStaffForm({
        name: '',
        email: '',
        phone: '',
        role: 'teacher',
        passcode: 'TCH-' + Math.floor(1000 + Math.random() * 9000),
        isHeadTeacher: false,
        assignedClasses: [],
        assignedSubjects: []
      });
      loadStaff();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error adding staff member' });
    }
  }

  async function handleToggleHeadTeacher(staff: StaffUser) {
    try {
      const newStatus = !staff.isHeadTeacher;
      await api.updateStaff(staff.id, { isHeadTeacher: newStatus }, userEmail);
      setFeedback({
        type: 'success',
        message: newStatus ? `Appointed ${staff.name} as Head Teacher.` : `Revoked Head Teacher designation for ${staff.name}.`
      });
      loadStaff();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  }

  async function handleRemoveStaff(staff: StaffUser) {
    if (!confirm(`Are you sure you want to remove staff member: ${staff.name}?`)) return;
    try {
      await api.deleteStaff(staff.id, userEmail);
      setFeedback({ type: 'success', message: `Staff member ${staff.name} removed from registry.` });
      loadStaff();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  }

  async function handleSaveAssignments(e: React.FormEvent) {
    e.preventDefault();
    if (!showAssignModal) return;

    try {
      await api.updateStaff(showAssignModal.id, {
        assignedClasses: showAssignModal.assignedClasses || [],
        assignedSubjects: showAssignModal.assignedSubjects || []
      }, userEmail);

      setFeedback({ type: 'success', message: `Updated teaching assignments for ${showAssignModal.name}.` });
      setShowAssignModal(null);
      loadStaff();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  }

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  }

  return (
    <div className="space-y-4">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-[4px]">
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
            Staff Directory & Login Provisioning
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Onboard faculty members, configure login passcodes, and assign teaching duties.
          </p>
        </div>
        <button
          onClick={() => {
            generateNewPasscode();
            setShowAddModal(true);
          }}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[4px] bg-[#0F172A] hover:bg-[#1E293B] text-white transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5 text-[#B45309]" />
          <span>Onboard New Staff</span>
        </button>
      </div>

      {feedback && (
        <div className={`p-3 rounded-[4px] text-xs flex items-center justify-between border ${
          feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-[#065F46]' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="font-bold ml-2">✕</button>
        </div>
      )}

      {/* Staff Roster Table */}
      <div className="bg-white border border-slate-200 rounded-[4px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="mino-table">
            <thead>
              <tr>
                <th>Staff Name</th>
                <th>Role</th>
                <th>Head Teacher Status</th>
                <th>Login Passcode</th>
                <th>Assigned Class Arms</th>
                <th>Assigned Subjects</th>
                <th>Contact</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">Loading staff directory...</td>
                </tr>
              ) : staffList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">No staff members enrolled yet.</td>
                </tr>
              ) : (
                staffList.map((staff) => {
                  const isVisible = showPasscodes[staff.id];
                  const code = staff.passcode || 'teach123';
                  return (
                    <tr key={staff.id}>
                      <td>
                        <div className="font-semibold text-slate-900">{staff.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{staff.email}</div>
                      </td>
                      <td>
                        <span className="capitalize font-medium text-slate-700">{staff.role}</span>
                      </td>
                      <td>
                        {staff.isHeadTeacher ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-amber-100 text-[#B45309] font-bold text-[11px]">
                            <Award className="w-3.5 h-3.5 text-[#B45309]" /> Head Teacher
                          </span>
                        ) : (
                          <button
                            onClick={() => handleToggleHeadTeacher(staff)}
                            className="text-[11px] text-slate-500 hover:text-slate-900 hover:underline"
                          >
                            Appoint Head Teacher
                          </button>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          <span className="font-bold text-slate-800">
                            {isVisible ? code : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowPasscodes(prev => ({ ...prev, [staff.id]: !prev[staff.id] }))}
                            className="text-slate-400 hover:text-slate-700 p-0.5"
                            title={isVisible ? 'Hide passcode' : 'Show passcode'}
                          >
                            {isVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyText(code, `code_${staff.id}`)}
                            className="text-slate-400 hover:text-slate-700 p-0.5"
                            title="Copy login passcode"
                          >
                            {copiedKey === `code_${staff.id}` ? <Check className="w-3 h-3 text-[#065F46]" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </td>
                      <td>
                        {staff.assignedClasses && staff.assignedClasses.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {staff.assignedClasses.map((c, i) => (
                              <span key={i} className="px-1.5 py-0.2 rounded-[2px] bg-slate-100 text-slate-700 text-[10px] font-medium">
                                {c}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td>
                        {staff.assignedSubjects && staff.assignedSubjects.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {staff.assignedSubjects.map((subId, i) => {
                              const sub = subjects.find(s => s.id === subId);
                              return (
                                <span key={i} className="px-1.5 py-0.2 rounded-[2px] bg-emerald-50 text-[#065F46] border border-emerald-200 text-[10px] font-medium">
                                  {sub ? sub.name : subId}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="text-xs text-slate-600 font-tabular">{staff.phone || '—'}</td>
                      <td className="text-right whitespace-nowrap">
                        <button
                          onClick={() => setShowAssignModal(staff)}
                          className="px-2.5 py-1 text-xs font-semibold text-[#0F172A] bg-slate-100 hover:bg-slate-200 rounded-[2px] mr-1.5"
                        >
                          Assign Duties
                        </button>
                        <button
                          onClick={() => handleRemoveStaff(staff)}
                          className="p-1 text-red-700 hover:bg-red-50 rounded-[2px]"
                          title="Remove staff member"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Onboard Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-[6px] bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Onboard Staff & Create Login Credentials
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>

            <form onSubmit={handleAddStaff} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={staffForm.name}
                  onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                  placeholder="e.g. Mr. Adebayo Ogunlesi"
                  className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={staffForm.email}
                    onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                    placeholder="email@school.edu"
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Role *
                  </label>
                  <select
                    value={staffForm.role}
                    onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value as any })}
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  >
                    <option value="teacher">Class Teacher</option>
                    <option value="admin">Administrator</option>
                    <option value="bursar">Bursar / Finance</option>
                  </select>
                </div>
              </div>

              {/* Login Passcode Configuration */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
                    Staff Login Passcode *
                  </label>
                  <button
                    type="button"
                    onClick={generateNewPasscode}
                    className="text-[11px] text-[#B45309] font-semibold hover:underline inline-flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Auto-Generate
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={staffForm.passcode}
                  onChange={(e) => setStaffForm({ ...staffForm, passcode: e.target.value })}
                  placeholder="e.g. TCH-8492"
                  className="w-full px-3 py-1.5 text-xs font-mono font-bold tracking-wider rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={staffForm.phone}
                  onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                  placeholder="+234..."
                  className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={staffForm.isHeadTeacher}
                  onChange={(e) => setStaffForm({ ...staffForm, isHeadTeacher: e.target.checked })}
                  className="rounded-[2px] border-slate-300 text-[#B45309]"
                />
                <span>Designate as Head Teacher</span>
              </label>

              <div className="pt-3 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-semibold rounded-[4px] bg-[#0F172A] text-white hover:bg-[#1E293B]"
                >
                  Onboard & Issue Passcode
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-[4px] border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Post-Onboarding Credentials Voucher Modal */}
      {createdVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-[6px] bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#065F46]" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Staff Login Credentials Issued
                </h3>
              </div>
              <button onClick={() => setCreatedVoucher(null)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>

            <div className="mt-4 p-4 rounded-[4px] bg-slate-50 border border-slate-200 space-y-3 font-mono text-xs">
              <div>
                <span className="text-[10px] uppercase text-slate-400 font-sans font-semibold block">Staff Member</span>
                <span className="font-bold text-slate-900 font-sans text-sm">{createdVoucher.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-sans font-semibold block">Role</span>
                  <span className="capitalize text-slate-800">{createdVoucher.role}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-sans font-semibold block">Portal Access</span>
                  <span className="text-[#065F46] font-bold">Teacher Door</span>
                </div>
              </div>
              {schoolCode && (
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-[10px] uppercase text-slate-400 font-sans font-semibold block">School Code</span>
                  <span className="text-slate-900 font-bold tracking-wider">{schoolCode}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200">
                <span className="text-[10px] uppercase text-slate-400 font-sans font-semibold block">Login Email</span>
                <span className="text-slate-800 font-bold">{createdVoucher.email}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-400 font-sans font-semibold block">Password</span>
                <span className="text-[#B45309] font-bold text-base tracking-widest">{createdVoucher.passcode}</span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => copyText(
                  `${tenantName || 'School'} - Staff Login Credentials\nName: ${createdVoucher.name}\nRole: ${createdVoucher.role}${schoolCode ? `\nSchool Code: ${schoolCode}` : ''}\nEmail: ${createdVoucher.email}\nPassword: ${createdVoucher.passcode}`,
                  'voucher'
                )}
                className="flex-1 py-2 text-xs font-semibold rounded-[4px] bg-[#0F172A] hover:bg-[#1E293B] text-white flex items-center justify-center gap-1.5"
              >
                {copiedKey === 'voucher' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'voucher' ? 'Credentials Copied!' : 'Copy Staff Credentials'}</span>
              </button>
              <button
                type="button"
                onClick={() => setCreatedVoucher(null)}
                className="px-4 py-2 text-xs font-medium rounded-[4px] border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Duties Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-[6px] bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Assign Duties: {showAssignModal.name}
                </h3>
                <p className="text-xs text-slate-500 font-medium">Select authorized Class Arms and Teaching Subjects</p>
              </div>
              <button onClick={() => setShowAssignModal(null)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>

            <form onSubmit={handleSaveAssignments} className="mt-4 space-y-4">
              {/* Class Arms Assignment */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Authorized Class Arms
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs max-h-36 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-[4px]">
                  {classes.map(c => {
                    const isChecked = showAssignModal.assignedClasses?.includes(c.name);
                    return (
                      <label key={c.id} className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-white">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const current = showAssignModal.assignedClasses || [];
                            const updated = e.target.checked
                              ? [...current, c.name]
                              : current.filter(x => x !== c.name);
                            setShowAssignModal({ ...showAssignModal, assignedClasses: updated });
                          }}
                          className="rounded-[2px] text-[#0F172A]"
                        />
                        <span className="font-medium text-slate-800">{c.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Subjects Assignment */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Authorized Subjects
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs max-h-36 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-[4px]">
                  {subjects.map(s => {
                    const isChecked = showAssignModal.assignedSubjects?.includes(s.id);
                    return (
                      <label key={s.id} className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-white">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const current = showAssignModal.assignedSubjects || [];
                            const updated = e.target.checked
                              ? [...current, s.id]
                              : current.filter(x => x !== s.id);
                            setShowAssignModal({ ...showAssignModal, assignedSubjects: updated });
                          }}
                          className="rounded-[2px] text-[#065F46]"
                        />
                        <span className="font-medium text-slate-800">{s.name} ({s.code})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-semibold rounded-[4px] bg-[#0F172A] text-white hover:bg-[#1E293B]"
                >
                  Save Duty Assignments
                </button>
                <button
                  type="button"
                  onClick={() => setShowAssignModal(null)}
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
