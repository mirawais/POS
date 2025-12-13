'use client';

import { useEffect, useState, useMemo } from 'react';

type Product = {
  id: string;
  name: string;
  sku: string;
  price: number;
  costPrice?: number | null;
  stock: number;
  type: 'SIMPLE' | 'VARIANT' | 'COMPOSITE';
  category?: { name: string } | null;
  defaultTax?: { name: string; percent: number } | null;
  variants?: Array<{ id: string; name?: string | null; sku?: string | null; price: number; attributes?: any }>;
  materials?: Array<{ rawMaterial: { name: string; sku: string; unit?: string | null }; quantity: number; unit?: string | null }>;
};

type Category = { id: string; name: string };
type Tax = { id: string; name: string; percent: number };
type RawMaterial = { id: string; name: string; sku: string; unit?: string | null };

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productType, setProductType] = useState<'SIMPLE' | 'VARIANT' | 'COMPOSITE'>('SIMPLE');
  const [search, setSearch] = useState('');
  const [materialSearch, setMaterialSearch] = useState('');
  const [selectedMaterials, setSelectedMaterials] = useState<Array<{ id: string; quantity: number; unit: string }>>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (searchTerm = '') => {
    const params = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : '';
    const [p, c, t, rm] = await Promise.all([
      fetch(`/api/products${params}`).then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/taxes').then((r) => r.json()),
      fetch('/api/raw-materials').then((r) => r.json()),
    ]);
    setProducts(p);
    setCategories(c);
    setTaxes(t);
    setRawMaterials(rm);
  };

  const filteredMaterials = useMemo(() => {
    if (!materialSearch) return rawMaterials.slice(0, 10);
    const term = materialSearch.toLowerCase();
    return rawMaterials.filter((m) => m.name.toLowerCase().includes(term) || m.sku.toLowerCase().includes(term)).slice(0, 10);
  }, [rawMaterials, materialSearch]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const data: any = {
      name: formData.get('name'),
      sku: formData.get('sku'),
      price: formData.get('price'),
      costPrice: formData.get('costPrice') || null,
      stock: formData.get('stock') || 0,
      categoryId: formData.get('categoryId') || null,
      defaultTaxId: formData.get('defaultTaxId') || null,
      type: productType,
    };

    if (productType === 'VARIANT') {
      const variantLines = String(formData.get('variants') || '').trim().split('\n').filter(Boolean);
      data.variants = variantLines.map((line) => {
        const parts = line.split('|').map((p) => p.trim());
        const [name, color, size, weight, price, costPrice, sku, stock] = parts;
        const attrs: any = {};
        if (color) attrs.color = color;
        if (size) attrs.size = size;
        if (weight) attrs.weight = weight;
        return {
          name: name || null,
          sku: sku || null,
          price: Number(price) || 0,
          costPrice: costPrice ? Number(costPrice) : null,
          stock: stock ? Number(stock) : 0,
          attributes: Object.keys(attrs).length > 0 ? attrs : null,
        };
      }).filter((v) => !Number.isNaN(v.price));
    }

    if (productType === 'COMPOSITE') {
      data.rawMaterials = selectedMaterials.map((m) => ({
        rawMaterialId: m.id,
        quantity: m.quantity,
        unit: m.unit,
      }));
    }

    try {
      const url = editingProduct ? `/api/products?id=${editingProduct.id}` : '/api/products';
      const method = editingProduct ? 'PATCH' : 'POST';
      if (editingProduct) data.id = editingProduct.id;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save product');
      }
      await loadData(search);
      (e.target as HTMLFormElement).reset();
      setShowForm(false);
      setEditingProduct(null);
      setSelectedMaterials([]);
      setProductType('SIMPLE');
    } catch (err: any) {
      alert(err.message || 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      const res = await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete product');
      await loadData(search);
    } catch (err: any) {
      alert(err.message || 'Failed to delete product');
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setProductType(product.type);
    if (product.type === 'COMPOSITE' && product.materials) {
      setSelectedMaterials(
        product.materials.map((m: any) => ({
          id: m.rawMaterial.id,
          quantity: Number(m.quantity),
          unit: m.unit || m.rawMaterial.unit || 'unit',
        }))
      );
    }
    setShowForm(true);
  };

  const addMaterial = (materialId: string) => {
    const material = rawMaterials.find((m) => m.id === materialId);
    if (!material || selectedMaterials.find((m) => m.id === materialId)) return;
    setSelectedMaterials([...selectedMaterials, { id: materialId, quantity: 1, unit: material.unit || 'unit' }]);
    setMaterialSearch('');
  };

  const removeMaterial = (materialId: string) => {
    setSelectedMaterials(selectedMaterials.filter((m) => m.id !== materialId));
  };

  const updateMaterialQuantity = (materialId: string, quantity: number, unit?: string) => {
    setSelectedMaterials(
      selectedMaterials.map((m) => (m.id === materialId ? { ...m, quantity: Number(quantity) || 1, unit: unit || m.unit } : m))
    );
  };

  const defaultCategory = categories.find((c) => c.name === 'General' || (c as any).isDefault);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="mt-2 text-gray-600">Manage Simple, Variant, and Compound products.</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditingProduct(null); setSelectedMaterials([]); setProductType('SIMPLE'); }} className="px-4 py-2 bg-blue-600 text-white rounded">
          {showForm ? 'Cancel' : 'Add Product'}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Search products by name or SKU..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            loadData(e.target.value);
          }}
          className="flex-1 border rounded px-3 py-2"
        />
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="p-4 border rounded bg-white space-y-4">
          <h2 className="font-semibold">{editingProduct ? 'Edit Product' : 'Add Product'}</h2>

          <label className="space-y-1 block">
            <span className="text-sm text-gray-700">Product Type *</span>
            <select
              value={productType}
              onChange={(e) => setProductType(e.target.value as any)}
              className="w-full border rounded px-3 py-2"
              required
              disabled={!!editingProduct}
            >
              <option value="SIMPLE">Simple Product</option>
              <option value="VARIANT">Variant Product (with attributes)</option>
              <option value="COMPOSITE">Compound Product (from raw materials)</option>
            </select>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-sm text-gray-700">Name *</span>
              <input name="name" className="w-full border rounded px-3 py-2" required defaultValue={editingProduct?.name} />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-gray-700">SKU *</span>
              <input name="sku" className="w-full border rounded px-3 py-2" required defaultValue={editingProduct?.sku} />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-gray-700">Selling Price *</span>
              <input name="price" type="number" step="0.01" min="0" className="w-full border rounded px-3 py-2" required defaultValue={editingProduct?.price} />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-gray-700">Cost Price (optional)</span>
              <input name="costPrice" type="number" step="0.01" min="0" className="w-full border rounded px-3 py-2" defaultValue={editingProduct?.costPrice ? Number(editingProduct.costPrice) : ''} />
            </label>
            {productType === 'SIMPLE' && (
              <label className="space-y-1">
                <span className="text-sm text-gray-700">Stock</span>
                <input name="stock" type="number" min="0" className="w-full border rounded px-3 py-2" defaultValue={editingProduct?.stock || 0} />
              </label>
            )}
            <label className="space-y-1">
              <span className="text-sm text-gray-700">Category</span>
              <select name="categoryId" className="w-full border rounded px-3 py-2" defaultValue={editingProduct?.category?.id || defaultCategory?.id || ''}>
                <option value="">General</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm text-gray-700">Default Tax</span>
              <select name="defaultTaxId" className="w-full border rounded px-3 py-2" defaultValue={editingProduct?.defaultTax?.id || ''}>
                <option value="">None</option>
                {taxes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.percent}%)
                  </option>
                ))}
              </select>
            </label>
          </div>

          {productType === 'VARIANT' && (
            <label className="space-y-1 block">
              <span className="text-sm text-gray-700">Variants (one per line)</span>
              <span className="text-xs text-gray-500 block mb-1">
                Format: name|color|size|weight|price|costPrice|sku|stock
              </span>
              <textarea
                name="variants"
                className="w-full border rounded px-3 py-2"
                rows={5}
                placeholder="Red T-Shirt|Red|Small||25.00|15.00|TSH-RED-S|10&#10;Red T-Shirt|Red|Large||27.00|16.00|TSH-RED-L|10"
                defaultValue={editingProduct?.variants?.map((v) => `${v.name || ''}|${v.attributes?.color || ''}|${v.attributes?.size || ''}|${v.attributes?.weight || ''}|${v.price}|${v.sku || ''}`).join('\n')}
              />
              <span className="text-xs text-gray-500">Price is required. Color, size, weight, cost, sku, stock are optional.</span>
            </label>
          )}

          {productType === 'COMPOSITE' && (
            <div className="space-y-2">
              <label className="space-y-1 block">
                <span className="text-sm text-gray-700">Add Raw Material</span>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search raw materials..."
                    value={materialSearch}
                    onChange={(e) => setMaterialSearch(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                  />
                  {materialSearch && filteredMaterials.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-lg max-h-48 overflow-auto">
                      {filteredMaterials.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => addMaterial(m.id)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50"
                        >
                          {m.name} ({m.sku}) {m.unit && `- ${m.unit}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </label>
              <div className="space-y-2">
                {selectedMaterials.map((sm) => {
                  const material = rawMaterials.find((m) => m.id === sm.id);
                  return (
                    <div key={sm.id} className="flex items-center gap-2 p-2 border rounded">
                      <div className="flex-1">
                        <div className="font-medium">{material?.name}</div>
                        <div className="text-xs text-gray-500">{material?.sku}</div>
                      </div>
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        value={sm.quantity}
                        onChange={(e) => updateMaterialQuantity(sm.id, Number(e.target.value))}
                        className="w-24 border rounded px-2 py-1 text-sm"
                        placeholder="Qty"
                      />
                      <input
                        type="text"
                        value={sm.unit}
                        onChange={(e) => updateMaterialQuantity(sm.id, sm.quantity, e.target.value)}
                        className="w-20 border rounded px-2 py-1 text-sm"
                        placeholder="Unit"
                      />
                      <button type="button" onClick={() => removeMaterial(sm.id)} className="text-red-600 text-sm">
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">
            {loading ? 'Saving...' : editingProduct ? 'Update Product' : 'Save Product'}
          </button>
        </form>
      )}

      <div className="p-4 border rounded bg-white">
        <h2 className="font-semibold mb-3">Products ({products.length})</h2>
        <div className="space-y-2">
          {products.map((p) => (
            <div key={p.id} className="border rounded px-3 py-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-medium">
                    {p.name} <span className="text-xs text-gray-500">({p.sku})</span>
                    <span className="ml-2 text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">{p.type}</span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    ${Number(p.price).toFixed(2)}
                    {p.costPrice && <span className="ml-2">Cost: ${Number(p.costPrice).toFixed(2)}</span>}
                    {p.type === 'SIMPLE' && <span className="ml-2">Stock: {p.stock}</span>}
                    {' • '}
                    {p.category?.name ?? 'General'}
                    {p.defaultTax && ` • Tax: ${p.defaultTax.name} (${p.defaultTax.percent}%)`}
                  </div>
                  {p.variants && p.variants.length > 0 && (
                    <div className="text-xs text-gray-600 mt-2">
                      <strong>Variants:</strong>{' '}
                      {p.variants.map((v, i) => (
                        <span key={v.id || i}>
                          {v.name || 'Variant'} ({Object.entries(v.attributes || {}).map(([k, v]) => `${k}: ${v}`).join(', ')}) @ ${Number(v.price).toFixed(2)}
                          {i < p.variants!.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                  {p.materials && p.materials.length > 0 && (
                    <div className="text-xs text-gray-600 mt-2">
                      <strong>Raw Materials:</strong>{' '}
                      {p.materials.map((m, i) => (
                        <span key={i}>
                          {m.rawMaterial.name} ({m.quantity} {m.unit || m.rawMaterial.unit || 'unit'})
                          {i < p.materials!.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button onClick={() => handleEdit(p)} className="text-sm px-2 py-1 border rounded hover:bg-gray-50">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="text-sm px-2 py-1 border rounded text-red-600 hover:bg-red-50">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
          {products.length === 0 && <p className="text-sm text-gray-600">No products found.</p>}
        </div>
      </div>
    </div>
  );
}
