import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export default async function AdminInvoiceSettingsPage() {
  const session = await auth();
  const clientId = (session as any)?.user?.clientId as string;
  const setting = clientId
    ? await prisma.invoiceSetting.findUnique({ where: { clientId } })
    : null;

  async function save(formData: FormData) {
    'use server';
    const session = await auth();
    const clientId = (session as any)?.user?.clientId as string;
    if (!clientId) return;
    const logoUrl = String(formData.get('logoUrl') || '').trim() || null;
    const headerText = String(formData.get('headerText') || '').trim() || null;
    const footerText = String(formData.get('footerText') || '').trim() || null;
    const showTax = formData.get('showTax') === 'on';
    const showDiscount = formData.get('showDiscount') === 'on';
    const showCashier = formData.get('showCashier') === 'on';
    const showCustomer = formData.get('showCustomer') === 'on';
    await prisma.invoiceSetting.upsert({
      where: { clientId },
      update: { logoUrl, headerText, footerText, showTax, showDiscount, showCashier, showCustomer },
      create: { clientId, logoUrl, headerText, footerText, showTax, showDiscount, showCashier, showCustomer },
    });
    revalidatePath('/admin/settings/invoice');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Invoice Settings</h1>
        <p className="mt-2 text-gray-600">Customize logo, header, footer, and visibility flags for printing.</p>
      </div>

      <form action={save} className="p-4 border rounded bg-white space-y-3">
        <h2 className="font-semibold">Layout</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-sm text-gray-700">Logo URL</span>
            <input name="logoUrl" className="w-full border rounded px-3 py-2" defaultValue={setting?.logoUrl ?? ''} />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-gray-700">Header Text</span>
            <input name="headerText" className="w-full border rounded px-3 py-2" defaultValue={setting?.headerText ?? ''} />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm text-gray-700">Footer Text</span>
            <textarea name="footerText" className="w-full border rounded px-3 py-2" rows={3} defaultValue={setting?.footerText ?? ''} />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex items-center gap-2">
            <input name="showTax" type="checkbox" defaultChecked={setting?.showTax ?? true} className="h-4 w-4" />
            <span className="text-sm text-gray-700">Show Tax</span>
          </label>
          <label className="flex items-center gap-2">
            <input name="showDiscount" type="checkbox" defaultChecked={setting?.showDiscount ?? true} className="h-4 w-4" />
            <span className="text-sm text-gray-700">Show Discount</span>
          </label>
          <label className="flex items-center gap-2">
            <input name="showCashier" type="checkbox" defaultChecked={setting?.showCashier ?? true} className="h-4 w-4" />
            <span className="text-sm text-gray-700">Show Cashier</span>
          </label>
          <label className="flex items-center gap-2">
            <input name="showCustomer" type="checkbox" defaultChecked={setting?.showCustomer ?? true} className="h-4 w-4" />
            <span className="text-sm text-gray-700">Show Customer</span>
          </label>
        </div>

        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
      </form>
    </div>
  );
}

