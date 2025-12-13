import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

async function getData(clientId: string) {
  return prisma.taxSetting.findMany({ where: { clientId }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] });
}

export default async function AdminTaxSettingsPage() {
  const session = await (await import('@/lib/auth')).auth();
  const clientId = (session as any)?.user?.clientId as string;
  const taxes = clientId ? await getData(clientId) : [];

  async function createTax(formData: FormData) {
    'use server';
    const session = await (await import('@/lib/auth')).auth();
    const clientId = (session as any)?.user?.clientId as string;
    if (!clientId) return;
    const name = String(formData.get('name') || '').trim();
    const percent = Number(formData.get('percent') || 0);
    const isDefault = formData.get('isDefault') === 'on';
    if (!name) return;
    if (isDefault) {
      await prisma.taxSetting.updateMany({ where: { clientId }, data: { isDefault: false } });
    }
    await prisma.taxSetting.create({
      data: { name, percent: percent as any, isDefault, clientId },
    });
    revalidatePath('/admin/settings/tax');
  }

  async function makeDefault(formData: FormData) {
    'use server';
    const session = await (await import('@/lib/auth')).auth();
    const clientId = (session as any)?.user?.clientId as string;
    if (!clientId) return;
    const id = String(formData.get('id'));
    await prisma.$transaction([
      prisma.taxSetting.updateMany({ where: { clientId }, data: { isDefault: false } }),
      prisma.taxSetting.update({ where: { id }, data: { isDefault: true } }),
    ]);
    revalidatePath('/admin/settings/tax');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tax Settings</h1>
        <p className="mt-2 text-gray-600">Manage tax slabs (only one default applies to cart).</p>
      </div>

      <form action={createTax} className="p-4 border rounded space-y-3 bg-white">
        <h2 className="font-semibold">Add Tax</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="space-y-1">
            <span className="text-sm text-gray-700">Name</span>
            <input name="name" className="w-full border rounded px-3 py-2" required />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-gray-700">Percent</span>
            <input name="percent" type="number" step="0.01" min="0" className="w-full border rounded px-3 py-2" required />
          </label>
          <label className="flex items-center gap-2 mt-6">
            <input name="isDefault" type="checkbox" className="h-4 w-4" />
            <span className="text-sm text-gray-700">Set as default</span>
          </label>
        </div>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
      </form>

      <div className="p-4 border rounded bg-white">
        <h2 className="font-semibold mb-3">Existing Taxes</h2>
        <div className="space-y-2">
          {taxes.map((tax) => (
            <div key={tax.id} className="flex items-center justify-between border rounded px-3 py-2">
              <div>
                <div className="font-medium">{tax.name} {tax.isDefault && <span className="text-xs text-green-700">Default</span>}</div>
                <div className="text-sm text-gray-600">{tax.percent.toString()}%</div>
              </div>
              {!tax.isDefault && (
                <form action={makeDefault}>
                  <input type="hidden" name="id" value={tax.id} />
                  <button className="text-sm px-3 py-1 border rounded">Make default</button>
                </form>
              )}
            </div>
          ))}
          {taxes.length === 0 && <p className="text-sm text-gray-600">No taxes yet.</p>}
        </div>
      </div>
    </div>
  );
}

