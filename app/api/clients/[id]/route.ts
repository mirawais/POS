import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";

export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    const session = await auth();
    if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = (session as any).user;
    // Only Super Admin can view specific client details via this route, 
    // OR the client admin themselves (but currently focused on Super Admin usage).
    if (user.role !== 'SUPER_ADMIN') {
        // If we want to allow admins to see their own details:
        if (user.clientId !== params.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
    }

    const client = await prisma.client.findUnique({
        where: { id: params.id },
        include: {
            _count: {
                select: { users: true, products: true, sales: true }
            }
        }
    });

    if (!client) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json(client);
}

export async function PATCH(
    req: Request,
    { params }: { params: { id: string } }
) {
    const session = await auth();
    if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = (session as any).user;
    if (user.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { name, companyName, contactNumber, techContact, email, address, isActive, activeDate, inactiveDate } = body;

    try {
        const client = await prisma.client.update({
            where: { id: params.id },
            data: {
                name,
                companyName,
                contactNumber,
                techContact,
                email,
                address,
                isActive: isActive !== undefined ? isActive : undefined,
                activeDate: activeDate ? new Date(activeDate) : undefined,
                inactiveDate: inactiveDate === null ? null : (inactiveDate ? new Date(inactiveDate) : undefined),
            }
        });

        return NextResponse.json(client);
    } catch (e: any) {
        console.error("Update client error", e);
        return NextResponse.json({ error: "Failed to update client" }, { status: 500 });
    }
}
