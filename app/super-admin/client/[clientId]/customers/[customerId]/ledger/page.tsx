import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import CustomerLedgerView from '@/app/admin/reports/customers/[id]/CustomerLedgerView';

type Props = {
  params: {
    clientId: string;
    customerId: string;
  };
};

export default async function SuperAdminCustomerLedgerPage({ params }: Props) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session?.user?.email || role !== 'SUPER_ADMIN') {
    redirect('/login');
  }

  const client = await prisma.client.findUnique({
    where: { id: params.clientId },
    select: { id: true, businessType: true },
  });

  if (!client || client.businessType !== 'WHOLESALE') {
    notFound();
  }

  const customer = await prisma.customer.findFirst({
    where: { id: params.customerId, clientId: params.clientId },
    select: { id: true, name: true, phone: true, balance: true },
  });

  if (!customer) {
    notFound();
  }

  const entries = await prisma.ledgerEntry.findMany({
    where: {
      clientId: params.clientId,
      customerId: customer.id,
    },
    include: {
      sale: {
        select: {
          id: true,
          orderId: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
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
      }))}
      allowManualPayment={false}
    />
  );
}

