import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    const user = (session as any)?.user;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const clientId = user.clientId as string;

    let setting = await (prisma as any).fBRSetting.findUnique({
      where: { clientId },
    });

    // If no setting exists, return defaults
    if (!setting) {
      setting = {
        id: '',
        clientId,
        url: 'https://esp.fbr.gov.pk:8244/FBR/v1/api/Live/PostData',
        bearerToken: '',
        posId: '',
        usin: 'USIN0',
        paymentMode: 2,
        invoiceType: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;
    }

    // Don't return the bearer token in full for security (return masked version)
    const safeSetting = {
      ...setting,
      bearerToken: setting.bearerToken ? `${setting.bearerToken.substring(0, 10)}...` : '',
    };

    return NextResponse.json(safeSetting);
  } catch (e: any) {
    console.error('FBR settings GET error:', e);
    return NextResponse.json({ error: e?.message ?? 'Failed to fetch FBR settings' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    const user = (session as any)?.user;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const clientId = user.clientId as string;

    const body = await req.json();
    const { url, bearerToken, posId, usin, paymentMode, invoiceType } = body ?? {};

    if (!url || !bearerToken || !posId) {
      return NextResponse.json({ error: 'URL, Bearer Token, and POS ID are required' }, { status: 400 });
    }

    // Check if setting exists
    const existing = await (prisma as any).fBRSetting.findUnique({
      where: { clientId },
    });

    const settingData = {
      clientId,
      url,
      bearerToken,
      posId,
      usin: usin || 'USIN0',
      paymentMode: paymentMode ? Number(paymentMode) : 2,
      invoiceType: invoiceType ? Number(invoiceType) : 1,
    };

    const setting = existing
      ? await (prisma as any).fBRSetting.update({
          where: { clientId },
          data: settingData,
        })
      : await (prisma as any).fBRSetting.create({
          data: settingData,
        });

    // Return setting without full bearer token
    const safeSetting = {
      ...setting,
      bearerToken: `${setting.bearerToken.substring(0, 10)}...`,
    };

    return NextResponse.json(safeSetting, { status: existing ? 200 : 201 });
  } catch (e: any) {
    console.error('FBR settings POST error:', e);
    return NextResponse.json({ error: e?.message ?? 'Failed to save FBR settings' }, { status: 500 });
  }
}

