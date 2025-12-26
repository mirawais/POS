
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
    try {
        const orderId = '20251226-K9QX2';
        const sale = await prisma.sale.findUnique({
            where: { orderId: orderId },
            select: {
                id: true,
                orderId: true,
                type: true,
                total: true,
                items: { select: { returnedQuantity: true, productId: true, quantity: true } },
                refunds: { select: { id: true, total: true } }
            }
        });
        console.log(JSON.stringify(sale, null, 2));
        fs.writeFileSync('order_debug.json', JSON.stringify(sale, null, 2));
    } catch (err) {
        console.error(err);
    }
}

main()
    .finally(async () => await prisma.$disconnect());
