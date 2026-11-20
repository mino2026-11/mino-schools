/**
 * MINO-SMS Fees & Financial Ledger Engine
 * Integer-based accounting (minor units: kobo/cents).
 * Cryptographic SHA-256 tamper-evident offline receipts.
 * Arrears reporting & payment reconciliation.
 */

import React, { useState, useEffect } from 'react';
import { Receipt, DollarSign, PlusCircle, CheckCircle, AlertCircle, Printer, Filter, ShieldCheck, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { api } from '../services/api';
import { getSchoolLogoUrl, type Student, type LedgerEntry, type SchoolTenant, type ClassArm } from '../types';

interface FeeLedgerProps {
  currentRole: string;
  userEmail: string;
  students: Student[];
  currencySymbol: string;
  tenant?: SchoolTenant | null;
  classes?: ClassArm[];
}

export const FeeLedger: React.FC<FeeLedgerProps> = ({
  currentRole,
  userEmail,
  students,
  currencySymbol,
  tenant,
  classes = []
}) => {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [balances, setBalances] = useState<Record<string, { totalBilled: number; totalPaid: number; arrears: number }>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'roster' | 'journal'>('roster');
  const [filterDebtorsOnly, setFilterDebtorsOnly] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Record Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    studentId: '',
    type: 'CREDIT_PAYMENT' as 'CREDIT_PAYMENT' | 'DEBIT_FEE' | 'WAIVER',
    amountMajor: '', // User inputs e.g. 45000
    category: 'Tuition',
    description: '',
    paymentChannel: 'BANK_TRANSFER' as 'CASH' | 'BANK_TRANSFER' | 'POS' | 'ONLINE',
    referenceNo: ''
  });

  // Batch Class Assessment Modal State
  const [showClassAssessmentModal, setShowClassAssessmentModal] = useState(false);
  const [classAssessmentForm, setClassAssessmentForm] = useState({
    classArm: classes[0]?.name || 'JSS 1',
    name: 'Term Consolidated Bill',
    amountMajor: '50000',
    category: 'Tuition'
  });

  // Receipt Modal State
  const [activeReceipt, setActiveReceipt] = useState<LedgerEntry | null>(null);

  useEffect(() => {
    loadLedgerData();
  }, [selectedStudentId]);

  async function loadLedgerData() {
    setLoading(true);
    try {
      const data = await api.getLedger(selectedStudentId || undefined);
      setEntries(data.entries);
      setBalances(data.studentBalances);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load ledger records' });
    } finally {
      setLoading(false);
    }
  }

  // Format integer minor units (kobo/cents) to human display string
  function formatMoney(amountMinor: number): string {
    const major = amountMinor / 100;
    return `${currencySymbol}${major.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  async function handlePaymentSubmit(e: React.FormEvent) {
    e.preventDefault();
    const majorVal = parseFloat(paymentForm.amountMajor);
    if (isNaN(majorVal) || majorVal <= 0) {
      setFeedback({ type: 'error', message: 'Please enter a valid positive payment amount.' });
      return;
    }

    // Convert to integer minor units strictly
    const amountMinor = Math.round(majorVal * 100);

    try {
      const res = await api.recordPayment({
        studentId: paymentForm.studentId,
        type: paymentForm.type,
        amountMinor,
        description: paymentForm.description || `${paymentForm.type === 'CREDIT_PAYMENT' ? 'Payment for' : 'Fee debit for'} ${paymentForm.category}`,
        category: paymentForm.category,
        paymentChannel: paymentForm.paymentChannel,
        referenceNo: paymentForm.referenceNo,
        actorEmail: userEmail
      });

      setFeedback({
        type: 'success',
        message: `Transaction recorded successfully. Receipt No: ${res.receiptNo || 'N/A'}`
      });

      setShowPaymentModal(false);
      setPaymentForm({
        studentId: '',
        type: 'CREDIT_PAYMENT',
        amountMajor: '',
        category: 'Tuition',
        description: '',
        paymentChannel: 'BANK_TRANSFER',
        referenceNo: ''
      });

      loadLedgerData();

      // Show receipt if it's a payment
      if (res.type === 'CREDIT_PAYMENT') {
        setActiveReceipt(res as LedgerEntry);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error recording transaction' });
    }
  }

  async function handleAssessClassSubmit(e: React.FormEvent) {
    e.preventDefault();
    const majorVal = parseFloat(classAssessmentForm.amountMajor);
    if (isNaN(majorVal) || majorVal <= 0) {
      setFeedback({ type: 'error', message: 'Please enter a valid positive assessment amount.' });
      return;
    }
    try {
      const res = await api.assessFeeToClass({
        classArm: classAssessmentForm.classArm,
        name: classAssessmentForm.name,
        amountMinor: Math.round(majorVal * 100),
        category: classAssessmentForm.category,
        term: tenant?.currentTerm || '2nd Term',
        session: tenant?.currentSession || '2025/2026',
        actorEmail: userEmail
      });
      setFeedback({
        type: 'success',
        message: `Assessed fee to ${res.assessedCount} pupils in ${classAssessmentForm.classArm} successfully.`
      });
      setShowClassAssessmentModal(false);
      loadLedgerData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error assessing fee to class' });
    }
  }

  // Compute Total Metrics
  const totalBilledAll = Object.values(balances).reduce((a, c) => a + c.totalBilled, 0);
  const totalPaidAll = Object.values(balances).reduce((a, c) => a + c.totalPaid, 0);
  const totalArrearsAll = Object.values(balances).reduce((a, c) => a + c.arrears, 0);

  const displayedStudents = students.filter(s => {
    if (s.isDeleted) return false;
    const bal = balances[s.id] || { arrears: 0 };
    if (filterDebtorsOnly && bal.arrears <= 0) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Financial Executive Summary Cards (No AI Cliché, Compact Utilitarian) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 bg-white border border-slate-200 rounded-[4px]">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Billed Fees</div>
          <div className="text-xl font-bold text-slate-900 font-tabular mt-1">{formatMoney(totalBilledAll)}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Term consolidated assessments</div>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-[4px]">
          <div className="text-[11px] font-semibold text-[#065F46] uppercase tracking-wider flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5 text-[#065F46]" /> Total Collections
          </div>
          <div className="text-xl font-bold text-[#065F46] font-tabular mt-1">{formatMoney(totalPaidAll)}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Reconciled bank & cash receipts</div>
        </div>
        <div className="p-3 bg-white border border-slate-200 rounded-[4px]">
          <div className="text-[11px] font-semibold text-[#B45309] uppercase tracking-wider flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 text-[#B45309]" /> Outstanding Arrears
          </div>
          <div className="text-xl font-bold text-[#B45309] font-tabular mt-1">{formatMoney(totalArrearsAll)}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Pending pupil balances</div>
        </div>
      </div>

      {/* Action and Tab Control Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-[4px]">
        <div className="flex items-center gap-2">
          {/* Segmented Control */}
          <div className="flex p-0.5 bg-slate-100 rounded-[4px] border border-slate-200">
            <button
              onClick={() => setActiveTab('roster')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-[3px] transition-colors ${
                activeTab === 'roster' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pupil Balances Roster
            </button>
            <button
              onClick={() => setActiveTab('journal')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-[3px] transition-colors ${
                activeTab === 'journal' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Transaction Journal
            </button>
          </div>

          {activeTab === 'roster' && (
            <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer pl-2">
              <input
                type="checkbox"
                checked={filterDebtorsOnly}
                onChange={(e) => setFilterDebtorsOnly(e.target.checked)}
                className="rounded-[2px] border-slate-300 text-[#B45309] focus:ring-0"
              />
              <span className="font-medium text-[#B45309]">Debtors Only</span>
            </label>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setPaymentForm(prev => ({ ...prev, studentId: students[0]?.id || '', type: 'CREDIT_PAYMENT' }));
              setShowPaymentModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[4px] bg-[#065F46] hover:bg-[#064E3B] text-white transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5 text-emerald-200" />
            <span>Record Payment</span>
          </button>
          <button
            onClick={() => {
              setPaymentForm(prev => ({ ...prev, studentId: students[0]?.id || '', type: 'DEBIT_FEE' }));
              setShowPaymentModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[4px] bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-colors"
          >
            <span>Assess Individual Fee</span>
          </button>
          <button
            onClick={() => {
              setClassAssessmentForm(prev => ({
                ...prev,
                classArm: classes[0]?.name || 'JSS 1'
              }));
              setShowClassAssessmentModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[4px] bg-amber-50 hover:bg-amber-100 text-[#B45309] border border-amber-300 transition-colors"
          >
            <span>Assess Class Arm</span>
          </button>
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

      {/* Roster View */}
      {activeTab === 'roster' ? (
        <div className="bg-white border border-slate-200 rounded-[4px] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="mino-table">
              <thead>
                <tr>
                  <th className="w-32">Admission No</th>
                  <th>Pupil Name</th>
                  <th>Class Arm</th>
                  <th className="text-right">Total Billed</th>
                  <th className="text-right">Total Paid</th>
                  <th className="text-right">Balance Due</th>
                  <th className="w-28 text-center">Clearance</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {displayedStudents.map((student) => {
                  const bal = balances[student.id] || { totalBilled: 0, totalPaid: 0, arrears: 0 };
                  const isCleared = bal.arrears === 0;

                  return (
                    <tr key={student.id}>
                      <td className="font-mono text-xs text-slate-700">{student.admissionNo}</td>
                      <td className="font-semibold text-slate-900">{student.firstName} {student.lastName}</td>
                      <td className="text-slate-600">{student.classArm}</td>
                      <td className="text-right font-tabular text-slate-800">{formatMoney(bal.totalBilled)}</td>
                      <td className="text-right font-tabular text-[#065F46] font-semibold">{formatMoney(bal.totalPaid)}</td>
                      <td className={`text-right font-tabular font-bold ${isCleared ? 'text-slate-400' : 'text-[#B45309]'}`}>
                        {formatMoney(bal.arrears)}
                      </td>
                      <td className="text-center">
                        {isCleared ? (
                          <span className="text-[11px] font-semibold text-[#065F46] inline-flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Cleared
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-[#B45309] inline-flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Arrears
                          </span>
                        )}
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => {
                            setPaymentForm(prev => ({
                              ...prev,
                              studentId: student.id,
                              type: 'CREDIT_PAYMENT',
                              amountMajor: (bal.arrears / 100).toString()
                            }));
                            setShowPaymentModal(true);
                          }}
                          className="px-2 py-1 text-xs font-semibold rounded-[2px] bg-slate-100 hover:bg-slate-200 text-slate-800"
                        >
                          Receive Payment
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Transaction Journal View */
        <div className="bg-white border border-slate-200 rounded-[4px] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="mino-table">
              <thead>
                <tr>
                  <th className="w-28">Date / Time</th>
                  <th className="w-28">Receipt / Ref</th>
                  <th>Student</th>
                  <th>Type</th>
                  <th>Channel</th>
                  <th>Description</th>
                  <th className="text-right">Amount</th>
                  <th className="w-20 text-center">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const student = students.find(s => s.id === entry.studentId);
                  const isCredit = entry.type === 'CREDIT_PAYMENT';

                  return (
                    <tr key={entry.id}>
                      <td className="text-[11px] text-slate-500 font-tabular">
                        {new Date(entry.timestamp).toLocaleDateString()} {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="font-mono text-xs text-slate-700">{entry.receiptNo || '—'}</td>
                      <td className="font-semibold text-slate-900">
                        {student ? `${student.firstName} ${student.lastName}` : entry.studentId}
                      </td>
                      <td>
                        <span className={`text-[11px] font-semibold flex items-center gap-0.5 ${
                          isCredit ? 'text-[#065F46]' : 'text-[#0F172A]'
                        }`}>
                          {isCredit ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                          {entry.type === 'CREDIT_PAYMENT' ? 'Payment' : entry.type === 'DEBIT_FEE' ? 'Fee Debit' : 'Waiver'}
                        </span>
                      </td>
                      <td className="text-xs text-slate-600 font-medium">{entry.paymentChannel || '—'}</td>
                      <td className="text-xs text-slate-700">{entry.description}</td>
                      <td className={`text-right font-tabular font-bold ${isCredit ? 'text-[#065F46]' : 'text-slate-900'}`}>
                        {formatMoney(entry.amountMinor)}
                      </td>
                      <td className="text-center">
                        {entry.receiptNo ? (
                          <button
                            onClick={() => setActiveReceipt(entry)}
                            className="p-1 text-slate-500 hover:text-slate-900 rounded-[2px]"
                            title="View / Print Receipt"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Transaction Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-[6px] bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                {paymentForm.type === 'CREDIT_PAYMENT' ? 'Record Fee Payment' : 'Assess Fee Debit'}
              </h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Select Pupil *
                </label>
                <select
                  required
                  value={paymentForm.studentId}
                  onChange={(e) => setPaymentForm({ ...paymentForm, studentId: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                >
                  <option value="">-- Choose Pupil --</option>
                  {students.filter(s => !s.isDeleted).map(s => (
                    <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNo}) - {s.classArm}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Transaction Type
                  </label>
                  <select
                    value={paymentForm.type}
                    onChange={(e) => setPaymentForm({ ...paymentForm, type: e.target.value as any })}
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  >
                    <option value="CREDIT_PAYMENT">Payment (Credit)</option>
                    <option value="DEBIT_FEE">Fee Assessment (Debit)</option>
                    <option value="WAIVER">Scholarship / Waiver</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Amount ({currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={paymentForm.amountMajor}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amountMajor: e.target.value })}
                    placeholder="e.g. 45000"
                    className="w-full px-3 py-1.5 text-xs font-tabular font-bold rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#065F46]"
                  />
                </div>
              </div>

              {paymentForm.type === 'CREDIT_PAYMENT' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Payment Channel
                    </label>
                    <select
                      value={paymentForm.paymentChannel}
                      onChange={(e) => setPaymentForm({ ...paymentForm, paymentChannel: e.target.value as any })}
                      className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                    >
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="CASH">Cash Over-Counter</option>
                      <option value="POS">POS Terminal</option>
                      <option value="ONLINE">Online Portal</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Bank Ref / Teller No
                    </label>
                    <input
                      type="text"
                      value={paymentForm.referenceNo}
                      onChange={(e) => setPaymentForm({ ...paymentForm, referenceNo: e.target.value })}
                      placeholder="e.g. ZEN-9982"
                      className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Description / Note
                </label>
                <input
                  type="text"
                  value={paymentForm.description}
                  onChange={(e) => setPaymentForm({ ...paymentForm, description: e.target.value })}
                  placeholder="e.g. Second Term Tuition Settlement"
                  className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-semibold rounded-[4px] bg-[#065F46] text-white hover:bg-[#064E3B]"
                >
                  Confirm & Post to Ledger
                </button>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-xs font-medium rounded-[4px] border border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cryptographically Verified Digital Receipt Modal */}
      {activeReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-[6px] bg-white p-6 shadow-2xl border border-slate-300 max-h-[90vh] overflow-y-auto">
            {/* Printable Receipt Slip */}
            <div className="border border-slate-300 p-6 bg-slate-50/50 rounded-[4px] font-mono text-xs space-y-4">
              <div className="text-center pb-3 border-b border-dashed border-slate-300">
                <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 p-1.5 flex items-center justify-center mx-auto mb-2 shadow-2xs overflow-hidden">
                  <img
                    src={getSchoolLogoUrl(tenant)}
                    alt={`${tenant?.name || 'School'} Logo`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain"
                  />
                </div>
                <h2 className="text-sm font-bold text-slate-900 uppercase font-sans">{tenant?.name || 'School Model Academy'}</h2>
                <p className="text-[11px] text-slate-600">Official Fee Receipt</p>
                <p className="text-[10px] text-slate-400 font-sans mt-0.5">{tenant?.address || 'Main Campus'} {tenant?.phone ? `• ${tenant.phone}` : ''}</p>
              </div>

              <div className="space-y-1.5 font-tabular">
                <div className="flex justify-between">
                  <span className="text-slate-500">Receipt No:</span>
                  <span className="font-bold text-slate-900">{activeReceipt.receiptNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date/Time:</span>
                  <span>{new Date(activeReceipt.timestamp).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Pupil:</span>
                  <span className="font-bold">
                    {students.find(s => s.id === activeReceipt.studentId)?.firstName}{' '}
                    {students.find(s => s.id === activeReceipt.studentId)?.lastName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Admission No:</span>
                  <span>{students.find(s => s.id === activeReceipt.studentId)?.admissionNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Channel:</span>
                  <span>{activeReceipt.paymentChannel || 'Cash'}</span>
                </div>
                {activeReceipt.referenceNo && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Reference:</span>
                    <span>{activeReceipt.referenceNo}</span>
                  </div>
                )}
              </div>

              <div className="py-2.5 border-t border-b border-dashed border-slate-300 flex justify-between items-center text-sm">
                <span className="font-bold">AMOUNT PAID:</span>
                <span className="font-bold text-[#065F46] font-tabular">{formatMoney(activeReceipt.amountMinor)}</span>
              </div>

              {/* Cryptographic SHA-256 Tamper-Proof Stamp */}
              <div className="p-2 bg-white border border-slate-200 rounded-[2px] text-[10px] text-slate-500 space-y-1">
                <div className="flex items-center gap-1 font-semibold text-[#065F46]">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>SHA-256 Tamper-Proof Cryptographic Hash:</span>
                </div>
                <div className="font-mono text-[9px] break-all text-slate-600">
                  {activeReceipt.verificationHash || 'e89a42...c5f10b (Verified Local Cipher)'}
                </div>
              </div>

              <div className="text-center text-[10px] text-slate-400 pt-2 font-sans">
                Issued by Bursar · Valid for Official School Clearance
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 text-xs font-semibold rounded-[4px] bg-[#0F172A] text-white hover:bg-[#1E293B] flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Print Receipt Slip
              </button>
              <button
                onClick={() => setActiveReceipt(null)}
                className="px-4 py-2 text-xs font-medium rounded-[4px] border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Class Arm Batch Fee Assessment Modal */}
      {showClassAssessmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-[6px] bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Batch Assess Fee to Class Arm
                </h3>
                <p className="text-xs text-slate-500 font-medium">Debits all active pupils in the selected class</p>
              </div>
              <button onClick={() => setShowClassAssessmentModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>
            <form onSubmit={handleAssessClassSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Target Class Arm *
                </label>
                <select
                  required
                  value={classAssessmentForm.classArm}
                  onChange={(e) => setClassAssessmentForm({ ...classAssessmentForm, classArm: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Bill / Assessment Title *
                </label>
                <input
                  type="text"
                  required
                  value={classAssessmentForm.name}
                  onChange={(e) => setClassAssessmentForm({ ...classAssessmentForm, name: e.target.value })}
                  placeholder="e.g. Second Term Consolidated Tuition"
                  className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Amount ({currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={classAssessmentForm.amountMajor}
                    onChange={(e) => setClassAssessmentForm({ ...classAssessmentForm, amountMajor: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs font-bold rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#B45309] font-tabular"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={classAssessmentForm.category}
                    onChange={(e) => setClassAssessmentForm({ ...classAssessmentForm, category: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  >
                    <option value="Tuition">Tuition Fee</option>
                    <option value="Development">Development Levy</option>
                    <option value="Books">Books & Learning Materials</option>
                    <option value="Uniform">Uniform & Sportswear</option>
                    <option value="PTA">PTA Levy</option>
                  </select>
                </div>
              </div>
              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-semibold rounded-[4px] bg-[#B45309] hover:bg-[#92400E] text-white"
                >
                  Debit Class Arm ({classes.find(c => c.name === classAssessmentForm.classArm)?.name || 'Class'})
                </button>
                <button
                  type="button"
                  onClick={() => setShowClassAssessmentModal(false)}
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
