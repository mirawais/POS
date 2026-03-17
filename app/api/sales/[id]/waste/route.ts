import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const WASTE_REASONS = [
    'Kitchen Accident',
    'Waiter Mishap',
    'Rider Accident',
    'Customer Refused',
    'Other',
];

export async function POST(req: Request, { params }: { params: { id: string } }) {
    const session = await auth();
    if (!session || !(session as any).user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = (session as any).user;

    // Restaurant-only guard
    if (user.businessType !== 'RESTAURANT') {
        return NextResponse.json({ error: 'Feature only available for Restaurant clients' }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();
    const { wasteReason } = body;

    if (!wasteReason || !WASTE_REASONS.includes(wasteReason)) {
        return NextResponse.json({ error: 'Valid wasteReason is required' }, { status: 400 });
    }

    try {
        const sale = await prisma.sale.findFirst({
            where: { id, clientId: user.clientId },
        });

        if (!sale) {
            return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
        }

        // Update the sale
        const updated = await prisma.sale.update({
            where: { id },
            data: {
                orderStatus: 'WASTED',
                wasteReason,
                wastedAt: new Date(),
            },
        });

        // If a rider was assigned (order was dispatched), increment their failedDeliveries
        if (sale.riderName) {
            await prisma.rider.updateMany({
                where: {
                    clientId: user.clientId,
                    name: sale.riderName,
                },
                data: {
                    failedDeliveries: { increment: 1 },
                    status: 'FREE', // Free up the rider
                },
            });
        }

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Waste sale error:', error);
        return NextResponse.json({ error: 'Failed to mark sale as wasted' }, { status: 500 });
    }
}
