import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clientId = (session as any).user.clientId as string;
  const taxes = await prisma.taxSetting.findMany({
    where: { clientId },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  });
  return NextResponse.json(taxes);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session as any).user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const clientId = (session as any).user.clientId as string;
  const body = await req.json();
  const { name, percent, isDefault = false, isActive = true } = body ?? {};
  if (!name || typeof name !== 'string') return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  const percentNum = Number(percent);
  if (Number.isNaN(percentNum)) return NextResponse.json({ error: 'Percent must be a number' }, { status: 400 });
  if (isDefault) {
    await prisma.taxSetting.updateMany({ where: { clientId }, data: { isDefault: false } });
  }
  const created = await prisma.taxSetting.create({
    data: { name, percent: percentNum as any, isDefault, isActive, clientId },
  });
  return NextResponse.json(created, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session as any).user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const clientId = (session as any).user.clientId as string;
  const body = await req.json();
  const { id, name, percent, isActive, setDefault } = body ?? {};
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  if (setDefault) {
    await prisma.taxSetting.updateMany({ where: { clientId }, data: { isDefault: false } });
  }
  const data: any = {};
  if (typeof name === 'string') data.name = name;
  if (percent !== undefined) {
    const p = Number(percent);
    if (Number.isNaN(p)) return NextResponse.json({ error: 'Percent must be a number' }, { status: 400 });
    data.percent = p as any;
  }
  if (typeof isActive === 'boolean') data.isActive = isActive;
  if (setDefault) data.isDefault = true;
  const updated = await prisma.taxSetting.update({ where: { id }, data });
  return NextResponse.json(updated);
}

