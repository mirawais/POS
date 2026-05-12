// components/barcode/BarcodeLabel.tsx
'use client';

import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

export type LabelSize = {
  name: string;
  widthMm: number;
  heightMm: number;
};

export const LABEL_SIZES: LabelSize[] = [
  { name: '38 × 25 mm', widthMm: 38, heightMm: 25 },
  { name: '50 × 25 mm', widthMm: 50, heightMm: 25 },
  { name: '50 × 30 mm', widthMm: 50, heightMm: 30 },
  { name: '60 × 40 mm', widthMm: 60, heightMm: 40 },
  { name: '80 × 50 mm', widthMm: 80, heightMm: 50 },
];

const MM_TO_PX = 3.7795;

type Props = {
  productName: string;
  sku: string;
  price: number;
  size: LabelSize;
};

export default function BarcodeLabel({ productName, sku, price, size }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const hPx = size.heightMm * MM_TO_PX;
  const barcodeHeightPx = Math.max(20, hPx * 0.34);

  useEffect(() => {
    if (!svgRef.current || !sku) return;
    try {
      JsBarcode(svgRef.current, sku, {
        format: 'CODE128',
        width: 1.6,
        height: barcodeHeightPx,
        displayValue: false,
        margin: 0,
        marginLeft: 12,
        marginRight: 12,
        background: '#ffffff',
        lineColor: '#000000',
      });
    } catch (e) {
      console.error('Barcode error:', e);
    }
  }, [sku, barcodeHeightPx]);

  const nameFontSize = Math.max(8, hPx * 0.11);
  const skuFontSize = Math.max(10, hPx * 0.1);
  const priceFontSize = Math.max(10, hPx * 0.135);

  return (
    <div
      className="barcode-label"
      style={{
        width: `${size.widthMm}mm`,
        height: `${size.heightMm}mm`,
        backgroundColor: '#ffffff',
        border: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1mm 1.2mm',
        boxSizing: 'border-box',
        overflow: 'hidden',
        fontFamily: 'Arial, sans-serif',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      } as React.CSSProperties}
    >
      {/* Product Name */}
      <div style={{
        fontSize: `${nameFontSize}px`,
        fontWeight: 'bold',
        color: '#000000',
        textAlign: 'center',
        width: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
        flexShrink: 0,
      }}>
        {productName}
      </div>

      {/* Barcode SVG for crisp, scanner-friendly print output */}
      <svg
        ref={svgRef}
        style={{
          width: '100%',
          height: `${barcodeHeightPx}px`,
          flexShrink: 1,
          minHeight: 0,
          display: 'block',
        }}
      />

      {/* SKU */}
      <div style={{
        fontSize: `${skuFontSize}px`,
        color: '#000000',
        textAlign: 'center',
        letterSpacing: '0.3px',
        flexShrink: 0,
        fontFamily: 'monospace',
        fontWeight: 700,
        lineHeight: 1,
      }}>
        {sku}
      </div>

      {/* Price */}
      <div style={{
        fontSize: `${priceFontSize}px`,
        fontWeight: 'bold',
        color: '#000000',
        textAlign: 'center',
        flexShrink: 0,
      }}>
        Rs. {Number(price).toFixed(2)}
      </div>
    </div>
  );
}
