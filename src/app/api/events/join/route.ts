import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const authUser = await getAuthUser();
    const { code, guestName } = await req.json();

    if (!code) {
      return NextResponse.json({ error: 'Event code is required' }, { status: 400 });
    }

    const event = await db.event.findFirst({
      where: {
        OR: [
          { code: code.trim().toUpperCase() },
          { id: code.trim() }
        ]
      }
    });

    if (!event) {
      return NextResponse.json({ error: 'Invalid event code or link' }, { status: 404 });
    }

    const participantName = authUser?.name || guestName || 'Guest Participant';

    // Register or retrieve participant record
    if (authUser?.userId) {
      const existing = await db.participant.findFirst({
        where: { eventId: event.id, userId: authUser.userId }
      });
      if (!existing) {
        await db.participant.create({
          data: {
            eventId: event.id,
            userId: authUser.userId,
            name: participantName,
            role: event.hostId === authUser.userId ? 'HOST' : 'ATTENDEE'
          }
        });
      }
    }

    return NextResponse.json({ eventId: event.id, code: event.code, title: event.title });
  } catch (error) {
    console.error('Join event error:', error);
    return NextResponse.json({ error: 'Failed to join event' }, { status: 500 });
  }
}
