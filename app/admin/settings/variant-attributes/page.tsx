'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AdminHeader } from '@/components/layout/AdminHeader';
import { useToast } from '@/components/notifications/ToastContainer';
import ConfirmationModal from '@/components/ConfirmationModal';

type VariantAttribute = {
  id: string;
  name: string;
  values: string[];
};

export default function VariantAttributesPage() {
  const [attributes, setAttributes] = useState<VariantAttribute[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingAttribute, setEditingAttribute] = useState<VariantAttribute | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [attributeToDelete, setAttributeToDelete] = useState<VariantAttribute | null>(null);
  const { data: session } = useSession();
  const { showSuccess, showError } = useToast();

  const user = session?.user as any;
  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || (user?.role === 'MANAGER' && user?.permissions?.manage_variant_settings);
  const canDelete = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || (user?.role === 'MANAGER' && user?.permissions?.delete_variant_attributes);

  useEffect(() => {
    loadAttributes();
  }, [searchTerm]);

  const loadAttributes = async () => {
    const data = await fetch('/api/variant-attributes').then((r) => r.json());
    setAttributes(data);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const name = String(formData.get('name') || '').trim();
    const valuesStr = String(formData.get('values') || '').trim();
    const values = valuesStr
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);

    if (!name || values.length === 0) {
      showError('Name and at least one value are required');
      setLoading(false);
      return;
    }

    try {
      const method = editingAttribute ? 'PATCH' : 'POST';
      const url = editingAttribute
        ? '/api/variant-attributes'
        : '/api/variant-attributes';
      const body = editingAttribute
        ? { id: editingAttribute.id, name, values }
        : { name, values };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save attribute');
      }

      await loadAttributes();
      (e.target as HTMLFormElement).reset();
      setShowForm(false);
      setEditingAttribute(null);
    } catch (err: any) {
      showError(err.message || 'Failed to save attribute');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (attribute: VariantAttribute) => {
    setAttributeToDelete(attribute);
  };

  const confirmDelete = async () => {
    if (!attributeToDelete) return;
    try {
      const res = await fetch(`/api/variant-attributes?id=${attributeToDelete.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete attribute');
      showSuccess('Attribute deleted successfully');
      setAttributeToDelete(null);
      await loadAttributes();
    } catch (err: any) {
      showError(err.message || 'Failed to delete attribute');
    }
  };

  const filteredAttributes = attributes.filter(
    (attr) =>
      !searchTerm ||
      attr.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      attr.values.some((v) => v.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="Variant Attributes" />
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Variant Attributes</h1>
          <p className="mt-2 text-gray-600">
            Manage predefined attributes (size, color, weight, etc.) for variant products.
          </p>
        </div>

        <div className="p-4 border rounded bg-white">
          <div className="flex justify-between items-center mb-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search attributes..."
              className="flex-1 border rounded px-3 py-2 text-sm"
            />
            {canManage && (
              <button
                onClick={() => {
                  setShowForm(true);
                  setEditingAttribute(null);
                }}
                className="ml-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                + Add Attribute
              </button>
            )}
          </div>

          {showForm && (
            <form onSubmit={handleSubmit} className="mb-4 p-4 border rounded bg-gray-50">
              <h3 className="font-semibold mb-3">
                {editingAttribute ? 'Edit Attribute' : 'Add Attribute'}
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Attribute Name</label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={editingAttribute?.name || ''}
                    placeholder="e.g., Size, Color, Weight"
                    className="w-full border rounded px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Values (comma-separated)
                  </label>
                  <input
                    type="text"
                    name="values"
                    defaultValue={editingAttribute?.values.join(', ') || ''}
                    placeholder="e.g., S, M, L, XL or Red, Blue, Green"
                    className="w-full border rounded px-3 py-2 text-sm"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Separate multiple values with commas
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingAttribute(null);
                    }}
                    className="px-4 py-2 border rounded text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {filteredAttributes.map((attr) => (
              <div key={attr.id} className="flex justify-between items-center p-3 border rounded">
                <div>
                  <div className="font-medium">{attr.name}</div>
                  <div className="text-sm text-gray-600">
                    Values: {Array.isArray(attr.values) ? attr.values.join(', ') : 'N/A'}
                  </div>
                </div>
                <div className="flex gap-2">
                  {canManage && (
                    <button
                      onClick={() => {
                        setEditingAttribute(attr);
                        setShowForm(true);
                      }}
                      className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                    >
                      Edit
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(attr)}
                      className="px-3 py-1 border rounded text-sm text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
            {filteredAttributes.length === 0 && (
              <p className="text-gray-600 text-center py-4">No attributes found.</p>
            )}
          </div>
        </div>

        <ConfirmationModal
          isOpen={!!attributeToDelete}
          title="Delete Variant Attribute"
          message={`Are you sure you want to delete "${attributeToDelete?.name}"? This action cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setAttributeToDelete(null)}
          confirmVariant="danger"
          confirmText="Delete"
        />
      </div>
    </div>
  );
}

