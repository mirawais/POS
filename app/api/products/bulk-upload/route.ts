import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import Papa from 'papaparse';

export const dynamic = "force-dynamic";

interface SimpleProductRow {
  name: string;
  sku: string;
  price: string;
  costPrice?: string;
  stock: string;
  category?: string;
  tax?: string;
  lowStockAt?: string;
}

interface VariantProductRow {
  name: string;
  sku: string;
  attributes: string; // JSON string or comma-separated like "Color:Red,Size:L"
  price: string;
  costPrice?: string;
  stock: string;
  category?: string;
  tax?: string;
  variantName?: string;
  variantSku?: string;
  lowStockAt?: string;
}

interface CompoundProductRow {
  name: string;
  sku: string;
  rawMaterials: string; // JSON string or format like "MaterialSKU1:Qty1:Unit1,MaterialSKU2:Qty2:Unit2"
  price: string;
  costPrice?: string;
  category?: string;
  tax?: string;
  lowStockAt?: string;
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session || !(session as any).user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if ((session as any).user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const clientId = (session as any).user.clientId as string;

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const productType = formData.get('productType') as string;

    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    if (!['SIMPLE', 'VARIANT', 'COMPOSITE'].includes(productType)) {
      return NextResponse.json({ error: 'Invalid product type' }, { status: 400 });
    }

    const text = await file.text();
    const parseResult = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    if (parseResult.errors.length > 0) {
      return NextResponse.json({
        error: 'CSV parsing errors',
        details: parseResult.errors.map((e) => `Row ${e.row}: ${e.message}`),
      }, { status: 400 });
    }

    const errors: string[] = [];
    const created: string[] = [];
    const rows = parseResult.data as any[];

    // Get all categories and taxes for lookup
    const [allCategories, allTaxes] = await Promise.all([
      prisma.category.findMany({ where: { clientId } }),
      prisma.taxSetting.findMany({ where: { clientId, isActive: true } }),
    ]);

    const categoryMap = new Map(allCategories.map((c) => [c.name.toLowerCase(), c.id]));
    const taxMap = new Map(allTaxes.map((t) => [t.name.toLowerCase(), t.id]));

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 because row 1 is header, and arrays are 0-indexed

      try {
        if (productType === 'SIMPLE') {
          const data = row as SimpleProductRow;
          
          // Validation
          if (!data.name || !data.sku) {
            errors.push(`Row ${rowNum}: Name and SKU are required`);
            continue;
          }

          const price = Number(data.price);
          if (Number.isNaN(price) || price <= 0) {
            errors.push(`Row ${rowNum}: Invalid price`);
            continue;
          }

          const costPrice = data.costPrice ? Number(data.costPrice) : null;
          if (data.costPrice && (costPrice === null || Number.isNaN(costPrice) || costPrice < 0)) {
            errors.push(`Row ${rowNum}: Invalid cost price`);
            continue;
          }

          const stock = Number(data.stock) || 0;
          const lowStockAt = data.lowStockAt ? Number(data.lowStockAt) : null;

          // Check for duplicate SKU
          const existing = await prisma.product.findFirst({
            where: { clientId, sku: data.sku.trim() },
          });
          if (existing) {
            errors.push(`Row ${rowNum}: SKU "${data.sku}" already exists`);
            continue;
          }

          // Find category and tax
          const categoryId = data.category
            ? categoryMap.get(data.category.toLowerCase()) || null
            : null;
          const defaultTaxId = data.tax
            ? taxMap.get(data.tax.toLowerCase()) || null
            : null;

          await prisma.product.create({
            data: {
              name: data.name.trim(),
              sku: data.sku.trim(),
              price: price as any,
              costPrice: costPrice as any,
              stock,
              lowStockAt,
              categoryId,
              defaultTaxId,
              clientId,
              type: 'SIMPLE',
              isActive: true,
            },
          });

          created.push(`Row ${rowNum}: ${data.name}`);
        } else if (productType === 'VARIANT') {
          const data = row as VariantProductRow;
          
          if (!data.name || !data.sku) {
            errors.push(`Row ${rowNum}: Name and SKU are required`);
            continue;
          }

          const price = Number(data.price);
          if (Number.isNaN(price) || price <= 0) {
            errors.push(`Row ${rowNum}: Invalid price`);
            continue;
          }

          const costPrice = data.costPrice ? Number(data.costPrice) : null;
          if (data.costPrice && (costPrice === null || Number.isNaN(costPrice) || costPrice < 0)) {
            errors.push(`Row ${rowNum}: Invalid cost price`);
            continue;
          }

          const stock = Number(data.stock) || 0;
          const lowStockAt = data.lowStockAt ? Number(data.lowStockAt) : null;

          // Parse attributes
          let attributes: Record<string, string> = {};
          if (data.attributes) {
            try {
              // Try JSON first
              if (data.attributes.trim().startsWith('{')) {
                attributes = JSON.parse(data.attributes);
              } else {
                // Parse comma-separated format: "Color:Red,Size:L"
                const pairs = data.attributes.split(',');
                for (const pair of pairs) {
                  const [key, value] = pair.split(':').map((s) => s.trim());
                  if (key && value) attributes[key] = value;
                }
              }
            } catch (e) {
              errors.push(`Row ${rowNum}: Invalid attributes format`);
              continue;
            }
          }

          if (Object.keys(attributes).length === 0) {
            errors.push(`Row ${rowNum}: At least one attribute is required for variant products`);
            continue;
          }

          // Check for duplicate SKU
          const existing = await prisma.product.findFirst({
            where: { clientId, sku: data.sku.trim() },
          });
          if (existing) {
            errors.push(`Row ${rowNum}: SKU "${data.sku}" already exists`);
            continue;
          }

          const categoryId = data.category
            ? categoryMap.get(data.category.toLowerCase()) || null
            : null;
          const defaultTaxId = data.tax
            ? taxMap.get(data.tax.toLowerCase()) || null
            : null;

          await prisma.product.create({
            data: {
              name: data.name.trim(),
              sku: data.sku.trim(),
              price: price as any,
              costPrice: costPrice as any,
              stock,
              lowStockAt,
              categoryId,
              defaultTaxId,
              clientId,
              type: 'VARIANT',
              isActive: true,
              variants: {
                create: {
                  name: data.variantName || null,
                  sku: data.variantSku || null,
                  price: price,
                  costPrice: costPrice,
                  stock: stock,
                  lowStockAt: lowStockAt,
                  attributes: attributes,
                },
              },
            },
          });

          created.push(`Row ${rowNum}: ${data.name}`);
        } else if (productType === 'COMPOSITE') {
          const data = row as CompoundProductRow;
          
          if (!data.name || !data.sku) {
            errors.push(`Row ${rowNum}: Name and SKU are required`);
            continue;
          }

          const price = Number(data.price);
          if (Number.isNaN(price) || price <= 0) {
            errors.push(`Row ${rowNum}: Invalid price`);
            continue;
          }

          const costPrice = data.costPrice ? Number(data.costPrice) : null;
          if (data.costPrice && (costPrice === null || Number.isNaN(costPrice) || costPrice < 0)) {
            errors.push(`Row ${rowNum}: Invalid cost price`);
            continue;
          }

          if (!data.rawMaterials) {
            errors.push(`Row ${rowNum}: Raw materials are required for compound products`);
            continue;
          }

          // Parse raw materials
          let materials: Array<{ rawMaterialId: string; quantity: number; unit: string }> = [];
          let materialErrors: string[] = [];
          try {
            // Try JSON first
            if (data.rawMaterials.trim().startsWith('[')) {
              const parsed = JSON.parse(data.rawMaterials);
              if (Array.isArray(parsed)) {
                for (const item of parsed) {
                  if (item.sku || item.rawMaterialSku) {
                    const sku = item.sku || item.rawMaterialSku;
                    const material = await prisma.rawMaterial.findFirst({
                      where: { clientId, sku },
                    });
                    if (!material) {
                      materialErrors.push(`Raw material with SKU "${sku}" not found`);
                    } else {
                      materials.push({
                        rawMaterialId: material.id,
                        quantity: Number(item.quantity) || 1,
                        unit: item.unit || 'unit',
                      });
                    }
                  }
                }
              }
            } else {
              // Parse format: "MaterialSKU1:Qty1:Unit1,MaterialSKU2:Qty2:Unit2"
              const pairs = data.rawMaterials.split(',');
              for (const pair of pairs) {
                const parts = pair.split(':').map((s) => s.trim());
                if (parts.length >= 2) {
                  const sku = parts[0];
                  const material = await prisma.rawMaterial.findFirst({
                    where: { clientId, sku },
                  });
                  if (!material) {
                    materialErrors.push(`Raw material with SKU "${sku}" not found`);
                  } else {
                    materials.push({
                      rawMaterialId: material.id,
                      quantity: Number(parts[1]) || 1,
                      unit: parts[2] || 'unit',
                    });
                  }
                }
              }
            }
          } catch (e) {
            errors.push(`Row ${rowNum}: Invalid raw materials format`);
            continue;
          }

          if (materialErrors.length > 0) {
            errors.push(`Row ${rowNum}: ${materialErrors.join(', ')}`);
            continue;
          }

          if (materials.length === 0) {
            errors.push(`Row ${rowNum}: At least one raw material is required`);
            continue;
          }

          // Check for duplicate SKU
          const existing = await prisma.product.findFirst({
            where: { clientId, sku: data.sku.trim() },
          });
          if (existing) {
            errors.push(`Row ${rowNum}: SKU "${data.sku}" already exists`);
            continue;
          }

          const categoryId = data.category
            ? categoryMap.get(data.category.toLowerCase()) || null
            : null;
          const defaultTaxId = data.tax
            ? taxMap.get(data.tax.toLowerCase()) || null
            : null;
          const lowStockAt = data.lowStockAt ? Number(data.lowStockAt) : null;

          await prisma.product.create({
            data: {
              name: data.name.trim(),
              sku: data.sku.trim(),
              price: price as any,
              costPrice: costPrice as any,
              categoryId,
              defaultTaxId,
              lowStockAt,
              clientId,
              type: 'COMPOSITE',
              isActive: true,
              materials: {
                create: materials.map((m) => ({ ...m, clientId })),
              },
            },
          });

          created.push(`Row ${rowNum}: ${data.name}`);
        }
      } catch (e: any) {
        errors.push(`Row ${rowNum}: ${e.message || 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      created: created.length,
      errors: errors.length,
      details: {
        created,
        errors,
      },
    });
  } catch (e: any) {
    console.error('Bulk upload error:', e);
    return NextResponse.json({ error: e?.message || 'Bulk upload failed' }, { status: 500 });
  }
}

