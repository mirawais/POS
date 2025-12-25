# Multi-Tenancy & Super Admin Implementation Guide

## Overview
We have implemented a strict multi-tenant architecture with a Super Admin overlay.

## 1. Schema Changes
- **Role Enum**: Added `SUPER_ADMIN`.
- **User Model**: Made `clientId` optional (`String?`).
  - *Implication*: Normal users (Admin/Cashier) MUST have a `clientId`. Super Admin has `clientId = null`.

## 2. Authentication & Session
- **Auth Strategy**: JWT.
- **Session Payload**: `role` and `clientId` are embedded in the session/token.
- **Logic**: `src/lib/auth.ts` helps in carrying this context to all API routes.

## 3. Access Control (Middleware)
Located in `src/middleware.ts`:
- **/super-admin**: Strictly for `SUPER_ADMIN`.
- **/admin**: For `ADMIN` (Client Admin) and `SUPER_ADMIN`.
- **/cashier**: For `CASHIER`, `ADMIN`, and `SUPER_ADMIN`.
- **Redirects**: Users accessing unauthorized zones are redirected to their appropriate dashboard.

## 4. API Access Logic (System Logic)
The "Firewall" for data is in the API routes.

### Super Admin
- **Global Access**: Can access any data.
- **Impersonation/Filter**:
  - `GET`: Can explicitly pass `?clientId=...` to view a specific client's data. If omitted, they view ALL data (or Global data).
  - `POST/PUT`: **MUST** specify `clientId` in the body to know which tenant to affect.
  - `DELETE`: Can delete any record provided they have the ID.

### Client Admin
- **Scoped Access**: `clientId` is automatically extracted from their session.
- **Query Injection**: All DB queries automatically enforce `where: { clientId: session.user.clientId }`.
- **Creation**: All created records are forced to their `clientId`.

### Cashier
- Restricted to POS operations within their `clientId`.

## 5. Deployment & Seeding
- **Seed Command**: `npm run db:seed`
- **Super Admin Credentials**:
  - Email: `super@amanat.local`
  - Password: `superadmin123`

## Next Steps for Developer
- Update remaining API routes (besides `/products`) to follow the pattern established in `app/api/products/route.ts`.
- Build the `/super-admin` Dashboard UI to list Clients and allow "Login as Client".
