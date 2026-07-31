'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Plus, Trash2, Clock, ArrowRight, Video, FileText } from 'lucide-react';

interface AgendaItemInput {
  title: string;
  startTime: string;
  duration: string;
  description: string;
}

export default function CreateEventPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [agenda, setAgenda] = useState<AgendaItemInput[]>([
    { title: 'Welcome & Introduction', startTime: '09:00 AM', duration: '15 mins', description: 'Kickoff and participant arrivals' },
    { title: 'Keynote & Presentations', startTime: '09:15 AM', duration: '30 mins', description: 'Main topic discussion' },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const addAgendaItem = () => {
    setAgenda([
      ...agenda,
      { title: '', startTime: '10:00 AM', duration: '20 mins', description: '' }
    ]);
  };

  const removeAgendaItem = (index: number) => {
    setAgenda(agenda.filter((_, i) => i !== index));
  };

  const updateAgendaItem = (index: number, field: keyof AgendaItemInput, value: string) => {
    const updated = [...agenda];
    updated[index][field] = value;
    setAgenda(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !startDate) {
      setError('Title and Start Date/Time are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          startDate,
          agenda
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create event');
      }

      router.push(`/events/${data.event.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      
      <div className="mb-8 text-center max-w-xl mx-auto">
        <div className="w-12 h-12 rounded-2xl gradient-btn mx-auto flex items-center justify-center text-white mb-3 shadow-lg shadow-indigo-500/20">
          <Calendar className="w-6 h-6" />
        </div>
        <h1 className="text-3xl font-extrabold text-white font-heading tracking-tight">Create New Event</h1>
        <p className="text-xs text-slate-400 mt-1">Set up event details, agenda schedule, and instant video room link</p>
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium text-center">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* Basic Event Details Card */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" /> Event Details
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Event Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 Product Launch & Team Sync"
              className="w-full px-4 py-2.5 rounded-xl glass-input text-sm font-semibold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Date & Start Time *</label>
              <input
                type="datetime-local"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl glass-input text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Event Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of the meeting goals"
                className="w-full px-4 py-2.5 rounded-xl glass-input text-sm"
              />
            </div>
          </div>
        </div>

        {/* Agenda Builder Card */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" /> Event Agenda Items
            </h3>
            <button
              type="button"
              onClick={addAgendaItem}
              className="px-3 py-1.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30 text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Slot
            </button>
          </div>

          <div className="space-y-3">
            {agenda.map((item, index) => (
              <div key={index} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 relative group">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-indigo-400">Item #{index + 1}</span>
                  {agenda.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAgendaItem(index)}
                      className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Slot Title (e.g. Opening Remarks)"
                    value={item.title}
                    onChange={(e) => updateAgendaItem(index, 'title', e.target.value)}
                    className="sm:col-span-1 px-3 py-2 rounded-lg glass-input text-xs font-medium"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Start Time (e.g. 09:00 AM)"
                    value={item.startTime}
                    onChange={(e) => updateAgendaItem(index, 'startTime', e.target.value)}
                    className="px-3 py-2 rounded-lg glass-input text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Duration (e.g. 20 mins)"
                    value={item.duration}
                    onChange={(e) => updateAgendaItem(index, 'duration', e.target.value)}
                    className="px-3 py-2 rounded-lg glass-input text-xs"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="gradient-btn px-8 py-3 rounded-xl text-sm font-semibold text-white flex items-center gap-2 shadow-xl shadow-indigo-500/25 disabled:opacity-50"
          >
            {loading ? 'Creating Event...' : 'Create Event & Get Link'} <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </form>
    </div>
  );
}
