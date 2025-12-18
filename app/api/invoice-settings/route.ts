import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clientId = (session as any).user.clientId as string;
  const setting = await prisma.invoiceSetting.findUnique({
    where: { clientId },
  });
  return NextResponse.json(setting ?? {});
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session as any).user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const clientId = (session as any).user.clientId as string;
  const body = await req.json();
  const setting = await prisma.invoiceSetting.upsert({
    where: { clientId },
    update: body,
    create: { clientId, ...body },
  });
  return NextResponse.json(setting);
}

