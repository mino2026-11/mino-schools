/**
 * MINO-SMS Audit Trails, Backup & Recovery Control Center
 * Append-only immutable log inspector, cold JSON backup/restore, soft wipe controls, and system health checks.
 */

import React, { useState, useEffect } from 'react';
import { History, Download, Upload, RefreshCw, AlertTriangle, CheckCircle2, ShieldAlert, Activity, Server, Database } from 'lucide-react';
import { api } from '../services/api';
import { localDb } from '../services/db';
import type { AuditLog } from '../types';

interface AuditTrailProps {
  currentRole: string;
  userEmail: string;
  onDataRestored?: () => void;
}

export const AuditTrail: React.FC<AuditTrailProps> = ({ currentRole, userEmail, onDataRestored }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [healthInfo, setHealthInfo] = useState<any | null>(null);
  const [outboxCount, setOutboxCount] = useState<number>(0);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Restore & Reseed Modal/Confirm State
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreJson, setRestoreJson] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [exportingSnapshot, setExportingSnapshot] = useState(false);
  const [confirmingReseed, setConfirmingReseed] = useState(false);

  useEffect(() => {
    loadAuditAndHealth();
  }, []);

  async function loadAuditAndHealth() {
    setLoading(true);
    try {
      const [auditData, healthData, pendingOutbox] = await Promise.all([
        api.getAuditLogs(),
        api.getHealth(),
        localDb.outbox.count()
      ]);
      setLogs(auditData);
      setHealthInfo(healthData);
      setOutboxCount(pendingOutbox);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load system diagnostics' });
    } finally {
      setLoading(false);
    }
  }

  async function handleRestoreSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!restoreJson.trim()) return;

    try {
      setRestoring(true);
      const parsed = JSON.parse(restoreJson);
      const res = await api.restoreBackup(parsed, userEmail);
      setFeedback({ type: 'success', message: res.message || 'Database snapshot restored successfully.' });
      setShowRestoreModal(false);
      setRestoreJson('');
      loadAuditAndHealth();
      if (onDataRestored) onDataRestored();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Invalid JSON snapshot format' });
    } finally {
      setRestoring(false);
    }
  }

  async function handleExportSnapshot() {
    try {
      setExportingSnapshot(true);
      await api.downloadBackupSnapshot();
      setFeedback({ type: 'success', message: 'Administrative JSON snapshot exported successfully.' });
      loadAuditAndHealth();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to export snapshot JSON.' });
    } finally {
      setExportingSnapshot(false);
    }
  }

  async function handleSoftWipe() {
    try {
      setConfirmingReseed(false);
      await api.softWipeAndReseed(userEmail);
      setFeedback({ type: 'success', message: 'System state reset to baseline production seed.' });
      loadAuditAndHealth();
      if (onDataRestored) onDataRestored();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  }

  return (
    <div className="space-y-4">
      {/* System Health Diagnostics Bar */}
      {healthInfo && (
        <div className="p-4 bg-white border border-slate-200 rounded-[4px] shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#065F46]" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                System Infrastructure & Security Invariants
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-[#065F46] flex items-center gap-1 font-tabular">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#065F46]" /> System Operational (Uptime: {Math.round(healthInfo.uptimeSeconds)}s)
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-[3px]">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Security Rules Status</span>
              <span className="font-mono text-[#065F46] font-bold text-[11px] block mt-0.5">
                {healthInfo.firestoreClientAccess}
              </span>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-[3px]">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Cryptography Suite</span>
              <span className="font-mono text-slate-800 text-[11px] block mt-0.5">
                AES-GCM-256 / PBKDF2 (100k)
              </span>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-[3px]">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Idempotency Registry</span>
              <span className="font-mono text-slate-800 font-bold text-[11px] block mt-0.5 font-tabular">
                {healthInfo.statistics.idempotencyIndexSize} Cached UUIDs
              </span>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-[3px]">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Local Outbox Depth</span>
              <span className={`font-mono font-bold text-[11px] block mt-0.5 font-tabular ${
                outboxCount > 0 ? 'text-[#B45309]' : 'text-[#065F46]'
              }`}>
                {outboxCount} Queued Offline Items
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Backup, Restore & Disaster Recovery Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-[4px]">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-[#B45309]" />
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
            Immutable Audit Trail & Disaster Recovery
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Download Backup */}
          <button
            type="button"
            disabled={exportingSnapshot}
            onClick={handleExportSnapshot}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[4px] bg-[#0F172A] hover:bg-[#1E293B] text-white transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-[#B45309]" />
            <span>{exportingSnapshot ? 'Exporting...' : 'Export Snapshot JSON'}</span>
          </button>

          {/* Restore Backup */}
          <button
            type="button"
            onClick={() => setShowRestoreModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[4px] bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-slate-700" />
            <span>Restore Snapshot</span>
          </button>

          {/* Soft Wipe / Reseed */}
          {confirmingReseed ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSoftWipe}
                className="px-3 py-1.5 text-xs font-bold rounded-[4px] bg-red-700 hover:bg-red-800 text-white transition-colors"
              >
                Confirm Reseed
              </button>
              <button
                type="button"
                onClick={() => setConfirmingReseed(false)}
                className="px-2.5 py-1.5 text-xs font-medium rounded-[4px] border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingReseed(true)}
              className="px-3 py-1.5 text-xs font-semibold rounded-[4px] text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors"
            >
              Reseed Baseline
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

      {/* Append-Only Audit Log Viewer */}
      <div className="bg-white border border-slate-200 rounded-[4px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="mino-table">
            <thead>
              <tr>
                <th className="w-36">Timestamp</th>
                <th className="w-32">Actor</th>
                <th className="w-24">Role</th>
                <th className="w-40">Action</th>
                <th className="w-24">Entity</th>
                <th>Operation Details</th>
                <th className="w-28 text-right font-mono">IP Address</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">Loading audit trail records...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">No audit logs recorded yet.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td className="text-[11px] text-slate-500 font-tabular whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="font-semibold text-slate-900">{log.actorName}</td>
                    <td className="text-slate-600 capitalize">{log.actorRole}</td>
                    <td>
                      <span className="font-mono text-xs font-semibold text-slate-800">{log.action}</span>
                    </td>
                    <td className="capitalize text-slate-600">{log.entity}</td>
                    <td className="text-slate-700 leading-normal">{log.details}</td>
                    <td className="text-right font-mono text-[11px] text-slate-500">{log.ipAddress || '127.0.0.1'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restore JSON Snapshot Modal */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-[6px] bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Point-in-Time Database Restore
              </h3>
              <button onClick={() => setShowRestoreModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>

            <form onSubmit={handleRestoreSubmit} className="mt-4 space-y-3.5">
              <p className="text-xs text-slate-600 leading-relaxed">
                Paste your administrative backup JSON string below to restore pupil registers, gradebook events, and fee ledgers.
              </p>

              <textarea
                rows={8}
                required
                value={restoreJson}
                onChange={(e) => setRestoreJson(e.target.value)}
                placeholder='{"version":"1.0.0","exportTimestamp":"...","school":{...}}'
                className="w-full p-2.5 text-xs font-mono rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
              />

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={restoring || !restoreJson.trim()}
                  className="flex-1 py-2 text-xs font-semibold rounded-[4px] bg-[#B45309] hover:bg-[#92400E] text-white disabled:opacity-50 transition-colors"
                >
                  {restoring ? 'Restoring Snapshot...' : 'Validate & Restore Snapshot'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRestoreModal(false)}
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
