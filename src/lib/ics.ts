export function downloadICSFile(event: {
  title: string;
  description?: string;
  startDate: string | Date;
  code: string;
  id: string;
}) {
  const start = new Date(event.startDate);
  const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour duration default

  const formatDateToICS = (date: Date) => {
    return date.toISOString().replace(/-|:|\.\d+/g, '');
  };

  const meetingUrl = typeof window !== 'undefined' ? `${window.location.origin}/meeting/${event.id}` : '';

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EventConnect//Virtual Event//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:eventconnect-${event.id}@eventconnect.app`,
    `DTSTAMP:${formatDateToICS(new Date())}`,
    `DTSTART:${formatDateToICS(start)}`,
    `DTEND:${formatDateToICS(end)}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${(event.description || '').replace(/\n/g, '\\n')} \\nJoin Video Meeting: ${meetingUrl} \\nEvent Code: ${event.code}`,
    `LOCATION:${meetingUrl}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.setAttribute('download', `${event.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
