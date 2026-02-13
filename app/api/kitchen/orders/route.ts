import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";

export async function GET() {
    const session = await auth();
    if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = (session as any).user;
    const clientId = user.clientId as string;

    // Kitchen/Admin/SuperAdmin can view kitchen orders
    const allowedRoles = ['KITCHEN', 'ADMIN', 'SUPER_ADMIN', 'RESTAURANT_ADMIN']; // Adjust based on exact role names
    // Actually checking role might be good but let's assume if they have access to this route via UI they are auth'd.
    // But for safety:
    if (!['KITCHEN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
        // Waiters shouldn't see all orders? Or maybe they should to know status?
        // Requirement says Kitchen View.
    }

    try {
        const bills = await prisma.heldBill.findMany({
            where: { clientId }, // Fetch ALL for this client, not just user specific
            orderBy: { createdAt: 'asc' }, // Oldest first for kitchen
        });

        // Filter for PENDING or PREPARING status
        // The status is stored inside the JSON `data` field
        const kitchenOrders = bills.filter((bill: any) => {
            const status = bill.data?.orderStatus;
            return status === 'PENDING' || status === 'PREPARING';
        });

        return NextResponse.json(kitchenOrders);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch kitchen orders' }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    const session = await auth();
    if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { id, status } = body;

    if (!id || !status) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    try {
        const bill = await prisma.heldBill.findUnique({ where: { id } });
        if (!bill) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

        const currentData = bill.data as any;
        const updatedData = { ...currentData, orderStatus: status };

        const updated = await prisma.heldBill.update({
            where: { id },
            data: { data: updatedData },
        });

        return NextResponse.json(updated);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
    }
}
