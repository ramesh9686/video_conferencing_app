'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Calendar, Plus, Video, Users, Clock, Copy, Check, ArrowRight, Search, Play } from 'lucide-react';
import { formatDate, formatTime } from '@/lib/utils';

export default function DashboardPage() {
  const router = useRouter();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [quickCode, setQuickCode] = useState('');
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/events');
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleQuickJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCode.trim()) return;

    try {
      const res = await fetch('/api/events/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: quickCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Event not found');
      router.push(`/meeting/${data.eventId}`);
    } catch (err: any) {
      setJoinError(err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-extrabold text-white font-heading tracking-tight">Event Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">Manage your events, start video sessions, and view agendas</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Quick Join Box */}
          <form onSubmit={handleQuickJoin} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Code (e.g. ABC123)"
              value={quickCode}
              onChange={(e) => setQuickCode(e.target.value.toUpperCase())}
              className="px-3.5 py-2.5 rounded-xl glass-input text-xs font-mono uppercase font-bold w-36"
            />
            <button
              type="submit"
              className="px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-xs font-semibold text-white transition-colors flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 text-emerald-400" /> Join
            </button>
          </form>

          <Link
            href="/events/create"
            className="gradient-btn px-5 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 shadow-lg shadow-indigo-500/25"
          >
            <Plus className="w-4 h-4" /> Create Event
          </Link>
        </div>
      </div>

      {joinError && (
        <div className="mb-6 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium">
          {joinError}
        </div>
      )}

      {/* Events Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-2xl bg-slate-900/60 animate-pulse border border-slate-800" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-16 glass-panel rounded-3xl border border-slate-800 max-w-xl mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mx-auto flex items-center justify-center text-indigo-400 mb-4">
            <Calendar className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-white font-heading">No Events Scheduled</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            You haven&apos;t created or joined any events yet. Create your first event to get started.
          </p>
          <Link
            href="/events/create"
            className="inline-flex items-center gap-2 mt-6 gradient-btn px-6 py-2.5 rounded-xl text-xs font-semibold text-white"
          >
            <Plus className="w-4 h-4" /> Create Event Now
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <div
              key={event.id}
              className="glass-panel glass-panel-hover p-6 rounded-2xl flex flex-col justify-between border border-slate-800/90 relative group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> UPCOMING
                  </span>
                  <button
                    onClick={() => copyCode(event.code)}
                    className="flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 hover:text-white transition-colors"
                    title="Copy Code"
                  >
                    {copiedCode === event.code ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {event.code}
                  </button>
                </div>

                <h3 className="text-lg font-bold text-white font-heading line-clamp-1 group-hover:text-indigo-400 transition-colors">
                  {event.title}
                </h3>
                
                <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {event.description || 'No description provided.'}
                </p>

                <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{formatDate(event.startDate)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{formatTime(event.startDate)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Host: {event.host?.name || 'Organizer'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-2">
                <Link
                  href={`/events/${event.id}`}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700/80 hover:bg-slate-800 text-xs font-semibold text-slate-200 text-center transition-colors"
                >
                  Agenda
                </Link>
                <Link
                  href={`/meeting/${event.id}`}
                  className="flex-1 py-2.5 rounded-xl gradient-btn text-xs font-semibold text-white text-center flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-500/20"
                >
                  <Video className="w-3.5 h-3.5" /> Join Meeting
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
