import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const superAdminPassword = await bcrypt.hash('superadmin123', 10);

  await prisma.user.upsert({
    where: { email: 'super@amanat.local' },
    update: {},
    create: {
      email: 'super@amanat.local',
      name: 'Super Admin',
      password: superAdminPassword,
      role: Role.SUPER_ADMIN,
      clientId: null,
    },
  });

  const client = await prisma.client.upsert({
    where: { id: 'seed-client-1' },
    update: {},
    create: {
      id: 'seed-client-1',
      name: 'Amanat Demo',
    },
  });

  const generalCategory = await prisma.category.upsert({
    where: { id: 'seed-category-general' },
    update: {},
    create: {
      id: 'seed-category-general',
      clientId: client.id,
      name: 'General',
      isDefault: true,
    },
  });

  const adminPassword = await bcrypt.hash('admin123', 10);
  const cashierPassword = await bcrypt.hash('cashier123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@amanat.local' },
    update: {},
    create: {
      email: 'admin@amanat.local',
      name: 'Demo Admin',
      password: adminPassword,
      role: Role.ADMIN,
      clientId: client.id,
    },
  });

  const cashier = await prisma.user.upsert({
    where: { email: 'cashier@amanat.local' },
    update: {},
    create: {
      email: 'cashier@amanat.local',
      name: 'Demo Cashier',
      password: cashierPassword,
      role: Role.CASHIER,
      clientId: client.id,
    },
  });

  const defaultTax = await prisma.taxSetting.upsert({
    where: { id: 'seed-tax-default' },
    update: { isDefault: true },
    create: {
      id: 'seed-tax-default',
      clientId: client.id,
      name: 'VAT',
      percent: 16 as any,
      isDefault: true,
    },
  });

  await prisma.taxSetting.upsert({
    where: { id: 'seed-tax-gst' },
    update: {},
    create: {
      id: 'seed-tax-gst',
      clientId: client.id,
      name: 'GST',
      percent: 5 as any,
      isDefault: false,
    },
  });

  await prisma.invoiceSetting.upsert({
    where: { clientId: client.id },
    update: {
      logoUrl: 'https://dummyimage.com/200x80/111/fff&text=Amanat+POS',
      headerText: 'Amanat POS Invoice',
      footerText: 'Thank you for your business!',
    },
    create: {
      clientId: client.id,
      logoUrl: 'https://dummyimage.com/200x80/111/fff&text=Amanat+POS',
      headerText: 'Amanat POS Invoice',
      footerText: 'Thank you for your business!',
      showTax: true,
      showDiscount: true,
      showCashier: true,
      showCustomer: true,
    },
  });

  await prisma.discount.createMany({
    data: [
      { clientId: client.id, name: 'Item 5% Off', isPerItem: true, percent: 5 as any },
      { clientId: client.id, name: 'Bill 20 Off', isPerItem: false, amount: 20 as any },
    ],
    skipDuplicates: true,
  });

  await prisma.discountRule.createMany({
    data: [
      { clientId: client.id, name: 'Item 10% Off', scope: 'ITEM', type: 'PERCENT', value: 10 as any },
      { clientId: client.id, name: 'Cart 50 Off', scope: 'CART', type: 'AMOUNT', value: 50 as any },
    ],
    skipDuplicates: true,
  });

  await prisma.coupon.createMany({
    data: [
      { clientId: client.id, code: 'SAVE10', type: 'PERCENT', value: 10 as any },
      { clientId: client.id, code: 'FLAT50', type: 'AMOUNT', value: 50 as any },
    ],
    skipDuplicates: true,
  });

  const rm1 = await prisma.rawMaterial.upsert({
    where: {
      clientId_sku: {
        clientId: client.id,
        sku: 'RM-COFFEE-BEANS',
      },
    },
    update: {},
    create: {
      clientId: client.id,
      name: 'Coffee Beans',
      sku: 'RM-COFFEE-BEANS',
      unit: 'gram',
      stock: 1000,
      lowStockAt: 200,
    },
  });

  const rm2 = await prisma.rawMaterial.upsert({
    where: {
      clientId_sku: {
        clientId: client.id,
        sku: 'RM-MILK',
      },
    },
    update: {},
    create: {
      clientId: client.id,
      name: 'Milk',
      sku: 'RM-MILK',
      unit: 'ml',
      stock: 500,
      lowStockAt: 100,
    },
  });

  const espresso = await prisma.product.upsert({
    where: {
      clientId_sku: {
        clientId: client.id,
        sku: 'PR-ESPRESSO',
      },
    },
    update: {},
    create: {
      clientId: client.id,
      name: 'Espresso',
      sku: 'PR-ESPRESSO',
      type: 'COMPOSITE',
      price: 3.5 as any,
      stock: 100,
      lowStockAt: 20,
      categoryId: generalCategory.id,
      defaultTaxId: defaultTax.id,
    },
  });

  const milkCoffee = await prisma.product.upsert({
    where: {
      clientId_sku: {
        clientId: client.id,
        sku: 'PR-MILK-COFFEE',
      },
    },
    update: {},
    create: {
      clientId: client.id,
      name: 'Milk Coffee',
      sku: 'PR-MILK-COFFEE',
      type: 'COMPOSITE',
      price: 4.5 as any,
      stock: 120,
      lowStockAt: 25,
      categoryId: generalCategory.id,
      defaultTaxId: defaultTax.id,
    },
  });

  await prisma.productRawMaterial.createMany({
    data: [
      { clientId: client.id, productId: espresso.id, rawMaterialId: rm1.id, quantity: 10, unit: 'gram' },
      { clientId: client.id, productId: milkCoffee.id, rawMaterialId: rm1.id, quantity: 8, unit: 'gram' },
      { clientId: client.id, productId: milkCoffee.id, rawMaterialId: rm2.id, quantity: 2, unit: 'ml' },
    ],
    skipDuplicates: true,
  });

  console.log('Seed complete:', { client: client.name, admin: admin.email, cashier: cashier.email });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});

