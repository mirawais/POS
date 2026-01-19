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
    const { name, companyName, contactNumber, techContact, email, address, activeDate, inactiveDate } = body ?? {};

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const client = await prisma.client.create({
        data: {
            name,
            companyName,
            contactNumber,
            techContact,
            email,
            address,
            // Use provided activeDate or default to now if not provided (though schema default handles undefined, UI sends it)
            activeDate: activeDate ? new Date(activeDate) : new Date(),
            inactiveDate: inactiveDate ? new Date(inactiveDate) : null,
        },
    });

    // Optionally create default settings for the client?
    // We can do that here or let them configure it later.
    // For now, simple creation.

    return NextResponse.json(client, { status: 201 });
}

export async function DELETE(req: Request) {
    const session = await auth();
    if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = (session as any).user;
    if (user.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    try {
        await prisma.client.delete({
            where: { id },
        });
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        // If foreign key constraint fails, we might need manual cleanup if cascade isn't set.
        // But for now, returning error is better than silent failure.
        console.error("Delete client error", e);
        return NextResponse.json({ error: e.message || "Failed to delete client" }, { status: 500 });
    }
}
