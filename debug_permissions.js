const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkManagerPermissions() {
    console.log('Checking Manager Users...');
    const managers = await prisma.user.findMany({
        where: { role: 'MANAGER' },
        select: { email: true, permissions: true }
    });

    if (managers.length === 0) {
        console.log('No managers found.');
    } else {
        managers.forEach(m => {
            console.log(`Manager: ${m.email}`);
            const p = m.permissions || {};
            console.log('view_orders:', p.view_orders);
            console.log('manage_coupons:', p.manage_coupons);
            console.log('Full Permissions Keys:', Object.keys(p));
        });
    }
}

checkManagerPermissions()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
