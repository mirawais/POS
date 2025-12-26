
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
    try {
        const orderId = '20251226-VW6OT';
        const sale = await prisma.sale.findUnique({
            where: { orderId: orderId },
            include: {
                items: {
                    include: {
                        product: true,
                        variant: true
                    }
                }
            }
        });
        console.log(JSON.stringify(sale, null, 2));
        fs.writeFileSync('debug_value_calc.json', JSON.stringify(sale, null, 2));
    } catch (err) {
        console.error(err);
    }
}

main()
    .finally(async () => await prisma.$disconnect());
