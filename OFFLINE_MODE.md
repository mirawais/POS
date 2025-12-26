# Offline Mode - Quick Reference

## Development Mode (`npm run dev`)

### ✅ What Works Offline
- Complete checkout transactions
- Save carts (held bills)
- View cached orders and held bills
- Print receipts
- Automatic sync when back online

### ❌ What Doesn't Work Offline (Dev Mode Only)
- Navigation between pages (requires production build)
- Exchanges and Refunds (intentionally disabled for data integrity)

## Production Mode (`npm run build && npm start`)

### ✅ Everything Works Offline
- All dev mode features PLUS
- Full navigation between all pages
- Complete PWA functionality

## Quick Start

### Testing Offline in Development
1. Start dev server: `npm run dev`
2. Open app while online
3. Go offline (DevTools → Network → Offline)
4. Test checkout and cart saving
5. Go back online to see auto-sync

### Testing Full Offline (Production)
1. Build: `npm run build`
2. Start: `npm start`
3. Visit all pages once while online
4. Go offline
5. Navigate freely and test all features

## Clearing Offline Data
If you encounter sync issues:
1. Open DevTools → Application → Local Storage
2. Right-click on `http://localhost:3000`
3. Click "Clear"
4. Refresh the page

## Technical Details
- **Sync Queue**: `offline_orders`, `offline_held_queue` in localStorage
- **Cache Keys**: `cached_products`, `cached_taxes`, `cached_settings`, `cached_held_bills`, `cached_sales`
- **PWA Library**: `@ducanh2912/next-pwa`
- **Service Worker**: `public/sw.js` (auto-generated)
