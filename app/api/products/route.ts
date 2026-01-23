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

  // Super Admin Logic: Allow impersonation or view all
  if (user.role === 'SUPER_ADMIN') {
    const targetClient = searchParams.get('clientId');
    if (targetClient) clientId = targetClient;
    // If no clientId is set here, clientId remains null, so we won't filter by it (view all)
  }

  const search = searchParams.get('search') || '';
  const where: any = {};

  if (clientId) {
    where.clientId = clientId;
  }

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
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = (session as any).user;
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let clientId = user.clientId;
  const data = await req.json();

  // Super Admin must specify target client
  if (user.role === 'SUPER_ADMIN') {
    if (!data.clientId) return NextResponse.json({ error: 'Super Admin must specify clientId' }, { status: 400 });
    clientId = data.clientId;
  }

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
    isFavorite = false,
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
          // Apply default price if variant price is 0 or not set
          let variantPrice = Number(v.price) || 0;
          if (variantPrice === 0 || Number.isNaN(variantPrice)) {
            variantPrice = priceNum; // Use product default price
          }

          // Apply default cost price if variant cost price is not set
          let variantCostPrice: number | null = null;
          if (v.costPrice !== undefined && v.costPrice !== null && v.costPrice !== '') {
            variantCostPrice = Number(v.costPrice);
          } else if (costNum !== null) {
            variantCostPrice = costNum; // Use product default cost price
          }

          // Handle attributes (now comes as an object directly)
          const attributes: any = v.attributes || {};
          // Legacy support for old format
          if (v.color) attributes.color = v.color;
          if (v.size) attributes.size = v.size;
          if (v.weight) attributes.weight = v.weight;
          if (v.customAttributes && typeof v.customAttributes === 'object') {
            Object.assign(attributes, v.customAttributes);
          }

          return {
            name: v.name || null,
            sku: v.sku || null,
            price: variantPrice,
            costPrice: variantCostPrice,
            stock: v.stock !== undefined ? Number(v.stock) || 0 : 0,
            lowStockAt: v.lowStockAt !== undefined && v.lowStockAt !== null ? Number(v.lowStockAt) : null,
            attributes: Object.keys(attributes).length > 0 ? attributes : null,
          };
        })
        .filter((v) => v !== null && v.price > 0) // Ensure price is valid
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
      isFavorite,
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
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
  if (simpleFields.isFavorite !== undefined) updatePayload.isFavorite = simpleFields.isFavorite;
  if (simpleFields.stock !== undefined) updatePayload.stock = Number(simpleFields.stock) || 0;
  if (simpleFields.lowStockAt !== undefined) updatePayload.lowStockAt = simpleFields.lowStockAt !== null ? Number(simpleFields.lowStockAt) : null;

  // Get current product to use defaults for variants
  const currentProduct = await prisma.product.findUnique({
    where: { id },
    select: { price: true, costPrice: true },
  });
  const defaultPrice = currentProduct ? Number(currentProduct.price) : (simpleFields.price !== undefined ? Number(simpleFields.price) : 0);
  const defaultCostPrice = currentProduct?.costPrice ? Number(currentProduct.costPrice) : (simpleFields.costPrice !== undefined && simpleFields.costPrice !== null ? Number(simpleFields.costPrice) : null);

  // Handle variant updates with default price application
  if (Array.isArray(variants)) {
    // Delete all existing variants and recreate (simpler than upsert logic)
    await (prisma as any).productVariant.deleteMany({ where: { productId: id } });
    if (variants.length > 0) {
      const variantData = variants.map((v: any) => {
        // Apply default price if variant price is 0 or not set
        let variantPrice = Number(v.price) || 0;
        if (variantPrice === 0 || Number.isNaN(variantPrice)) {
          variantPrice = defaultPrice;
        }

        // Apply default cost price if variant cost price is not set
        let variantCostPrice: number | null = null;
        if (v.costPrice !== undefined && v.costPrice !== null && v.costPrice !== '') {
          variantCostPrice = Number(v.costPrice);
        } else if (defaultCostPrice !== null) {
          variantCostPrice = defaultCostPrice;
        }

        const attributes: any = v.attributes || {};
        return {
          productId: id,
          name: v.name || null,
          sku: v.sku || null,
          price: variantPrice,
          costPrice: variantCostPrice,
          stock: v.stock !== undefined ? Number(v.stock) || 0 : 0,
          lowStockAt: v.lowStockAt !== undefined && v.lowStockAt !== null ? Number(v.lowStockAt) : null,
          attributes: Object.keys(attributes).length > 0 ? attributes : null,
        };
      }).filter((v: any) => v.price > 0);

      if (variantData.length > 0) {
        updatePayload.variants = { create: variantData };
      }
    }
  }

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
  if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((session as any).user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
