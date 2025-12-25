import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const session = await auth();
    if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = (session as any).user;
    if (user.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const clients = await prisma.client.findMany({
        include: {
            _count: {
                select: { users: true, products: true, sales: true }
            }
        },
        orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(clients);
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = (session as any).user;
    if (user.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { name } = body ?? {};

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const client = await prisma.client.create({
        data: { name },
    });

    // Optionally create default settings for the client?
    // We can do that here or let them configure it later.
    // For now, simple creation.

    return NextResponse.json(client, { status: 201 });
}
