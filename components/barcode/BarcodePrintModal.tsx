// components/barcode/BarcodePrintModal.tsx
'use client';

import { useState, useMemo, useEffect } from 'react';
import BarcodeLabel, { LABEL_SIZES, LabelSize } from './BarcodeLabel';
import { useToast } from '@/components/notifications/ToastContainer';
import { Trash2, Plus, Minus } from 'lucide-react';

type Product = {
  id: string;
  name: string;
  sku: string;
  price: number;
  type: 'SIMPLE' | 'VARIANT' | 'COMPOSITE';
  variants?: Array<{
    id: string;
    name?: string | null;
    sku?: string | null;
    price: number;
    attributes?: any;
  }>;
};

type CartItem = {
  key: string;
  productName: string;
  sku: string;
  price: number;
  quantity: number;
};

type PrintMode = 'label' | 'sheet';
type Unit = 'mm' | 'inch';

const INCH_TO_MM = 25.4;

const QUICK_SIZES = [
  { name: '1.5 × 1 inch', widthInch: 1.5, heightInch: 1 },
  { name: '2 × 1 inch', widthInch: 2, heightInch: 1 },
  { name: '2.5 × 1.5 inch', widthInch: 2.5, heightInch: 1.5 },
  { name: '3 × 2 inch', widthInch: 3, heightInch: 2 },
];

type Props = {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
};

