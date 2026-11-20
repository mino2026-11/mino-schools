/**
 * MINO-SMS Parents & Guardians Directory
 * View linked pupils per guardian, contact details, fee clearance status,
 * and direct WhatsApp / SMS broadcast communication templates.
 * Organized with Table and Card views for lightweight efficiency and visual appeal.
 */

import React, { useState, useEffect } from 'react';
import {
  HeartHandshake,
  Search,
  MessageSquare,
  Copy,
  Check,
  Phone,
  Mail,
  ShieldCheck,
  AlertCircle,
  GraduationCap,
  LayoutGrid,
  Table as TableIcon
} from 'lucide-react';
import { api } from '../services/api';
import type { ParentSummary } from '../types';

interface ParentsDirectoryProps {
  currencySymbol: string;
  tenantName?: string;
}

export const ParentsDirectory: React.FC<ParentsDirectoryProps> = ({ currencySymbol, tenantName }) => {
  const [parents, setParents] = useState<ParentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'cleared' | 'arrears'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    loadParents();
  }, []);

  async function loadParents() {
    setLoading(true);
    try {
      const data = await api.getParents();
      setParents(data);
    } catch (e) {
      console.warn('Error loading parents directory', e);
    } finally {
      setLoading(false);
    }
  }

  function handleCopy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  }

  const formatMoney = (minor: number) => {
    return `${currencySymbol}${(minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const filteredParents = parents.filter(p => {
    const q = searchQuery.toLowerCase();
    const studentsMatch = p.students.some(s => s.name.toLowerCase().includes(q) || s.admissionNo.toLowerCase().includes(q));
    const textMatch =
      p.guardianName.toLowerCase().includes(q) ||
      p.guardianPhone.includes(q) ||
      (p.guardianEmail || '').toLowerCase().includes(q) ||
      studentsMatch;
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'cleared' ? p.isCleared : !p.isCleared);
    return textMatch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      {/* Search & View Controls Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-[4px] shadow-sm">
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <HeartHandshake className="w-4 h-4 text-[#B45309]" />
            <span>Guardians & Parent Directory ({filteredParents.length})</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Verified emergency contacts, multi-ward accounts, portal access tokens, and clearance indicators.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs font-medium rounded-[4px] border border-slate-300 bg-white text-slate-800 focus:outline-none focus:border-[#0F172A]"
          >
            <option value="all">All Clearance States</option>
            <option value="cleared">Cleared Only</option>
            <option value="arrears">Outstanding Arrears</option>
          </select>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by guardian or student..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A] w-48 sm:w-60"
            />
          </div>

          {/* Layout Toggle */}
          <div className="flex p-0.5 rounded-[4px] bg-slate-100 border border-slate-200">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-[3px] transition-colors ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Table View"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-[3px] transition-colors ${
                viewMode === 'cards' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Cards View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: DATA TABLE */}
      {viewMode === 'table' ? (
        <div className="bg-white border border-slate-200 rounded-[4px] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="mino-table">
              <thead>
                <tr>
                  <th>Guardian Details</th>
                  <th>Contact Number</th>
                  <th>Enrolled Ward(s)</th>
                  <th>Portal PIN</th>
                  <th>Clearance Status</th>
                  <th>Balance Due</th>
                  <th className="text-right">Direct Communications</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">Loading guardians directory...</td>
                  </tr>
                ) : filteredParents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">No guardian records match your filter.</td>
                  </tr>
                ) : (
                  filteredParents.map((parent, idx) => {
                    const smsText = `Dear ${parent.guardianName}, notice from ${tenantName || 'Oakridge Model Academy'} regarding your ward(s). Portal PIN: ${parent.accessPin}. Fee status: ${parent.isCleared ? 'Fully Cleared' : `Outstanding balance: ${formatMoney(parent.arrearsMinor)}`}.`;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="font-semibold text-slate-900">
                          <div>{parent.guardianName}</div>
                          {parent.guardianEmail && (
                            <div className="text-[11px] text-slate-400 font-sans font-normal">{parent.guardianEmail}</div>
                          )}
                        </td>
                        <td className="font-tabular font-mono text-slate-700">
                          {parent.guardianPhone || <span className="text-slate-400 italic">None</span>}
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {parent.students.map(st => (
                              <span
                                key={st.id}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] bg-slate-100 border border-slate-200 text-[11px] text-slate-800"
                              >
                                <GraduationCap className="w-3 h-3 text-slate-500" />
                                <span className="font-semibold">{st.name}</span>
                                <span className="text-slate-500 font-mono text-[10px]">({st.classArm})</span>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="font-mono font-bold text-slate-800">
                          {parent.accessPin}
                        </td>
                        <td>
                          {parent.isCleared ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[10px] font-semibold bg-emerald-50 text-[#065F46] border border-emerald-200">
                              <ShieldCheck className="w-3 h-3" />
                              <span>Cleared</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[10px] font-semibold bg-amber-50 text-[#B45309] border border-amber-200">
                              <AlertCircle className="w-3 h-3" />
                              <span>Arrears</span>
                            </span>
                          )}
                        </td>
                        <td className="font-tabular font-bold">
                          {parent.isCleared ? (
                            <span className="text-slate-400 font-normal">₦0.00</span>
                          ) : (
                            <span className="text-[#B45309]">{formatMoney(parent.arrearsMinor)}</span>
                          )}
                        </td>
                        <td className="text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {parent.guardianPhone && (
                              <a
                                href={`https://wa.me/${parent.guardianPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(smsText)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 text-xs font-semibold rounded-[3px] bg-[#065F46] hover:bg-[#064E3B] text-white inline-flex items-center gap-1"
                                title="Send WhatsApp notice"
                              >
                                <MessageSquare className="w-3 h-3" />
                                <span>WhatsApp</span>
                              </a>
                            )}
                            <button
                              onClick={() => handleCopy(smsText, `sms_${idx}`)}
                              className="px-2 py-1 text-xs font-semibold rounded-[3px] bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 inline-flex items-center gap-1"
                              title="Copy SMS text"
                            >
                              {copiedKey === `sms_${idx}` ? <Check className="w-3 h-3 text-[#065F46]" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedKey === `sms_${idx}` ? 'Copied' : 'SMS'}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* VIEW 2: CARDS GRID */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {loading ? (
            <div className="col-span-full py-12 text-center text-slate-400 text-xs">
              Loading parents directory...
            </div>
          ) : filteredParents.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400 text-xs">
              No guardian records found matching "{searchQuery}".
            </div>
          ) : (
            filteredParents.map((parent, idx) => {
              const smsText = `Dear ${parent.guardianName}, this is a notice from ${tenantName || 'our School'} regarding your ward(s). Portal Access PIN: ${parent.accessPin}. Fee status: ${parent.isCleared ? 'Cleared' : `Outstanding balance: ${formatMoney(parent.arrearsMinor)}`}.`;
              return (
                <div
                  key={idx}
                  className="bg-white border border-slate-200 rounded-[4px] p-4 shadow-sm space-y-3 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          {parent.guardianName}
                        </h3>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5 font-tabular">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{parent.guardianPhone || 'No Phone'}</span>
                        </div>
                        {parent.guardianEmail && (
                          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span className="truncate">{parent.guardianEmail}</span>
                          </div>
                        )}
                      </div>
                      {parent.isCleared ? (
                        <span className="text-[10px] font-semibold text-[#065F46] bg-emerald-50 px-2 py-0.5 rounded-[2px] border border-emerald-200 inline-flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> Cleared
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-[#B45309] bg-amber-50 px-2 py-0.5 rounded-[2px] border border-amber-200 inline-flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Arrears
                        </span>
                      )}
                    </div>

                    {/* Linked Wards */}
                    <div className="mt-2.5 space-y-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                        Enrolled Wards ({parent.students.length})
                      </span>
                      <div className="space-y-1">
                        {parent.students.map((st) => (
                          <div
                            key={st.id}
                            className="p-1.5 rounded-[2px] bg-slate-50 text-xs flex justify-between items-center"
                          >
                            <div className="flex items-center gap-1.5">
                              <GraduationCap className="w-3.5 h-3.5 text-slate-500" />
                              <span className="font-semibold text-slate-800">{st.name}</span>
                            </div>
                            <div className="text-[11px] font-mono text-slate-500">
                              {st.classArm} · {st.admissionNo}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Financials & Portal PIN */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex justify-between items-center text-xs font-tabular">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase block font-semibold">Portal PIN</span>
                        <span className="font-mono font-bold text-slate-800">{parent.accessPin}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase block font-semibold">Balance Due</span>
                        <span className={`font-bold ${parent.isCleared ? 'text-slate-400' : 'text-[#B45309]'}`}>
                          {formatMoney(parent.arrearsMinor)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Instant Actions */}
                  <div className="pt-2 flex gap-1.5 border-t border-slate-100">
                    {parent.guardianPhone && (
                      <a
                        href={`https://wa.me/${parent.guardianPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(smsText)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-1.5 text-[11px] font-semibold rounded-[3px] bg-[#065F46] hover:bg-[#064E3B] text-white flex items-center justify-center gap-1"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>WhatsApp</span>
                      </a>
                    )}
                    <button
                      onClick={() => handleCopy(smsText, `sms_${idx}`)}
                      className="flex-1 py-1.5 text-[11px] font-semibold rounded-[3px] bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 flex items-center justify-center gap-1"
                    >
                      {copiedKey === `sms_${idx}` ? <Check className="w-3 h-3 text-[#065F46]" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === `sms_${idx}` ? 'Copied' : 'Copy SMS'}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
