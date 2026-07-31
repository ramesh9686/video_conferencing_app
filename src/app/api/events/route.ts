import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateEventCode } from '@/lib/utils';

export async function GET() {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const events = await db.event.findMany({
      where: {
        OR: [
          { hostId: authUser.userId },
          { participants: { some: { userId: authUser.userId } } }
        ]
      },
      include: {
        host: { select: { name: true, email: true, avatar: true } },
        agendaItems: { orderBy: { order: 'asc' } },
        _count: { select: { participants: true } }
      },
      orderBy: { startDate: 'asc' }
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Fetch events error:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, description, startDate, agenda } = await req.json();

    if (!title || !startDate) {
      return NextResponse.json({ error: 'Title and Start Date are required' }, { status: 400 });
    }

    const code = generateEventCode();

    const event = await db.event.create({
      data: {
        title,
        description,
        code,
        startDate: new Date(startDate),
        hostId: authUser.userId,
        status: 'UPCOMING',
        agendaItems: {
          create: (agenda || []).map((item: any, index: number) => ({
            title: item.title,
            description: item.description || '',
            startTime: item.startTime || '09:00 AM',
            duration: item.duration || '30 mins',
            order: index,
          }))
        },
        participants: {
          create: {
            userId: authUser.userId,
            name: authUser.name,
            role: 'HOST'
          }
        }
      },
      include: {
        agendaItems: true,
        host: { select: { name: true, email: true } }
      }
    });

    return NextResponse.json({ event });
  } catch (error) {
    console.error('Create event error:', error);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
