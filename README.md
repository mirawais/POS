# Amanat POS

Modern multi-tenant POS built with Next.js (App Router), NextAuth.js (JWT), Prisma, and PostgreSQL.

## Getting Started

1. Copy environment variables:

```
cp .env.example .env
```

Set `DATABASE_URL`, `NEXTAUTH_URL`, and `NEXTAUTH_SECRET` in `.env`.

2. Install dependencies:

```
npm install
```

3. Generate Prisma client and run migrations:

```
npx prisma generate
npx prisma migrate dev --name init
```

4. Seed demo data:

```
npm run db:seed
```

5. Start the dev server:

```
npm run dev
```

## Demo Accounts
- Admin: `admin@amanat.local` / `admin123`
- Cashier: `cashier@amanat.local` / `cashier123`

## Project Structure
- `app/` Next.js App Router pages and API route handlers
- `app/api/*` Backend endpoints (authenticated)
- `prisma/schema.prisma` Database models (multi-tenant via `clientId`)
- `src/lib/*` Prisma and Auth helpers

## Notes
- All entities reference `clientId` and queries must be filtered by the logged-in user’s `clientId`.
- Extend API routes and pages to implement full CRUD, billing logic, stock deductions, reports, and invoice PDF.

