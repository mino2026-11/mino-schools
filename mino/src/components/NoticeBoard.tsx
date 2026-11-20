/**
 * MINO-SMS Notice Board & Broadcast Announcements
 * Publish official memos, filter by audience, and tag priority urgency.
 */

import React, { useState, useEffect } from 'react';
import {
  Bell,
  PlusCircle,
  Search,
  AlertTriangle,
  Info,
  Calendar,
  User,
  Users,
  Check,
  Trash2
} from 'lucide-react';
import { api } from '../services/api';
import type { Notice, NoticePriority, NoticeAudience } from '../types';

interface NoticeBoardProps {
  currentRole: string;
  userEmail: string;
}

export const NoticeBoard: React.FC<NoticeBoardProps> = ({ currentRole, userEmail }) => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [audienceFilter, setAudienceFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form
  const [form, setForm] = useState<{
    title: string;
    content: string;
    priority: NoticePriority;
    targetAudience: NoticeAudience;
  }>({
    title: '',
    content: '',
    priority: 'normal',
    targetAudience: 'All'
  });

  useEffect(() => {
    loadNotices();
  }, []);

  async function loadNotices() {
    setLoading(true);
    try {
      const data = await api.getNotices();
      setNotices(data);
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message || 'Failed to load notices' });
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteNotice(noticeId: string, title: string) {
    if (!confirm(`Are you sure you want to delete notice: "${title}"?`)) return;
    try {
      await api.deleteNotice(noticeId);
      setFeedback({ type: 'success', message: 'Notice deleted successfully.' });
      loadNotices();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete notice' });
    }
  }

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.createNotice(form, userEmail);
      setFeedback({ type: 'success', message: 'Official notice published to school notice board.' });
      setShowCreateModal(false);
      setForm({ title: '', content: '', priority: 'normal', targetAudience: 'All' });
      loadNotices();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error creating notice' });
    }
  }

  const filteredNotices = notices.filter(n => {
    const matchesAudience = audienceFilter === 'All' || n.targetAudience === audienceFilter || n.targetAudience === 'All';
    const matchesQuery = n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesAudience && matchesQuery;
  });

  return (
    <div className="space-y-4">
      {/* Header and Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-[4px]">
        <div className="flex flex-wrap items-center gap-2">
          {/* Audience Filter Tabs */}
          <div className="flex p-0.5 bg-slate-100 rounded-[4px] border border-slate-200">
            {['All', 'Teachers', 'Parents', 'Students'].map((aud) => (
              <button
                key={aud}
                type="button"
                onClick={() => setAudienceFilter(aud)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-[3px] transition-colors ${
                  audienceFilter === aud
                    ? 'bg-[#0F172A] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {aud}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search circulars..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A] w-48 sm:w-60"
            />
          </div>
        </div>

        {currentRole === 'admin' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[4px] bg-[#0F172A] hover:bg-[#1E293B] text-white transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Publish Circular</span>
          </button>
        )}
      </div>

      {feedback && (
        <div className={`p-3 rounded-[4px] text-xs flex items-center justify-between border ${
          feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-[#065F46]' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="font-bold ml-2">×</button>
        </div>
      )}

      {/* Notices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400 text-xs">
            Loading circulars and notices...
          </div>
        ) : filteredNotices.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400 text-xs">
            No notices match the selected criteria.
          </div>
        ) : (
          filteredNotices.map((n) => (
            <div
              key={n.id}
              className={`p-4 rounded-[4px] border transition-colors bg-white shadow-sm flex flex-col justify-between ${
                n.priority === 'urgent' ? 'border-red-200' : 'border-slate-200'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded-[2px] ${
                      n.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                      n.priority === 'normal' ? 'bg-amber-100 text-[#B45309]' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {n.priority}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">
                      Target: {n.targetAudience}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {n.date}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-2.5">
                  {n.title}
                </h3>
                <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                  {n.content}
                </p>
              </div>

              <div className="mt-4 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between items-center">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3 text-slate-400" />
                  <span>Issued by: <strong>{n.author}</strong></span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-400">Official Bulletin</span>
                  {currentRole === 'admin' && (
                    <button
                      onClick={() => handleDeleteNotice(n.id, n.title)}
                      className="text-red-500 hover:text-red-700 p-0.5 rounded transition-colors"
                      title="Delete circular"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Publish Notice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-[6px] bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Publish School Announcement / Circular
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">×</button>
            </div>
            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Notice Title *
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Mid-Term Assessment Guidelines"
                  className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Priority Level
                  </label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value as any })}
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  >
                    <option value="normal">Normal Priority</option>
                    <option value="urgent">Urgent Alert</option>
                    <option value="info">General Information</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Target Audience
                  </label>
                  <select
                    value={form.targetAudience}
                    onChange={(e) => setForm({ ...form, targetAudience: e.target.value as any })}
                    className="w-full px-3 py-1.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                  >
                    <option value="All">All School Community</option>
                    <option value="Teachers">Teaching Staff Only</option>
                    <option value="Parents">Parents / Guardians</option>
                    <option value="Students">Pupils & Students</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Notice Content *
                </label>
                <textarea
                  rows={4}
                  required
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="Enter circular announcement text..."
                  className="w-full p-2.5 text-xs rounded-[4px] border border-slate-300 focus:outline-none focus:border-[#0F172A]"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-semibold rounded-[4px] bg-[#0F172A] hover:bg-[#1E293B] text-white"
                >
                  Publish Announcement
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
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
