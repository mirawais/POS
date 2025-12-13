import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clientId = (session as any).user.clientId as string;
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';
  const where: any = { clientId };
  if (search) {
    where.OR = [{ name: { contains: search, mode: 'insensitive' } }, { sku: { contains: search, mode: 'insensitive' } }];
  }
  const products = await prisma.product.findMany({
    where,
    include: {
      category: true,
      defaultTax: true,
      variants: true,
      materials: { include: { rawMaterial: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(products);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session as any).user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const clientId = (session as any).user.clientId as string;
  const data = await req.json();
  const {
    name,
    sku,
    price,
    costPrice,
    categoryId,
    defaultTaxId,
    type = 'SIMPLE',
    isActive = true,
    stock = 0,
    lowStockAt = null,
    variants = [],
    rawMaterials = [],
  } = data ?? {};
  if (!name || !sku) return NextResponse.json({ error: 'name and sku are required' }, { status: 400 });
  const priceNum = Number(price);
  if (Number.isNaN(priceNum)) return NextResponse.json({ error: 'price must be a number' }, { status: 400 });
  const costNum = costPrice !== undefined && costPrice !== null ? Number(costPrice) : null;
  if (costPrice !== undefined && Number.isNaN(costNum)) return NextResponse.json({ error: 'costPrice must be a number' }, { status: 400 });

  // Handle variants for VARIANT type products
  const variantData =
    type === 'VARIANT' && Array.isArray(variants)
      ? variants
          .map((v: any) => {
            const variantPrice = Number(v.price);
            if (Number.isNaN(variantPrice)) return null;
            const attributes: any = {};
            if (v.color) attributes.color = v.color;
            if (v.size) attributes.size = v.size;
            if (v.weight) attributes.weight = v.weight;
            // Add any custom attributes
            if (v.customAttributes && typeof v.customAttributes === 'object') {
              Object.assign(attributes, v.customAttributes);
            }
            return {
              name: v.name || null,
              sku: v.sku || null,
              price: variantPrice,
              costPrice: v.costPrice !== undefined && v.costPrice !== null ? Number(v.costPrice) : null,
              stock: v.stock !== undefined ? Number(v.stock) || 0 : 0,
              lowStockAt: v.lowStockAt !== undefined && v.lowStockAt !== null ? Number(v.lowStockAt) : null,
              attributes: Object.keys(attributes).length > 0 ? attributes : null,
            };
          })
          .filter((v) => v !== null)
      : [];

  // Handle raw materials for COMPOSITE type products
  const materialData =
    type === 'COMPOSITE' && Array.isArray(rawMaterials)
      ? rawMaterials
          .map((m: any) => ({
            rawMaterialId: m.rawMaterialId,
            quantity: Number(m.quantity) || 1,
            unit: m.unit || 'unit',
          }))
          .filter((m) => m.rawMaterialId && !Number.isNaN(m.quantity))
      : [];

  const created = await prisma.product.create({
    data: {
      name,
      sku,
      price: priceNum as any,
      costPrice: costNum as any,
      categoryId: categoryId || null,
      defaultTaxId: defaultTaxId || null,
      clientId,
      type: type as any,
      isActive,
      stock: stock !== undefined ? Number(stock) || 0 : 0,
      lowStockAt: lowStockAt !== undefined && lowStockAt !== null ? Number(lowStockAt) : null,
      variants: variantData.length ? { create: variantData as any } : undefined,
      materials: materialData.length ? { create: materialData.map((m) => ({ ...m, clientId })) } : undefined,
    },
    include: {
      variants: true,
      materials: { include: { rawMaterial: true } },
    },
  });
  return NextResponse.json(created, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session as any).user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const clientId = (session as any).user.clientId as string;
  const data = await req.json();
  const { id, ...updateData } = data ?? {};
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  // Handle nested updates for variants and materials if provided
  const { variants, rawMaterials, ...simpleFields } = updateData;
  const updatePayload: any = {};
  if (simpleFields.name) updatePayload.name = simpleFields.name;
  if (simpleFields.sku) updatePayload.sku = simpleFields.sku;
  if (simpleFields.price !== undefined) updatePayload.price = Number(simpleFields.price) as any;
  if (simpleFields.costPrice !== undefined) updatePayload.costPrice = simpleFields.costPrice !== null ? (Number(simpleFields.costPrice) as any) : null;
  if (simpleFields.categoryId !== undefined) updatePayload.categoryId = simpleFields.categoryId || null;
  if (simpleFields.defaultTaxId !== undefined) updatePayload.defaultTaxId = simpleFields.defaultTaxId || null;
  if (simpleFields.type) updatePayload.type = simpleFields.type;
  if (simpleFields.isActive !== undefined) updatePayload.isActive = simpleFields.isActive;
  if (simpleFields.stock !== undefined) updatePayload.stock = Number(simpleFields.stock) || 0;
  if (simpleFields.lowStockAt !== undefined) updatePayload.lowStockAt = simpleFields.lowStockAt !== null ? Number(simpleFields.lowStockAt) : null;
  const updated = await prisma.product.update({
    where: { id },
    data: updatePayload,
    include: {
      variants: true,
      materials: { include: { rawMaterial: true } },
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session as any).user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
