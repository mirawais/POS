import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import CustomerLedgerView from './CustomerLedgerView';

export type CustomerLedgerPageProps = {
  params: {
    id: string;
  };
};

export default async function CustomerLedgerPage({ params }: CustomerLedgerPageProps) {
  const session = await auth();
  if (!session?.user?.email) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { client: { select: { id: true, businessType: true } } },
  });

  if (!user?.clientId || !user.client) redirect('/admin/reports/customers');
  if (user.client.businessType !== 'WHOLESALE') redirect('/admin/reports/customers');

  const customer = await prisma.customer.findFirst({
    where: {
      id: params.id,
      clientId: user.client.id,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      balance: true,
    },
  });

  if (!customer) notFound();

  const entries = await prisma.ledgerEntry.findMany({
    where: {
      clientId: user.client.id,
      customerId: customer.id,
    },
    include: {
      sale: {
        select: {
          id: true,
          orderId: true,
          total: true, // Add total
          amountReceived: true, // Add amountReceived
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return (
    <CustomerLedgerView
      customer={{
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        balance: Number(customer.balance),
      }}
      entries={entries.map((entry) => ({
        id: entry.id,
        type: entry.type,
        saleId: entry.saleId,
        reference: entry.sale?.orderId || entry.saleId || '-',
        amount: Number(entry.amount),
        balance: Number(entry.balance),
        note: entry.note,
        createdAt: entry.createdAt.toISOString(),
        sale: entry.sale // Pass the entire sale object
          ? {
              total: Number(entry.sale.total),
              amountReceived: Number(entry.sale.amountReceived),
            }
          : undefined, // Or null, depending on desired strictness
      }))}
    />
  );
}


