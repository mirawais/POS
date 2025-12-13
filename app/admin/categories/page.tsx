'use client';

import { useEffect, useState } from 'react';

type Category = {
  id: string;
  name: string;
  isDefault: boolean;
};

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formName, setFormName] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (searchTerm = '') => {
    const params = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : '';
    const data = await fetch(`/api/categories${params}`).then((r) => r.json());
    setCategories(data);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setLoading(true);
    try {
      const url = editingCategory ? '/api/categories' : '/api/categories';
      const method = editingCategory ? 'PATCH' : 'POST';
      const body = editingCategory ? { id: editingCategory.id, name: formName.trim(), isDefault: formIsDefault } : { name: formName.trim(), isDefault: formIsDefault };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save category');
      }
      await loadData(search);
      setFormName('');
      setFormIsDefault(false);
      setEditingCategory(null);
    } catch (err: any) {
      alert(err.message || 'Failed to save category');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    try {
      const res = await fetch(`/api/categories?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete category');
      await loadData(search);
    } catch (err: any) {
      alert(err.message || 'Failed to delete category');
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormName(category.name);
    setFormIsDefault(category.isDefault);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Categories</h1>
        <p className="mt-2 text-gray-600">Manage product categories (General by default).</p>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Search categories..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            loadData(e.target.value);
          }}
          className="flex-1 border rounded px-3 py-2"
        />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border rounded bg-white space-y-3">
        <h2 className="font-semibold">{editingCategory ? 'Edit Category' : 'Add Category'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-sm text-gray-700">Name *</span>
            <input
              name="name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </label>
          <label className="flex items-center gap-2 mt-6">
            <input
              name="isDefault"
              type="checkbox"
              checked={formIsDefault}
              onChange={(e) => setFormIsDefault(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm text-gray-700">Set as default</span>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">
            {loading ? 'Saving...' : editingCategory ? 'Update' : 'Save'}
          </button>
          {editingCategory && (
            <button
              type="button"
              onClick={() => {
                setEditingCategory(null);
                setFormName('');
                setFormIsDefault(false);
              }}
              className="px-4 py-2 border rounded"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="p-4 border rounded bg-white">
        <h2 className="font-semibold mb-3">Categories ({categories.length})</h2>
        <div className="space-y-2">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between border rounded px-3 py-2">
              <div className="font-medium">
                {c.name} {c.isDefault && <span className="text-xs text-green-700">Default</span>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleEdit(c)} className="text-sm px-2 py-1 border rounded hover:bg-gray-50">
                  Edit
                </button>
                {!c.isDefault && (
                  <button onClick={() => handleDelete(c.id)} className="text-sm px-2 py-1 border rounded text-red-600 hover:bg-red-50">
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
          {categories.length === 0 && <p className="text-sm text-gray-600">No categories found.</p>}
        </div>
      </div>
    </div>
  );
}
