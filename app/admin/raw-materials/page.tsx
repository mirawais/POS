'use client';

import { useEffect, useState } from 'react';

type RawMaterial = {
  id: string;
  name: string;
  sku: string;
  unit?: string | null;
  stock: number;
  lowStockAt?: number | null;
};

export default function AdminRawMaterialsPage() {
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (searchTerm = '') => {
    const params = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : '';
    const data = await fetch(`/api/raw-materials${params}`).then((r) => r.json());
    setMaterials(data);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      sku: formData.get('sku'),
      unit: formData.get('unit') || 'unit',
      stock: formData.get('stock') || 0,
      lowStockAt: formData.get('lowStockAt') || null,
    };

    try {
      const url = '/api/raw-materials';
      const method = editingMaterial ? 'PATCH' : 'POST';
      const body = editingMaterial ? { id: editingMaterial.id, ...data } : data;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save raw material');
      }
      await loadData(search);
      (e.target as HTMLFormElement).reset();
      setShowForm(false);
      setEditingMaterial(null);
    } catch (err: any) {
      alert(err.message || 'Failed to save raw material');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this raw material?')) return;
    try {
      const res = await fetch(`/api/raw-materials?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete raw material');
      await loadData(search);
    } catch (err: any) {
      alert(err.message || 'Failed to delete raw material');
    }
  };

  const handleEdit = (material: RawMaterial) => {
    setEditingMaterial(material);
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Raw Materials</h1>
          <p className="mt-2 text-gray-600">Manage raw materials/ingredients for compound products.</p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingMaterial(null);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          {showForm ? 'Cancel' : 'Add Raw Material'}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Search raw materials by name or SKU..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            loadData(e.target.value);
          }}
          className="flex-1 border rounded px-3 py-2"
        />
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="p-4 border rounded bg-white space-y-3">
          <h2 className="font-semibold">{editingMaterial ? 'Edit Raw Material' : 'Add Raw Material'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-sm text-gray-700">Name *</span>
              <input name="name" className="w-full border rounded px-3 py-2" required defaultValue={editingMaterial?.name} />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-gray-700">SKU *</span>
              <input name="sku" className="w-full border rounded px-3 py-2" required defaultValue={editingMaterial?.sku} />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-gray-700">Unit (e.g., kg, liter, gram)</span>
              <input name="unit" className="w-full border rounded px-3 py-2" placeholder="unit" defaultValue={editingMaterial?.unit || 'unit'} />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-gray-700">Stock</span>
              <input name="stock" type="number" min="0" className="w-full border rounded px-3 py-2" defaultValue={editingMaterial?.stock || 0} />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-gray-700">Low Stock Alert At</span>
              <input name="lowStockAt" type="number" min="0" className="w-full border rounded px-3 py-2" defaultValue={editingMaterial?.lowStockAt || ''} />
            </label>
          </div>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">
            {loading ? 'Saving...' : editingMaterial ? 'Update' : 'Save'}
          </button>
        </form>
      )}

      <div className="p-4 border rounded bg-white">
        <h2 className="font-semibold mb-3">Raw Materials ({materials.length})</h2>
        <div className="space-y-2">
          {materials.map((m) => (
            <div key={m.id} className="flex items-center justify-between border rounded px-3 py-2">
              <div>
                <div className="font-medium">
                  {m.name} <span className="text-xs text-gray-500">({m.sku})</span>
                  {m.unit && <span className="ml-2 text-xs text-gray-600">Unit: {m.unit}</span>}
                </div>
                <div className="text-sm text-gray-600">
                  Stock: {m.stock}
                  {m.lowStockAt !== null && m.lowStockAt !== undefined && <span className="ml-2">Low stock alert: {m.lowStockAt}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleEdit(m)} className="text-sm px-2 py-1 border rounded hover:bg-gray-50">
                  Edit
                </button>
                <button onClick={() => handleDelete(m.id)} className="text-sm px-2 py-1 border rounded text-red-600 hover:bg-red-50">
                  Delete
                </button>
              </div>
            </div>
          ))}
          {materials.length === 0 && <p className="text-sm text-gray-600">No raw materials found.</p>}
        </div>
      </div>
    </div>
  );
}