export default function BarcodePrintModal({ isOpen, onClose, products }: Props) {
  const { showError } = useToast();

  const [printMode, setPrintMode] = useState<PrintMode>('sheet');
  const [search, setSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [sheetSize, setSheetSize] = useState<LabelSize>(LABEL_SIZES[2]);
  const [unit, setUnit] = useState<Unit>('inch');
  const [labelWidth, setLabelWidth] = useState(1.5);
  const [labelHeight, setLabelHeight] = useState(1);
  const [printOffsetXmm, setPrintOffsetXmm] = useState(1.2);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedProductId('');
      setSelectedVariantId('');
      setCart([]);
    }
  }, [isOpen]);

  const labelSizeMm = useMemo((): LabelSize => {
    if (unit === 'inch') {
      return {
        name: 'custom',
        widthMm: labelWidth * INCH_TO_MM,
        heightMm: labelHeight * INCH_TO_MM,
      };
    }
    return { name: 'custom', widthMm: labelWidth, heightMm: labelHeight };
  }, [unit, labelWidth, labelHeight]);

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return products.slice(0, 50);
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
  }, [products, search]);

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const selectedVariant = selectedProduct?.variants?.find((v) => v.id === selectedVariantId);

  const addToCart = () => {
    if (!selectedProduct) {
      showError('Please select a product first');
      return;
    }
    const key = selectedVariant
      ? `${selectedProduct.id}-${selectedVariant.id}`
      : selectedProduct.id;
    const productName = selectedVariant
      ? `${selectedProduct.name}${selectedVariant.name ? ` - ${selectedVariant.name}` : ''}`
      : selectedProduct.name;
    const sku = selectedVariant?.sku || selectedProduct.sku;
    const price = selectedVariant ? Number(selectedVariant.price) : Number(selectedProduct.price);

    setCart((prev) => {
      const existing = prev.find((c) => c.key === key);
      if (existing) {
        return prev.map((c) => c.key === key ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { key, productName, sku, price, quantity: 1 }];
    });
    setSelectedProductId('');
    setSelectedVariantId('');
    setSearch('');
  };

  const updateQty = (key: string, delta: number) => {
    setCart((prev) =>
      prev.map((c) => c.key === key ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c)
    );
  };

  const setQty = (key: string, val: number) => {
    setCart((prev) =>
      prev.map((c) => c.key === key ? { ...c, quantity: Math.max(1, Math.min(999, val || 1)) } : c)
    );
  };

  const removeFromCart = (key: string) => {
    setCart((prev) => prev.filter((c) => c.key !== key));
  };

  const allLabels = useMemo(() => {
    const labels: CartItem[] = [];
    for (const item of cart) {
      for (let i = 0; i < item.quantity; i++) {
        labels.push(item);
      }
    }
    return labels;
  }, [cart]);

  const totalStickers = cart.reduce((sum, c) => sum + c.quantity, 0);
  const labelModeItem = cart[0] ?? null;

  const waitForBarcodeRender = async () => {
    for (let i = 0; i < 20; i++) {
      const svgs = Array.from(
        document.querySelectorAll('#barcode-print-area .barcode-label svg')
      ) as SVGSVGElement[];
      if (svgs.length > 0 && svgs.every((svg) => svg.childNodes.length > 0)) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
  };

  const handlePrint = async () => {
    if (cart.length === 0) {
      showError('Cart is empty - please add products first');
      return;
    }
    await waitForBarcodeRender();
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

    const printArea = document.getElementById('barcode-print-area');
    if (!printArea) {
      showError('Print area not found');
      return;
    }

    const pageSizeRule =
      printMode === 'label'
        ? `@page { size: ${labelSizeMm.widthMm}mm ${labelSizeMm.heightMm}mm; margin: 0; }`
        : '@page { margin: 3mm; size: auto; }';
    const pageBodySizeRule =
      printMode === 'label'
        ? `html, body { width: ${labelSizeMm.widthMm}mm; margin: 0; padding: 0; overflow: visible; }`
        : '';
    const labelPositionRule =
      printMode === 'label'
        ? `
          #barcode-print-area { width: ${labelSizeMm.widthMm}mm; margin: 0; padding: 0; }
          #barcode-print-area > div {
            width: ${labelSizeMm.widthMm}mm;
            height: ${labelSizeMm.heightMm}mm;
            overflow: hidden;
            transform: translateX(${printOffsetXmm}mm);
            transform-origin: top left;
            page-break-after: always;
            break-after: page;
          }
          #barcode-print-area > div:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          #barcode-print-area .barcode-label {
            width: ${labelSizeMm.widthMm}mm !important;
            height: ${labelSizeMm.heightMm}mm !important;
          }
        `
        : '';

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const printDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!printDoc) {
      iframe.remove();
      showError('Could not create print document');
      return;
    }

    printDoc.open();
    printDoc.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Print Barcode</title>
          <style>
            ${pageSizeRule}
            html, body {
              margin: 0;
              padding: 0;
              background: #fff;
            }
            ${pageBodySizeRule}
            ${labelPositionRule}
            #barcode-print-area {
              margin: 0;
              padding: 0;
            }
            .barcode-label {
              break-inside: avoid;
              border: none !important;
              background: #fff !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .barcode-label svg,
            .barcode-label svg * {
              display: block !important;
              visibility: visible !important;
            }
          </style>
        </head>
        <body></body>
      </html>
    `);
    const printAreaClone = printArea.cloneNode(true) as HTMLElement;
    printDoc.body.appendChild(printAreaClone);

    printDoc.close();

    setTimeout(() => {
      const printWin = iframe.contentWindow;
      if (!printWin) {
        iframe.remove();
        showError('Could not access print window');
        return;
      }
      printWin.focus();
      printWin.print();
      setTimeout(() => iframe.remove(), 800);
    }, 250);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* ── Backdrop — print par hide ── */}
      <div className="fixed inset-0 bg-black/50 z-40 print:hidden" onClick={onClose} />

      {/* ── Modal — print par hide ── */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
        <div className="bg-white rounded-lg w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-xl">

          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
            <h2 className="text-lg font-semibold">Print Barcode Labels</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl font-bold">✕</button>
          </div>

          <div className="p-4 space-y-4">

            {/* Mode Toggle */}
            <div className="flex rounded-lg border overflow-hidden">
              <button
                onClick={() => setPrintMode('sheet')}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  printMode === 'sheet' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                🗒️ Sheet Printer
                <span className="block text-xs font-normal opacity-75">A4 / Letter — bulk printing</span>
              </button>
              <button
                onClick={() => setPrintMode('label')}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors border-l ${
                  printMode === 'label' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                🏷️ Label Printer
                <span className="block text-xs font-normal opacity-75">Dymo, Zebra — exact label size</span>
              </button>
            </div>

            {/* Step 1: Product Select */}
            <div className="border rounded-lg p-3 space-y-3 bg-gray-50">
              <p className="text-sm font-semibold text-gray-700">① Select Product</p>
              <input
                type="text"
                placeholder="Search by name or SKU..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedProductId('');
                  setSelectedVariantId('');
                }}
                className="w-full border rounded px-3 py-2 text-sm bg-white"
              />
              <div className="border rounded max-h-36 overflow-y-auto bg-white">
                {filteredProducts.length === 0 && (
                  <p className="text-sm text-gray-500 p-3">No products found.</p>
                )}
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setSelectedProductId(p.id); setSelectedVariantId(''); }}
                    className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 hover:bg-gray-50 ${
                      selectedProductId === p.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                    }`}
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-gray-400 ml-2 text-xs">SKU: {p.sku}</span>
                    <span className="text-gray-400 ml-2 text-xs">Rs. {Number(p.price).toFixed(2)}</span>
                    {p.type === 'VARIANT' && (
                      <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">VARIANT</span>
                    )}
                  </button>
                ))}
              </div>

              {selectedProduct?.type === 'VARIANT' && selectedProduct.variants && selectedProduct.variants.length > 0 && (
                <select
                  value={selectedVariantId}
                  onChange={(e) => setSelectedVariantId(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm bg-white"
                >
                  <option value="">— Use base product —</option>
                  {selectedProduct.variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name || 'Variant'}
                      {v.attributes ? ` (${Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(', ')})` : ''}
                      {' — '}SKU: {v.sku || selectedProduct.sku}
                      {' — '}Rs. {Number(v.price).toFixed(2)}
                    </option>
                  ))}
                </select>
              )}

              <button
                onClick={addToCart}
                disabled={!selectedProductId}
                className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
              >
                + Add To Cart
              </button>
            </div>

            {/* Step 2: Cart */}
            {cart.length > 0 && (
              <div className="border rounded-lg p-3 space-y-2">
                <p className="text-sm font-semibold text-gray-700">
                  ② Cart —{' '}
                  {printMode === 'label'
                    ? `Label Printer — first product will be printed: ${cart[0].productName}`
                    : `${cart.length} product${cart.length > 1 ? 's' : ''}, ${totalStickers} sticker${totalStickers > 1 ? 's' : ''} total`}
                </p>
                <div className="space-y-2">
                  {cart.map((item, idx) => (
                    <div
                      key={item.key}
                      className={`flex items-center gap-2 rounded px-3 py-2 ${
                        printMode === 'label' && idx === 0
                          ? 'bg-blue-50 border border-blue-200'
                          : printMode === 'label' && idx > 0
                          ? 'bg-gray-50 opacity-50'
                          : 'bg-gray-50'
                      }`}
                    >
                      {printMode === 'label' && (
                        <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 text-white ${idx === 0 ? 'bg-blue-600' : 'bg-gray-400'}`}>
                          {idx === 0 ? 'NOW' : 'NEXT'}
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.productName}</p>
                        <p className="text-xs text-gray-500">SKU: {item.sku} • Rs. {item.price.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => updateQty(item.key, -1)} className="w-7 h-7 border rounded flex items-center justify-center hover:bg-gray-100 bg-white">
                          <Minus size={12} />
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={999}
                          value={item.quantity}
                          onChange={(e) => setQty(item.key, Number(e.target.value))}
                          className="w-12 border rounded text-center text-sm py-1"
                        />
                        <button onClick={() => updateQty(item.key, 1)} className="w-7 h-7 border rounded flex items-center justify-center hover:bg-gray-100 bg-white">
                          <Plus size={12} />
                        </button>
                      </div>
                      <button onClick={() => removeFromCart(item.key)} className="text-red-500 hover:text-red-700 shrink-0">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Size */}
            {printMode === 'sheet' ? (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">③ Label Size</label>
                <select
                  value={sheetSize.name}
                  onChange={(e) => {
                    const s = LABEL_SIZES.find((x) => x.name === e.target.value);
                    if (s) setSheetSize(s);
                  }}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  {LABEL_SIZES.map((s) => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="border rounded-lg p-3 space-y-3 bg-gray-50">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700">③ Label Size</p>
                  <div className="flex rounded border overflow-hidden text-xs">
                    <button
                      onClick={() => {
                        if (unit === 'inch') return;
                        setLabelWidth(parseFloat((labelWidth / INCH_TO_MM).toFixed(2)));
                        setLabelHeight(parseFloat((labelHeight / INCH_TO_MM).toFixed(2)));
                        setUnit('inch');
                      }}
                      className={`px-3 py-1 font-medium ${unit === 'inch' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
                    >
                      inch
                    </button>
                    <button
                      onClick={() => {
                        if (unit === 'mm') return;
                        setLabelWidth(parseFloat((labelWidth * INCH_TO_MM).toFixed(1)));
                        setLabelHeight(parseFloat((labelHeight * INCH_TO_MM).toFixed(1)));
                        setUnit('mm');
                      }}
                      className={`px-3 py-1 font-medium border-l ${unit === 'mm' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
                    >
                      mm
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-500 mb-2">Quick select:</p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_SIZES.map((qs) => (
                      <button
                        key={qs.name}
                        onClick={() => {
                          if (unit === 'inch') {
                            setLabelWidth(qs.widthInch);
                            setLabelHeight(qs.heightInch);
                          } else {
                            setLabelWidth(parseFloat((qs.widthInch * INCH_TO_MM).toFixed(1)));
                            setLabelHeight(parseFloat((qs.heightInch * INCH_TO_MM).toFixed(1)));
                          }
                        }}
                        className="text-xs px-2.5 py-1 border rounded bg-white hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                      >
                        {qs.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Width ({unit})</label>
                    <input
                      type="number"
                      min={0.1}
                      step={unit === 'inch' ? 0.1 : 1}
                      value={labelWidth}
                      onChange={(e) => setLabelWidth(parseFloat(e.target.value) || 0.1)}
                      className="w-full border rounded px-3 py-2 text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Height ({unit})</label>
                    <input
                      type="number"
                      min={0.1}
                      step={unit === 'inch' ? 0.1 : 1}
                      value={labelHeight}
                      onChange={(e) => setLabelHeight(parseFloat(e.target.value) || 0.1)}
                      className="w-full border rounded px-3 py-2 text-sm bg-white"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  = {unit === 'inch'
                    ? `${(labelWidth * INCH_TO_MM).toFixed(1)} × ${(labelHeight * INCH_TO_MM).toFixed(1)} mm`
                    : `${(labelWidth / INCH_TO_MM).toFixed(2)} × ${(labelHeight / INCH_TO_MM).toFixed(2)} inch`}
                </p>
                <div className="mt-2">
                  <label className="block text-xs text-gray-600 mb-1">Print X Offset (mm)</label>
                  <input
                    type="number"
                    step={0.1}
                    min={-5}
                    max={5}
                    value={printOffsetXmm}
                    onChange={(e) => setPrintOffsetXmm(Number(e.target.value) || 0)}
                    className="w-full border rounded px-3 py-2 text-sm bg-white"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Positive value shifts print to the right, negative to the left.
                  </p>
                </div>
              </div>
            )}

            {/* Preview */}
            {cart.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  Preview{' '}
                  <span className="text-gray-400 font-normal text-xs">
                    {printMode === 'sheet'
                      ? `(max 8 shown on screen - all ${totalStickers} will print)`
                      : '(only first product - 1 label)'}
                  </span>
                </p>
                <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded border min-h-16 items-start">
                  {printMode === 'sheet' ? (
                    <>
                      {allLabels.slice(0, 8).map((item, i) => (
                        <BarcodeLabel key={i} productName={item.productName} sku={item.sku} price={item.price} size={sheetSize} />
                      ))}
                      {totalStickers > 8 && (
                        <div className="flex items-center text-sm text-gray-500 px-3">+{totalStickers - 8} more</div>
                      )}
                    </>
                  ) : (
                    labelModeItem && (
                      <BarcodeLabel productName={labelModeItem.productName} sku={labelModeItem.sku} price={labelModeItem.price} size={labelSizeMm} />
                    )
                  )}
                </div>
              </div>
            )}

            {/* Print Button */}
            <button
              onClick={handlePrint}
              disabled={cart.length === 0}
              className="w-full py-2.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm"
            >
              {printMode === 'sheet'
                ? `🖨️ Print ${totalStickers} Sticker${totalStickers !== 1 ? 's' : ''} — ${cart.length} Product${cart.length !== 1 ? 's' : ''}`
                : `🏷️ Print Label — ${labelModeItem?.productName ?? ''} (${labelModeItem?.quantity ?? 0} cop${(labelModeItem?.quantity ?? 0) !== 1 ? 'ies' : 'y'})`}
            </button>

            {printMode === 'label' && cart.length > 1 && (
              <p className="text-xs text-center text-amber-600 bg-amber-50 rounded p-2">
                Label Printer mode prints one product at a time. Click Print again for the next product.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ══ PRINT AREA — modal se bahar, print:hidden nahi hai ══ */}
      {printMode === 'sheet' && allLabels.length > 0 && (
        <div id="barcode-print-area">
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '3mm',
            padding: '5mm',
            width: '210mm',
            boxSizing: 'border-box',
          }}>
            {allLabels.map((item, i) => (
              <BarcodeLabel key={i} productName={item.productName} sku={item.sku} price={item.price} size={sheetSize} />
            ))}
          </div>
        </div>
      )}

      {printMode === 'label' && labelModeItem && (
        <div id="barcode-print-area">
          {Array.from({ length: labelModeItem.quantity }).map((_, i) => (
            <div
              key={i}
              style={{ pageBreakAfter: i < labelModeItem.quantity - 1 ? 'always' : 'auto' }}
            >
              <BarcodeLabel
                productName={labelModeItem.productName}
                sku={labelModeItem.sku}
                price={labelModeItem.price}
                size={labelSizeMm}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

