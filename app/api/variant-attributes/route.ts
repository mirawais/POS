import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await auth();
    const user = (session as any)?.user;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const clientId = user.clientId as string;

    const attributes = await (prisma as any).variantAttribute.findMany({
      where: { clientId },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(attributes);
  } catch (e: any) {
    console.error('variant-attributes GET error', e);
    return NextResponse.json({ error: e?.message ?? 'Failed to fetch attributes' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    const user = (session as any)?.user;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const isManager = user.role === 'MANAGER';
    const permissions = user.permissions || {};
    if (user.role !== 'ADMIN' && !(isManager && (permissions.manage_settings || permissions.manage_products))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const clientId = user.clientId as string;

    const body = await req.json();
    const { name, values } = body;
    if (!name || !Array.isArray(values) || values.length === 0) {
      return NextResponse.json({ error: 'name and values array are required' }, { status: 400 });
    }

    // Check for duplicate name
    const existing = await (prisma as any).variantAttribute.findFirst({
      where: { clientId, name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) {
      return NextResponse.json({ error: 'Attribute with this name already exists' }, { status: 409 });
    }

    const attribute = await (prisma as any).variantAttribute.create({
      data: {
        clientId,
        name,
        values: values as any,
      },
    });

    return NextResponse.json(attribute, { status: 201 });
  } catch (e: any) {
    console.error('variant-attributes POST error', e);
    return NextResponse.json({ error: e?.message ?? 'Failed to create attribute' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    const user = (session as any)?.user;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const isManager = user.role === 'MANAGER';
    const permissions = user.permissions || {};
    if (user.role !== 'ADMIN' && !(isManager && (permissions.manage_settings || permissions.manage_products))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const clientId = user.clientId as string;

    const body = await req.json();
    const { id, name, values } = body;
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    if (name) {
      const existing = await (prisma as any).variantAttribute.findFirst({
        where: { clientId, name: { equals: name, mode: 'insensitive' }, id: { not: id } },
      });
      if (existing) {
        return NextResponse.json({ error: 'Attribute with this name already exists' }, { status: 409 });
      }
    }

    const updated = await (prisma as any).variantAttribute.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(Array.isArray(values) && { values: values as any }),
      },
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    console.error('variant-attributes PATCH error', e);
    return NextResponse.json({ error: e?.message ?? 'Failed to update attribute' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth();
    const user = (session as any)?.user;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const isManager = user.role === 'MANAGER';
    const permissions = user.permissions || {};
    if (user.role !== 'ADMIN' && !(isManager && (permissions.manage_settings || permissions.manage_products))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    await (prisma as any).variantAttribute.delete({ where: { id } });
    return NextResponse.json({ message: 'Attribute deleted' });
  } catch (e: any) {
    console.error('variant-attributes DELETE error', e);
    return NextResponse.json({ error: e?.message ?? 'Failed to delete attribute' }, { status: 500 });
  }
}

