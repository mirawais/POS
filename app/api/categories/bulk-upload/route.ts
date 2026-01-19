import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    try {
        const session = await auth();
        const user = (session as any)?.user;
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const clientId = user.clientId as string;

        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const text = await file.text();
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);

        if (lines.length === 0) {
            return NextResponse.json({ error: 'Empty CSV file' }, { status: 400 });
        }

        // Parse header
        const header = lines[0].split(',').map(h => h.trim());
        const nameIndex = header.findIndex(h => h.toLowerCase() === 'name');
        const isDefaultIndex = header.findIndex(h => h.toLowerCase() === 'isdefault');

        if (nameIndex === -1) {
            return NextResponse.json({
                error: 'CSV must have a "name" column'
            }, { status: 400 });
        }

        // Get existing categories for this client to check duplicates
        const existingCategories = await (prisma as any).category.findMany({
            where: { clientId },
            select: { name: true },
        });
        const existingNames = new Set(existingCategories.map((c: any) => c.name.toLowerCase()));

        let created = 0;
        let errors = 0;
        const errorDetails: string[] = [];

        // Process each row
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            const values = line.split(',').map(v => v.trim());

            try {
                const name = values[nameIndex]?.replace(/^["']|["']$/g, '');
                const isDefaultStr = isDefaultIndex !== -1 ? values[isDefaultIndex]?.toLowerCase() : 'false';
                const isDefault = isDefaultStr === 'true' || isDefaultStr === '1';

                if (!name) {
                    errors++;
                    errorDetails.push(`Row ${i + 1}: Name is required`);
                    continue;
                }

                // Check for duplicate within this client
                if (existingNames.has(name.toLowerCase())) {
                    errors++;
                    errorDetails.push(`Row ${i + 1}: Category "${name}" already exists`);
                    continue;
                }

                // Create category
                await (prisma as any).category.create({
                    data: {
                        name,
                        isDefault,
                        clientId,
                    },
                });

                // Add to existing names to prevent duplicates within the same upload
                existingNames.add(name.toLowerCase());
                created++;
            } catch (err: any) {
                errors++;
                errorDetails.push(`Row ${i + 1}: ${err.message || 'Failed to create category'}`);
            }
        }

        return NextResponse.json({
            success: true,
            created,
            errors,
            details: errors > 0 ? { errors: errorDetails } : undefined,
        });
    } catch (e: any) {
        console.error('Bulk upload error:', e);
        return NextResponse.json({
            error: e?.message ?? 'Failed to upload categories'
        }, { status: 500 });
    }
}
