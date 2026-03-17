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
    const { saleId } = body;

    if (!saleId) {
        return NextResponse.json({ error: 'Sale ID is required' }, { status: 400 });
    }

    try {
        const sale = await prisma.sale.findUnique({ where: { id: saleId } });
        if (!sale) return NextResponse.json({ error: 'Sale not found' }, { status: 404 });

        if (!sale.riderName) {
            return NextResponse.json({ error: 'No rider assigned to this sale' }, { status: 400 });
        }

        const rider = await prisma.rider.findFirst({
            where: {
                name: sale.riderName,
                clientId: sale.clientId, // Ensure we find the right rider by name and client
            },
        });

        // Atomic update using transaction
        const updateOperations: any[] = [
            prisma.sale.update({
                where: { id: saleId },
                data: {
                    orderStatus: 'COMPLETED',
                    deliveredAt: new Date(),
                },
            }),
        ];

        if (rider) {
            updateOperations.push(
                prisma.rider.update({
                    where: { id: rider.id },
                    data: {
                        status: 'FREE',
                    },
                })
            );
        }

        const results = await prisma.$transaction(updateOperations);

        return NextResponse.json({ success: true, results });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
