'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Video, Calendar, MessageSquare, MonitorUp, Users, ArrowRight, ShieldCheck, Zap } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [eventCode, setEventCode] = useState('');
  const [guestName, setGuestName] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  const handleQuickJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventCode.trim()) return;

    setJoining(true);
    setError('');

    try {
      const res = await fetch('/api/events/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: eventCode.trim(), guestName })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Event not found');
      }

      router.push(`/meeting/${data.eventId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="relative overflow-hidden min-h-[calc(100vh-4rem)] flex flex-col justify-between">
      
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-2/3 right-10 w-[400px] h-[400px] bg-purple-600/15 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 flex-1 flex flex-col justify-center">
        
        <div className="text-center max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold tracking-wide uppercase">
            <Zap className="w-3.5 h-3.5 text-indigo-400" /> Seamless Virtual Event & Video Platform
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight font-heading leading-tight">
            Connect, Collaborate & Host <br />
            <span className="gradient-text">Virtual Events Effortlessly</span>
          </h1>

          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Create events, invite participants, follow real-time agendas, and engage in high-definition video meetings with integrated screen sharing and live chat.
          </p>

          {/* Quick Join Card */}
          <div className="mt-8 max-w-md mx-auto p-6 rounded-2xl glass-panel border border-slate-800 shadow-2xl">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 text-left flex items-center gap-2">
              <Video className="w-4 h-4 text-indigo-400" /> Join an Instant Meeting
            </h3>

            <form onSubmit={handleQuickJoin} className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Enter Event Code (e.g. ABC123)"
                  value={eventCode}
                  onChange={(e) => setEventCode(e.target.value.toUpperCase())}
                  className="flex-1 px-4 py-2.5 rounded-xl glass-input text-sm uppercase tracking-wider font-mono placeholder:normal-case font-semibold"
                  required
                />
                <button
                  type="submit"
                  disabled={joining}
                  className="gradient-btn px-6 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap"
                >
                  {joining ? 'Joining...' : 'Join Now'} <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <input
                type="text"
                placeholder="Your Name (Optional if signed in)"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="w-full px-4 py-2 rounded-xl glass-input text-xs"
              />

              {error && <p className="text-xs text-rose-400 text-left font-medium">{error}</p>}
            </form>

            <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>Want to host your own event?</span>
              <Link href="/events/create" className="text-indigo-400 font-semibold hover:underline flex items-center gap-1">
                Create Event <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

        </div>

        {/* Feature Grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
          
          <div className="p-6 rounded-2xl glass-panel glass-panel-hover flex flex-col gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Video className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-white font-heading">HD Video Grid</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Crystal-clear multi-party video conferencing powered by WebRTC mesh architecture.
            </p>
          </div>

          <div className="p-6 rounded-2xl glass-panel glass-panel-hover flex flex-col gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Calendar className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-white font-heading">Event Agendas</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Organize timelines, sessions, and track agenda completion live during meetings.
            </p>
          </div>

          <div className="p-6 rounded-2xl glass-panel glass-panel-hover flex flex-col gap-3">
            <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
              <MonitorUp className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-white font-heading">Screen Share</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Share slides, browser tabs, or desktop application windows instantly with attendees.
            </p>
          </div>

          <div className="p-6 rounded-2xl glass-panel glass-panel-hover flex flex-col gap-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-white font-heading">Live Meeting Chat</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Real-time message stream to ask questions and share links without interrupting speakers.
            </p>
          </div>

        </div>

      </div>

      {/* Footer */}
      <footer className="py-6 border-t border-slate-900 text-center text-xs text-slate-500">
        EventConnect MVP &copy; 2026. Built with Next.js, Prisma & WebRTC.
      </footer>
    </div>
  );
}
