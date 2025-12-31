import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";

export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await auth();
        const user = (session as any)?.user;
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const clientId = user.clientId as string;
        const saleId = params.id;

        // Fetch the sale with items and cashier
        const sale = await (prisma as any).sale.findUnique({
            where: { id: saleId },
            include: {
                cashier: { select: { id: true, name: true, email: true } },
                items: {
                    include: {
                        product: { select: { id: true, name: true, sku: true } },
                        variant: { select: { id: true, name: true, sku: true, attributes: true } },
                    },
                },
            },
        });

        if (!sale || sale.clientId !== clientId) {
            return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
        }

        // Fetch settings
        const setting = await prisma.invoiceSetting.findUnique({
            where: { clientId },
        });

        // Generate HTML
        const logo = setting?.logoUrl ? `<img src="${setting.logoUrl}" style="max-width:150px;" />` : '';
        const header = setting?.headerText ? `<div>${setting.headerText}</div>` : '';
        const footer = setting?.footerText ? `<div>${setting.footerText}</div>` : '';

        const itemsHtml = sale.items.map((i: any) => {
            const price = Number(i.price);
            const total = Number(i.total);
            return `<tr><td>${i.product.name}${i.variant ? ` (${i.variant.name})` : ''}</td><td>${i.quantity}</td><td>Rs. ${price.toFixed(2)}</td><td>Rs. ${total.toFixed(2)}</td></tr>`;
        }).join('');

        const html = `
      <html>
        <head>
          <title>Order ${sale.orderId}</title>
          <style>
            body { font-family: sans-serif; margin: 0; padding: 10px; }
            .invoice-header, .invoice-footer { text-align: center; margin-bottom: 10px; }
            .invoice-details { font-size: 12px; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #eee; padding: 5px; text-align: left; }
            .totals { margin-top: 10px; font-size: 12px; text-align: right; }
            .totals div { display: flex; justify-content: space-between; }
            .totals strong { font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="invoice-header">
            ${logo}
            ${header}
          </div>
          <div class="invoice-details">
            Order ID: ${sale.orderId}<br/>
            ${sale.fbrInvoiceId ? `FBR Invoice ID: ${sale.fbrInvoiceId}<br/>` : ''}
            Date: ${new Date(sale.createdAt).toLocaleString()}<br/>
            ${setting?.showCashier !== false ? `Cashier: ${sale.cashier?.name || sale.cashier?.email || 'Unknown'}<br/>` : ''}
            Payment Method: ${sale.paymentMethod === 'CARD' ? 'Card' : 'Cash'}<br/>
            ${setting?.customFields && Array.isArray(setting.customFields) && setting.customFields.length > 0
                ? setting.customFields.map((field: any) => `<div><strong>${field.label}:</strong> ${field.value}</div>`).join('')
                : ''}
          </div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <div class="totals">
            <div><span>Subtotal:</span><span>Rs. ${Number(sale.subtotal).toFixed(2)}</span></div>
            ${setting?.showDiscount !== false && Number(sale.discount) > 0 ? `<div><span>Discount:</span><span>-Rs. ${Number(sale.discount).toFixed(2)}</span></div>` : ''}
            ${setting?.showTax !== false && Number(sale.tax) > 0 ? `<div><span>Tax:</span><span>Rs. ${Number(sale.tax).toFixed(2)}</span></div>` : ''}
            <div><strong><span>Total:</span><span>Rs. ${Number(sale.total).toFixed(2)}</span></strong></div>
          </div>
          <div class="invoice-footer">
            ${footer}
          </div>
        </body>
      </html>
    `;

        return NextResponse.json({ html });
    } catch (e: any) {
        console.error('print GET error', e);
        return NextResponse.json({ error: e?.message ?? 'Failed to fetch print data' }, { status: 500 });
    }
}
