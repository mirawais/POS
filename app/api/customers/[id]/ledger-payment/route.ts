import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { client: { select: { id: true, businessType: true } } },
  });

  if (!user?.clientId || !user.client) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (user.client.businessType !== 'WHOLESALE') {
    return NextResponse.json({ error: 'Ledger payments are only available for wholesale clients' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const amount = Number(body?.amount);
    const note = typeof body?.note === 'string' ? body.note.trim() : '';

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { id: params.id, clientId: user.client!.id },
        select: { id: true, balance: true },
      });

      if (!customer) {
        throw new Error('CUSTOMER_NOT_FOUND');
      }

      const updatedCustomer = await tx.customer.update({
        where: { id: customer.id },
        data: {
          balance: {
            decrement: amount,
          },
        },
        select: {
          id: true,
          balance: true,
        },
      });

      const entry = await tx.ledgerEntry.create({
        data: {
          clientId: user.client!.id,
          customerId: customer.id,
          type: 'PAYMENT',
          amount,
          balance: updatedCustomer.balance,
          note: note || 'Manual payment received',
        },
      });

      return { entry, customer: updatedCustomer };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    if (error?.message === 'CUSTOMER_NOT_FOUND') {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }
    console.error('ledger payment create error', error);
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
  }
}

