import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const event = await db.event.findFirst({
      where: {
        OR: [{ id }, { code: id.toUpperCase() }]
      },
      include: {
        host: { select: { id: true, name: true, email: true, avatar: true } },
        agendaItems: { orderBy: { order: 'asc' } },
        participants: {
          include: {
            user: { select: { name: true, avatar: true } }
          }
        },
        messages: {
          take: 50,
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json({ event });
  } catch (error) {
    console.error('Fetch event detail error:', error);
    return NextResponse.json({ error: 'Failed to fetch event detail' }, { status: 500 });
  }
}
