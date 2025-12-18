import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import https from 'https';
import { URL } from 'url';

export const dynamic = "force-dynamic";

// Helper function to make HTTPS request with SSL verification disabled
async function makeFBRRequest(payload: any, apiUrl: string, authToken: string): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(apiUrl);
    const postData = JSON.stringify(payload);

    const options = {
      hostname: url.hostname,
      port: url.port || 8244,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
      // Disable SSL verification (equivalent to cURL SSL_VERIFYHOST=0, SSL_VERIFYPEER=0)
      rejectUnauthorized: false,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode || 500, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode || 500, data: { rawResponse: data } });
        }
      });
    });

    req.on('error', (error) => {
      console.error('FBR HTTPS Request Error:', error);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    const user = (session as any)?.user;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const clientId = user.clientId as string;

    // Fetch FBR settings for this client
    let fbrSetting = await (prisma as any).fBRSetting.findUnique({
      where: { clientId },
    });

    // If no setting exists, use defaults (but this should be configured first)
    if (!fbrSetting) {
      return NextResponse.json(
        { error: 'FBR settings not configured. Please configure FBR Integration settings in Admin panel first.' },
        { status: 400 }
      );
    }

    const FBR_API_URL = fbrSetting.url;
    const FBR_AUTH_TOKEN = fbrSetting.bearerToken;
    const FBR_POS_ID = fbrSetting.posId;
    const FBR_USIN = fbrSetting.usin || 'USIN0';
    const FBR_PAYMENT_MODE = fbrSetting.paymentMode || 2;
    const FBR_INVOICE_TYPE = fbrSetting.invoiceType || 1;

    // Fetch the sale with all necessary data
    const sale = await (prisma as any).sale.findUnique({
      where: { id: params.id, clientId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
            variant: { select: { id: true, name: true, sku: true, attributes: true } },
          },
        },
      },
    });

    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    // Check if FBR Invoice ID already exists
    if (sale.fbrInvoiceId) {
      return NextResponse.json({ 
        error: 'FBR Invoice already generated', 
        fbrInvoiceId: sale.fbrInvoiceId 
      }, { status: 400 });
    }

    // Prepare FBR API request data
    let totalQuantity = 0;
    let totalSaleValue = 0;
    const itemData: any[] = [];

    for (const item of sale.items) {
      const itemName = item.variant?.name 
        ? `${item.product.name} (${item.variant.name})` 
        : item.product.name;
      const itemQuantity = item.quantity;
      const itemSubtotal = Number(item.price) * itemQuantity; // Subtotal before discount and tax
      const itemUnitPrice = itemSubtotal / itemQuantity; // Unit price before discount and tax
      const itemTotalPrice = Number(item.total); // Total after discount and tax
      const itemTaxCharged = Number(item.tax);
      const itemDiscount = Number(item.discount);
      
      totalQuantity += itemQuantity;
      totalSaleValue += itemTotalPrice; // Sum of all item totals (as per PHP example)

      itemData.push({
        ItemCode: item.product.sku || `IT_${item.product.id.substring(0, 8)}`,
        ItemName: itemName,
        Quantity: itemQuantity,
        PCTCode: '11001010', // Default PCT code, can be made configurable
        TaxRate: sale.taxPercent ? Number(sale.taxPercent) : 0.0,
        SaleValue: itemUnitPrice, // Unit price
        TotalAmount: itemTotalPrice, // Total amount for this item
        TaxCharged: itemTaxCharged,
        Discount: itemDiscount,
        FurtherTax: 0.0,
        InvoiceType: FBR_INVOICE_TYPE,
        RefUSIN: null,
      });
    }

    // Calculate total discount
    const totalDiscount = Number(sale.discount);
    const totalTax = Number(sale.tax);
    const totalBillAmount = Number(sale.total);

    // Format date for FBR API (ISO 8601 format)
    const dateTime = new Date(sale.createdAt).toISOString();

    // Prepare FBR API request payload using dynamic settings
    const fbrPayload = {
      InvoiceNumber: sale.orderId,
      POSID: FBR_POS_ID,
      USIN: FBR_USIN,
      DateTime: dateTime,
      items: itemData,
      TotalBillAmount: totalBillAmount,
      TotalQuantity: totalQuantity,
      TotalSaleValue: totalSaleValue,
      TotalTaxCharged: totalTax,
      Discount: totalDiscount,
      PaymentMode: FBR_PAYMENT_MODE,
      InvoiceType: FBR_INVOICE_TYPE,
    };

    // Send request to FBR API with SSL verification disabled
    console.log('Sending FBR request:', JSON.stringify(fbrPayload, null, 2));
    
    let fbrResult: any;
    try {
      const response = await makeFBRRequest(fbrPayload, FBR_API_URL, FBR_AUTH_TOKEN);
      
      if (response.status < 200 || response.status >= 300) {
        console.error('FBR API Error Response:', {
          status: response.status,
          data: response.data,
        });
        return NextResponse.json({ 
          error: 'FBR API request failed', 
          status: response.status,
          details: response.data 
        }, { status: response.status });
      }
      
      fbrResult = response.data;
      console.log('FBR API Response:', JSON.stringify(fbrResult, null, 2));
    } catch (error: any) {
      console.error('FBR Request Error:', error);
      return NextResponse.json({ 
        error: 'Failed to connect to FBR API', 
        details: error.message || 'Network error'
      }, { status: 500 });
    }
    
    // Extract FBR Invoice ID / USIN from response
    // The response structure may vary, adjust based on actual FBR API response
    const fbrInvoiceId = fbrResult.USIN || fbrResult.InvoiceNumber || fbrResult.id || null;

    if (!fbrInvoiceId) {
      console.error('FBR Response:', fbrResult);
      return NextResponse.json({ 
        error: 'FBR Invoice ID not received in response',
        response: fbrResult 
      }, { status: 500 });
    }

    // Update sale with FBR Invoice ID
    const updatedSale = await (prisma as any).sale.update({
      where: { id: params.id },
      data: { fbrInvoiceId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
            variant: { select: { id: true, name: true, sku: true } },
          },
        },
      },
    });

    return NextResponse.json({ 
      success: true, 
      fbrInvoiceId,
      sale: updatedSale 
    });
  } catch (e: any) {
    console.error('FBR integration error:', e);
    return NextResponse.json({ 
      error: e?.message ?? 'FBR integration failed' 
    }, { status: 500 });
  }
}

