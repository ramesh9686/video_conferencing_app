'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Calendar, Clock, Users, Video, Copy, Check, Share2, ArrowLeft, CheckCircle2, Circle } from 'lucide-react';
import { formatDate, formatTime } from '@/lib/utils';
import { downloadICSFile } from '@/lib/ics';

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params?.id as string) || '';

  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    fetchEvent();
  }, [id]);

  const fetchEvent = async () => {
    try {
      const res = await fetch(`/api/events/${id}`);
      if (!res.ok) throw new Error('Event not found');
      const data = await res.json();
      setEvent(data.event);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (!event) return;
    navigator.clipboard.writeText(event.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyLink = () => {
    if (!event) return;
    const url = `${window.location.origin}/meeting/${event.id}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 flex justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h2 className="text-2xl font-bold text-white">Event Not Found</h2>
        <Link href="/dashboard" className="mt-4 inline-block text-indigo-400 font-semibold">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Event Overview Card */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-8 rounded-3xl border border-slate-800 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> {event.status}
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={copyCode}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-xs font-mono font-bold text-slate-200 flex items-center gap-1.5 transition-colors"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  CODE: {event.code}
                </button>
                
                <button
                  onClick={copyLink}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors"
                  title="Copy Invite Link"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                  Share
                </button>

                <button
                  onClick={() => downloadICSFile(event)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30 hover:bg-indigo-500/30 text-xs font-semibold text-indigo-300 flex items-center gap-1.5 transition-colors"
                  title="Export to Calendar (.ics)"
                >
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  + Calendar
                </button>
              </div>
            </div>

            <div>
              <h1 className="text-3xl font-extrabold text-white font-heading tracking-tight">{event.title}</h1>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                {event.description || 'No specific description provided for this event.'}
              </p>
            </div>

            <div className="pt-6 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs text-slate-300">
              <div className="space-y-1">
                <span className="text-slate-500 block">Date</span>
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" /> {formatDate(event.startDate)}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 block">Time</span>
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" /> {formatTime(event.startDate)}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-slate-500 block">Organizer</span>
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-400" /> {event.host?.name}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <Link
                href={`/meeting/${event.id}`}
                className="w-full py-3.5 rounded-2xl gradient-btn text-sm font-bold text-white flex items-center justify-center gap-2 shadow-xl shadow-indigo-500/25"
              >
                <Video className="w-5 h-5" /> Launch / Join Video Meeting
              </Link>
            </div>
          </div>

          {/* Agenda Timeline Card */}
          <div className="glass-panel p-8 rounded-3xl border border-slate-800">
            <h3 className="text-lg font-bold text-white font-heading mb-6 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-400" /> Event Agenda & Timeline
            </h3>

            {event.agendaItems?.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No agenda items added.</p>
            ) : (
              <div className="space-y-6 relative before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
                {event.agendaItems.map((item: any, idx: number) => (
                  <div key={item.id} className="relative pl-8 flex items-start gap-4">
                    <div className="absolute left-1 top-1 -translate-x-1/2 w-4 h-4 rounded-full bg-indigo-600 border-4 border-slate-950" />
                    <div className="flex-1 p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className="text-sm font-bold text-white">{item.title}</h4>
                        <span className="text-[11px] font-medium text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md">
                          {item.startTime} ({item.duration})
                        </span>
                      </div>
                      {item.description && (
                        <p className="text-xs text-slate-400 mt-1">{item.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Participants List */}
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-slate-800">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" /> Confirmed Attendees ({event.participants?.length || 0})
            </h3>

            <div className="space-y-3">
              {event.participants?.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">
                      {p.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">{p.name}</p>
                      <span className="text-[10px] text-slate-400">{p.role}</span>
                    </div>
                  </div>
                  {p.role === 'HOST' && (
                    <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                      HOST
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
