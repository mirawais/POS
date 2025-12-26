
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
    try {
        const sales = await prisma.sale.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: {
                orderId: true,
                type: true,
                total: true,
                items: { select: { returnedQuantity: true } },
                refunds: { select: { id: true } }
            }
        });
        fs.writeFileSync('verify_output.json', JSON.stringify(sales, null, 2));
    } catch (err) {
        console.error(err);
        fs.writeFileSync('verify_output.json', JSON.stringify({ error: err.message }));
    }
}

main()
    .finally(async () => await prisma.$disconnect());
