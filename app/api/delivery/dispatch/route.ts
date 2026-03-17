import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    const session = await auth();
    if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = (session as any).user;
    if (!['ADMIN', 'SUPER_ADMIN', 'CASHIER'].includes(user.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { saleId, riderId } = body;

    if (!saleId || !riderId) {
        return NextResponse.json({ error: 'Sale ID and Rider ID are required' }, { status: 400 });
    }

    try {
        const sale = await prisma.sale.findUnique({ where: { id: saleId } });
        if (!sale) return NextResponse.json({ error: 'Sale not found' }, { status: 404 });

        const rider = await prisma.rider.findUnique({ where: { id: riderId } });
        if (!rider) return NextResponse.json({ error: 'Rider not found' }, { status: 404 });

        if (rider.status !== 'FREE') {
            return NextResponse.json({ error: 'Rider is already on a delivery' }, { status: 400 });
        }

        // Atomic update using transaction
        const [updatedSale, updatedRider] = await prisma.$transaction([
            prisma.sale.update({
                where: { id: saleId },
                data: {
                    orderStatus: 'ON_THE_WAY',
                    riderName: rider.name,
                    dispatchedAt: new Date(),
                },
            }),
            prisma.rider.update({
                where: { id: riderId },
                data: {
                    status: 'ON_DELIVERY',
                },
            }),
        ]);

        return NextResponse.json({ sale: updatedSale, rider: updatedRider });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
