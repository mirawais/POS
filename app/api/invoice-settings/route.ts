import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  const user = (session as any)?.user;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let clientId = user.clientId as string;
  const { searchParams } = new URL(req.url);

  if (user.role === 'SUPER_ADMIN') {
    const targetClient = searchParams.get('clientId');
    if (targetClient) clientId = targetClient;
  }

  if (!clientId) return NextResponse.json({});

  const setting = await prisma.invoiceSetting.findUnique({
    where: { clientId },
  });
  return NextResponse.json(setting ?? {});
}

export async function POST(req: Request) {
  const session = await auth();
  const user = (session as any).user;
  const isManager = user.role === 'MANAGER';
  const permissions = user.permissions || {};

  if (user.role !== 'ADMIN' && !(isManager && permissions.manage_settings)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const clientId = (session as any).user.clientId as string;
  const body = await req.json();
  const {
    logoUrl,
    headerText,
    footerText,
    showTax,
    showDiscount,
    showCashier,
    showCustomer,
    customFields,
    taxMode,
    fontSize,
    showPriceDecimals,
    dayClosingTime,
  } = body;

  // Validate font size
  let validFontSize = Number(fontSize);
  if (isNaN(validFontSize) || validFontSize < 8) validFontSize = 8;
  if (validFontSize > 20) validFontSize = 20;

  // Validate and sort custom fields
  let processedCustomFields = null;
  if (customFields && Array.isArray(customFields) && customFields.length > 0) {
    // Filter out empty fields and sort by sortOrder
    processedCustomFields = customFields
      .filter((f: any) => f.label && f.value)
      .map((f: any) => ({
        label: String(f.label).trim(),
        value: String(f.value).trim(),
        sortOrder: Number(f.sortOrder) || 0,
      }))
      .sort((a: any, b: any) => a.sortOrder - b.sortOrder);

    if (processedCustomFields.length === 0) {
      processedCustomFields = null;
    }
  }

  const setting = await prisma.invoiceSetting.upsert({
    where: { clientId },
    update: {
      logoUrl: logoUrl || null,
      headerText: headerText || null,
      footerText: footerText || null,
      showTax: showTax !== false,
      showDiscount: showDiscount !== false,
      showCashier: showCashier !== false,
      showCustomer: showCustomer !== false,
      customFields: processedCustomFields as any,
      taxMode: taxMode === 'INCLUSIVE' ? 'INCLUSIVE' : 'EXCLUSIVE',
      fontSize: validFontSize,
      showPriceDecimals: showPriceDecimals !== false,
      dayClosingTime: dayClosingTime || null,
    },
    create: {
      clientId,
      logoUrl: logoUrl || null,
      headerText: headerText || null,
      footerText: footerText || null,
      showTax: showTax !== false,
      showDiscount: showDiscount !== false,
      showCashier: showCashier !== false,
      showCustomer: showCustomer !== false,
      customFields: processedCustomFields as any,
      taxMode: taxMode === 'INCLUSIVE' ? 'INCLUSIVE' : 'EXCLUSIVE',
      fontSize: validFontSize,
      showPriceDecimals: showPriceDecimals !== false,
      dayClosingTime: dayClosingTime || null,
    },
  });
  return NextResponse.json(setting);
}

