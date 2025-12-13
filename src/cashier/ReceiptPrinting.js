export function handlePrintReceipt({ transaction, items, taxes, settings }) {
  if (typeof window === 'undefined') return;

  const businessName = settings?.business_name || 'My Business';
  const address = settings?.address || '';
  const footer = settings?.receipt_footer || '';

  const itemsHtml = items
    .map(
      (item) => `
        <tr>
          <td>${item.name}</td>
          <td>${item.quantity}</td>
          <td>${item.unit_price.toFixed(2)}</td>
          <td>${(item.quantity * item.unit_price).toFixed(2)}</td>
        </tr>`
    )
    .join('');

  const taxesHtml = (taxes || [])
    .map((tax) => `<div>${tax.name}: ${(tax.rate * 100).toFixed(2)}%</div>`)
    .join('');

  const html = `
    <html>
      <body>
        <div>
          <h3>${businessName}</h3>
          <div>${address}</div>
          <hr />
          <table style="width:100%;font-size:12px;">
            <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <hr />
          <div>Subtotal: ${transaction.subtotal.toFixed(2)}</div>
          <div>Discount: ${transaction.discount_total.toFixed(2)}</div>
          <div>Taxes: ${taxesHtml}</div>
          <div><strong>Total: ${transaction.total.toFixed(2)}</strong></div>
          <hr />
          <div>${footer}</div>
        </div>
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=400,height=600');
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
}

