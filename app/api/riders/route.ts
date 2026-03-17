import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = (session as any).user;
  let clientId = user.clientId;
  const { searchParams } = new URL(req.url);

  if (user.role === 'SUPER_ADMIN') {
    const targetClient = searchParams.get('clientId');
    if (targetClient) clientId = targetClient;
  }

  const where: any = {};
  if (clientId) {
    where.clientId = clientId;
  }

  const search = searchParams.get('search') || '';
  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }

  const riders = await prisma.rider.findMany({
    where,
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(riders);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = (session as any).user;
  // Restricted to Restaurant clients as per requirements
  if (user.businessType !== 'RESTAURANT' && user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Feature only available for Restaurant clients' }, { status: 403 });
  }

  if (!['ADMIN', 'SUPER_ADMIN', 'CASHIER'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let clientId = user.clientId;
  const body = await req.json();

  if (user.role === 'SUPER_ADMIN') {
    if (!body.clientId) return NextResponse.json({ error: 'Super Admin must specify clientId' }, { status: 400 });
    clientId = body.clientId;
  }

  const { name, phone, idCard } = body ?? {};
  if (!name || !phone) {
    return NextResponse.json({ error: 'Name and Phone are required' }, { status: 400 });
  }

  const rider = await prisma.rider.create({
    data: { name, phone, idCard, clientId },
  });
  return NextResponse.json(rider, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = (session as any).user;
  if (!['ADMIN', 'SUPER_ADMIN', 'CASHIER'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { id, name, phone, idCard, status } = body ?? {};
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const existingRider = await prisma.rider.findUnique({ where: { id } });
  if (!existingRider) return NextResponse.json({ error: 'Rider not found' }, { status: 404 });

  if (user.role !== 'SUPER_ADMIN' && existingRider.clientId !== user.clientId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const updated = await prisma.rider.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(phone ? { phone } : {}),
      ...(idCard !== undefined ? { idCard } : {}),
      ...(status ? { status } : {}),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = (session as any).user;
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const existingRider = await prisma.rider.findUnique({ where: { id } });
  if (!existingRider) return NextResponse.json({ error: 'Rider not found' }, { status: 404 });

  if (user.role !== 'SUPER_ADMIN' && existingRider.clientId !== user.clientId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.rider.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
