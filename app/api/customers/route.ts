import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (!user.clientId) {
    return NextResponse.json({ error: 'User has no associated client' }, { status: 403 });
  }

  const customers = await prisma.customer.findMany({
    where: { clientId: user.clientId },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(customers);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (!user.clientId) return NextResponse.json({ error: 'User has no associated client' }, { status: 403 });

  try {
    const { name, phone, email, address, openingBalance } = await req.json();

    if (!name || !phone) {
      return NextResponse.json({ error: 'Name and Phone are required' }, { status: 400 });
    }

    const customer = await prisma.$transaction(async (tx) => {
      // Create the customer
      const newCustomer = await tx.customer.create({
        data: {
          clientId: user.clientId as string,
          name,
          phone,
          email: email || null,
          address: address || null,
          balance: Number(openingBalance || 0),
        },
      });

      // If there is an opening balance, create the first ledger entry
      if (openingBalance && Number(openingBalance) !== 0) {
        await tx.ledgerEntry.create({
          data: {
            clientId: user.clientId as string,
            customerId: newCustomer.id,
            type: 'OPENING_BALANCE',
            amount: Math.abs(Number(openingBalance)),
            balance: Number(openingBalance),
            note: 'Initial opening balance',
          },
        });
      }

      return newCustomer;
    });

    return NextResponse.json(customer);
  } catch (error: any) {
    console.error('Customer Creation Error:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'A customer with this phone number already exists for your business.' }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Failed to create customer' }, { status: 500 });
  }
}
