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
  const user = (session as any).user;
  const isManager = user.role === 'MANAGER';
  const permissions = user.permissions || {};

  if (user.role !== 'ADMIN' && !(isManager && permissions.manage_settings)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
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
  const user = (session as any).user;
  const isManager = user.role === 'MANAGER';
  const permissions = user.permissions || {};

  if (user.role !== 'ADMIN' && !(isManager && permissions.manage_settings)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const clientId = (session as any).user.clientId as string;
  const body = await req.json();
  const { id, name, percent, isActive, setDefault } = body ?? {};
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  // Verify tax belongs to client
  const existing = await prisma.taxSetting.findUnique({ where: { id } });
  if (!existing || existing.clientId !== clientId) {
    return NextResponse.json({ error: 'Tax not found' }, { status: 404 });
  }

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

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = (session as any).user;
  const isManager = user.role === 'MANAGER';
  const permissions = user.permissions || {};

  if (user.role !== 'ADMIN' && !(isManager && permissions.manage_settings)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const clientId = (session as any).user.clientId as string;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

  // Verify tax belongs to client
  const existing = await prisma.taxSetting.findUnique({ where: { id } });
  if (!existing || existing.clientId !== clientId) {
    return NextResponse.json({ error: 'Tax not found' }, { status: 404 });
  }

  try {
    // Check if tax is used by any products
    const productsUsingTax = await prisma.product.count({
      where: { defaultTaxId: id },
    });

    if (productsUsingTax > 0) {
      return NextResponse.json(
        { error: `Cannot delete tax. This tax is assigned to ${productsUsingTax} product(s). Please reassign or remove the tax from these products first.` },
        { status: 400 }
      );
    }

    await prisma.taxSetting.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Tax deletion error:', e);
    return NextResponse.json({ error: e?.message ?? 'Failed to delete tax' }, { status: 500 });
  }
}

