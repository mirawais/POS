import { auth } from '@/lib/auth';

export default async function AdminDashboardPage() {
  // session variable ko 'any' type dein taaki 'user' property ka error na aaye
  const session: any = await auth(); 
  
  return (
    <div>
      <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
      {/* Ab type error nahi aana chahiye kyunki session ki type 'any' hai */}
      <p className="mt-2 text-gray-600">Welcome, {session?.user?.name ?? session?.user?.email}</p>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <a href="/admin/products" className="block p-4 border rounded">Products</a>
        <a href="/admin/raw-materials" className="block p-4 border rounded">Raw Materials</a>
        <a href="/admin/settings/tax" className="block p-4 border rounded">Tax Settings</a>
        <a href="/admin/settings/invoice" className="block p-4 border rounded">Invoice Settings</a>
        <a href="/admin/reports" className="block p-4 border rounded">Reports</a>
      </div>
    </div>
  );
}