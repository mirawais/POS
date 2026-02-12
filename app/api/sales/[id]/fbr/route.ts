import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Proxy function jo aapki cPanel PHP file ko call karegi
async function makeFBRRequest(payload: any, apiUrl: string, authToken: string): Promise<{ status: number; data: any }> {
  // Aapki asli domain ka URL
  const proxyUrl = "https://printingsquad.co.uk/fbr-handler.php";

  const response = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Headers mein dynamic settings bhej rahe hain jo PHP pick kar lega
      'FBR-API-URL': apiUrl,
      'FBR-Bearer-Token': authToken,
    },
    body: JSON.stringify(payload),
  });

  // Response handle karein
  const text = await response.text();
  try {
    const jsonData = JSON.parse(text);
    return { status: response.status, data: jsonData };
  } catch (e) {
    return { status: response.status, data: { rawResponse: text } };
  }
}

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    const user = (session as any)?.user;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const clientId = user.clientId as string;

    // Parse request body for dynamic payment mode
    const body = await req.json().catch(() => ({}));
    const requestPaymentMode = body.paymentMode;

    // Client ki FBR settings fetch karein
    let fbrSetting = await (prisma as any).fBRSetting.findUnique({
      where: { clientId },
    });

    if (!fbrSetting) {
      return NextResponse.json(
        { error: 'FBR settings not configured. Please configure them in Admin panel.' },
        { status: 400 }
      );
    }

    // Sale data fetch karein
    const sale = await (prisma as any).sale.findUnique({
      where: { id: params.id, clientId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
            variant: { select: { id: true, name: true, sku: true } },
          },
        },
      },
    });

    if (!sale) return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    if (sale.fbrInvoiceId) return NextResponse.json({ error: 'FBR Invoice already generated' }, { status: 400 });

    // FBR Payload structure
    const itemData = sale.items.map((item: any) => ({
      ItemCode: item.product.sku || `IT_${item.product.id.substring(0, 8)}`,
      ItemName: item.variant?.name ? `${item.product.name} (${item.variant.name})` : item.product.name,
      Quantity: item.quantity,
      PCTCode: '11001010',
      TaxRate: sale.taxPercent ? Number(sale.taxPercent) : 0.0,
      SaleValue: Number(item.price),
      TotalAmount: Number(item.total),
      TaxCharged: Number(item.tax),
      Discount: Number(item.discount),
      FurtherTax: 0.0,
      InvoiceType: fbrSetting.invoiceType,
      RefUSIN: null,
    }));

    const fbrPayload = {
      InvoiceNumber: sale.orderId,
      POSID: fbrSetting.posId,
      USIN: fbrSetting.usin || 'USIN0',
      DateTime: new Date(sale.createdAt).toISOString(),
      items: itemData,
      TotalBillAmount: Number(sale.total),
      TotalQuantity: itemData.reduce((acc: number, curr: any) => acc + curr.Quantity, 0),
      TotalSaleValue: itemData.reduce((acc: number, curr: any) => acc + curr.TotalAmount, 0),
      TotalTaxCharged: Number(sale.tax),
      Discount: Number(sale.discount),
      PaymentMode: requestPaymentMode || fbrSetting.paymentMode || 2,
      InvoiceType: fbrSetting.invoiceType,
    };

    // Request through Proxy
    const response = await makeFBRRequest(fbrPayload, fbrSetting.url, fbrSetting.bearerToken);

    if (response.status < 200 || response.status >= 300) {
      return NextResponse.json({ error: 'FBR API Error', details: response.data }, { status: response.status });
    }

    const fbrInvoiceId = response.data.USIN || response.data.InvoiceNumber || response.data.id || null;

    if (!fbrInvoiceId) {
      return NextResponse.json({ error: 'FBR ID not received', response: response.data }, { status: 500 });
    }

    // Update database
    const updatedSale = await (prisma as any).sale.update({
      where: { id: params.id },
      data: { fbrInvoiceId },
    });

    return NextResponse.json({ success: true, fbrInvoiceId, sale: updatedSale });

  } catch (e: any) {
    console.error('FBR Proxy Error:', e);
    return NextResponse.json({ error: e?.message ?? 'FBR integration failed' }, { status: 500 });
  }
}