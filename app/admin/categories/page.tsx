'use client';

import { useEffect, useState } from 'react';
import { AdminHeader } from '@/components/layout/AdminHeader';
import { useToast } from '@/components/notifications/ToastContainer';
import ConfirmationModal from '@/components/ConfirmationModal';

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
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const { showSuccess, showError } = useToast();

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

  const downloadSampleCSV = () => {
    const csvContent = 'name,isDefault\n' +
      'Electronics,false\n' +
      'Clothing,false\n' +
      'Food & Beverage,true';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'sample-categories.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      showError('Please upload a CSV file');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/categories/bulk-upload', {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();

      if (!res.ok) {
        showError(result.error || 'Upload failed');
        if (result.details) {
          console.error('Upload errors:', result.details);
        }
        return;
      }

      if (result.errors > 0) {
        const errorMsg = `Upload completed with ${result.errors} error(s). ${result.created} category(ies) created successfully.`;
        showError(errorMsg);
        if (result.details?.errors) {
          result.details.errors.forEach((err: string) => {
            showError(err);
          });
        }
      } else {
        showSuccess(`Successfully uploaded ${result.created} category(ies)!`);
      }

      // Reload categories
      await loadData(search);

      // Reset file input
      e.target.value = '';
      setShowBulkUpload(false);
    } catch (err: any) {
      showError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleBulkDelete = async () => {
    try {
      const res = await fetch('/api/categories/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryIds: selectedCategories }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete categories');
      }

      const result = await res.json();
      showSuccess(result.message || `Deleted ${result.deleted} category(ies)`);
      setSelectedCategories([]);
      setShowDeleteModal(false);
      await loadData(search);
    } catch (err: any) {
      showError(err.message || 'Failed to delete categories');
    }
  };

  const toggleCategorySelection = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const toggleSelectAll = () => {
    const deletableCategories = categories.filter(c => !c.isDefault);
    if (selectedCategories.length === deletableCategories.length && deletableCategories.length > 0) {
      setSelectedCategories([]);
    } else {
      setSelectedCategories(deletableCategories.map(c => c.id));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="Categories" />
      <div className="p-6 space-y-6">

        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search categories..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                loadData(e.target.value);
              }}
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div className="flex gap-2">
            {selectedCategories.length > 0 && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 whitespace-nowrap"
              >
                Delete Selected ({selectedCategories.length})
              </button>
            )}
            <button
              onClick={() => setShowBulkUpload(!showBulkUpload)}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 whitespace-nowrap"
            >
              {showBulkUpload ? 'Cancel Upload' : 'Bulk Upload CSV'}
            </button>
          </div>
        </div>

        {showBulkUpload && (
          <div className="p-4 border rounded bg-white space-y-4">
            <h2 className="font-semibold text-lg">Bulk Upload Categories via CSV</h2>

            <div className="bg-gray-50 p-3 rounded">
              <p className="text-sm text-gray-700 mb-2">
                <strong>Instructions:</strong> Download the sample CSV file, fill it with your category data following the format, then upload it.
              </p>
              <button
                type="button"
                onClick={downloadSampleCSV}
                className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
              >
                Download Sample CSV
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload CSV File
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                disabled={uploading}
              />
            </div>

            {uploading && (
              <div className="text-green-600">Uploading and processing CSV...</div>
            )}
          </div>
        )}

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

        <div className="p-4 border rounded bg-white shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 gap-4">
            <h2 className="font-semibold text-lg">Categories ({categories.length})</h2>
            {categories.filter(c => !c.isDefault).length > 0 && (
              <div className="flex items-center gap-4 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selectedCategories.length === categories.filter(c => !c.isDefault).length && selectedCategories.length > 0}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span>Select All Deletable</span>
                </label>
                {selectedCategories.length > 0 && (
                  <span className="text-sm text-blue-600 font-medium border-l pl-4">
                    {selectedCategories.length} selected
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="space-y-2">
            {categories.map((c) => (
              <div key={c.id} className={`flex items-center justify-between border rounded px-3 py-2 transition-colors ${selectedCategories.includes(c.id) ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'}`}>
                <div className="flex items-center gap-3">
                  {!c.isDefault && (
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(c.id)}
                      onChange={() => toggleCategorySelection(c.id)}
                      className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                  )}
                  <div className={`font-medium ${c.isDefault ? 'pl-7' : ''}`}>
                    {c.name} {c.isDefault && <span className="ml-2 text-xs font-semibold px-1.5 py-0.5 bg-green-100 text-green-700 rounded">Default</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleEdit(c)} className="text-sm px-2 py-1 border rounded bg-white hover:bg-gray-50 shadow-sm">
                    Edit
                  </button>
                  {!c.isDefault && (
                    <button onClick={() => handleDelete(c.id)} className="text-sm px-2 py-1 border rounded bg-white text-red-600 hover:bg-red-50 shadow-sm">
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
            {categories.length === 0 && <p className="text-sm text-gray-600 text-center py-4">No categories found.</p>}
          </div>
        </div>

        <ConfirmationModal
          isOpen={showDeleteModal}
          title="Delete Selected Categories"
          message={`Are you sure you want to delete ${selectedCategories.length} category(ies)? This action cannot be undone and will fail if categories are in use by products.`}
          onConfirm={handleBulkDelete}
          onCancel={() => setShowDeleteModal(false)}
          confirmVariant="danger"
          confirmText="Delete Categories"
        />

      </div>
    </div>
  );
}
