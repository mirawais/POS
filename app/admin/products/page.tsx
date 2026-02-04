'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState, useMemo } from 'react';
import { useToast } from '@/components/notifications/ToastContainer';
import { AdminHeader } from '@/components/layout/AdminHeader';
import ConfirmationModal from '@/components/ConfirmationModal';

type Product = {
  id: string;
  name: string;
  sku: string;
  price: number;
  costPrice?: number | null;
  stock: number;
  type: 'SIMPLE' | 'VARIANT' | 'COMPOSITE';
  isFavorite?: boolean;
  isUnlimited?: boolean;
  category?: { id: string; name: string } | null;
  defaultTax?: { id: string; name: string; percent: number } | null;
  variants?: Array<{ id: string; name?: string | null; sku?: string | null; price: number; attributes?: any }>;
  materials?: Array<{ rawMaterial: { name: string; sku: string; unit?: string | null }; quantity: number; unit?: string | null }>;
};

type Category = { id: string; name: string };
type Tax = { id: string; name: string; percent: number };
type RawMaterial = { id: string; name: string; sku: string; unit?: string | null };
type VariantAttribute = { id: string; name: string; values: string[] };

export default function AdminProductsPage() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const canDelete = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || (user?.role === 'MANAGER' && user?.permissions?.delete_products);
  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || (user?.role === 'MANAGER' && user?.permissions?.manage_products);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [variantAttributes, setVariantAttributes] = useState<VariantAttribute[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productType, setProductType] = useState<'SIMPLE' | 'VARIANT' | 'COMPOSITE'>('SIMPLE');
  const [search, setSearch] = useState('');
  const [materialSearch, setMaterialSearch] = useState('');
  const [selectedMaterials, setSelectedMaterials] = useState<Array<{ id: string; quantity: number; unit: string }>>([]);
  const [variants, setVariants] = useState<Array<{ name: string; attributes: Record<string, string>; price: number; costPrice?: number; sku?: string; stock: number }>>([]);
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([]); // Selected attribute IDs for this product
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [bulkUploadType, setBulkUploadType] = useState<'SIMPLE' | 'VARIANT' | 'COMPOSITE'>('SIMPLE');
  const [uploading, setUploading] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (searchTerm = '') => {
    const params = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : '';
    const [p, c, t, rm, va] = await Promise.all([
      fetch(`/api/products${params}`).then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/taxes').then((r) => r.json()),
      fetch('/api/raw-materials').then((r) => r.json()),
      fetch('/api/variant-attributes').then((r) => r.json()),
    ]);

    if (Array.isArray(p)) {
      setProducts(p);
    } else {
      console.error('Failed to load products:', p);
      showError(p.error || 'Failed to load products');
      setProducts([]);
    }

    setCategories(c);
    setTaxes(t);
    setRawMaterials(rm);
    setVariantAttributes(va);
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
      isFavorite: formData.get('isFavorite') === 'on',
      isUnlimited: formData.get('isUnlimited') === 'on',
      type: productType,
    };

    if (productType === 'VARIANT') {
      data.variants = variants.filter((v) => !Number.isNaN(v.price) && v.price > 0);
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
      setVariants([]);
      setSelectedAttributes([]);
      setProductType('SIMPLE');
    } catch (err: any) {
      showError(err.message || 'Failed to save product');
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
      showError(err.message || 'Failed to delete product');
    }
  };

  const handleBulkDelete = async () => {
    try {
      const res = await fetch('/api/products/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: selectedProducts }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete products');
      }

      const result = await res.json();
      showSuccess(result.message || `Deleted ${result.deleted} product(s)`);
      setSelectedProducts([]);
      setShowDeleteModal(false);
      await loadData(search);
    } catch (err: any) {
      showError(err.message || 'Failed to delete products');
    }
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedProducts.length === products.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(products.map(p => p.id));
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setProductType(product.type);
    if (product.type === 'VARIANT' && product.variants) {
      setVariants(
        product.variants.map((v: any) => ({
          name: v.name || '',
          attributes: v.attributes || {},
          price: Number(v.price),
          costPrice: v.costPrice ? Number(v.costPrice) : undefined,
          sku: v.sku || '',
          stock: v.stock || 0,
        }))
      );
      // Determine which attributes are used in this product's variants
      const usedAttributeNames = new Set<string>();
      product.variants.forEach((v: any) => {
        if (v.attributes) {
          Object.keys(v.attributes).forEach((key) => usedAttributeNames.add(key));
        }
      });
      // Find attribute IDs that match the used names
      const usedAttrIds = variantAttributes
        .filter((attr) => usedAttributeNames.has(attr.name))
        .map((attr) => attr.id);
      setSelectedAttributes(usedAttrIds);
    } else {
      setVariants([]);
      setSelectedAttributes([]);
    }
    if (product.type === 'COMPOSITE' && product.materials) {
      setSelectedMaterials(
        product.materials.map((m: any) => ({
          id: m.rawMaterial.id,
          quantity: Number(m.quantity),
          unit: m.unit || m.rawMaterial.unit || 'unit',
        }))
      );
    } else {
      setSelectedMaterials([]);
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

  const defaultCategory: Category | undefined = categories.find((c) => c.name === 'General' || (c as any).isDefault);

  const downloadSampleCSV = () => {
    let csvContent = '';
    let filename = '';

    if (bulkUploadType === 'SIMPLE') {
      filename = 'sample-simple-products.csv';
      csvContent = 'name,sku,price,costPrice,stock,category,tax,lowStockAt\n' +
        'Sample Product 1,SKU001,100.00,50.00,100,General,GST,10\n' +
        'Sample Product 2,SKU002,200.00,100.00,50,General,PST,5';
    } else if (bulkUploadType === 'VARIANT') {
      filename = 'sample-variant-products.csv';
      csvContent = 'name,sku,attributes,price,costPrice,stock,category,tax,variantName,variantSku,lowStockAt\n' +
        'T-Shirt,TSHIRT001,"Color:Red,Size:L",500.00,250.00,50,General,GST,Red Large,TSHIRT001-RED-L,10\n' +
        'T-Shirt,TSHIRT002,"Color:Blue,Size:M",500.00,250.00,30,General,GST,Blue Medium,TSHIRT002-BLUE-M,5';
    } else if (bulkUploadType === 'COMPOSITE') {
      filename = 'sample-compound-products.csv';
      csvContent = 'name,sku,rawMaterials,price,costPrice,category,tax,lowStockAt\n' +
        'Pizza,PIZZA001,"FLOUR001:2:kg,CHEESE001:0.5:kg,TOMATO001:0.3:kg",800.00,400.00,General,GST,10\n' +
        'Burger,BURGER001,"BREAD001:1:unit,PATTY001:1:unit,LETTUCE001:0.1:kg",600.00,300.00,General,GST,5';
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
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
      formData.append('productType', bulkUploadType);

      const res = await fetch('/api/products/bulk-upload', {
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
        const errorMsg = `Upload completed with ${result.errors} error(s). ${result.created} product(s) created successfully.`;
        showError(errorMsg);
        if (result.details?.errors) {
          result.details.errors.forEach((err: string) => {
            showError(err);
          });
        }
      } else {
        showSuccess(`Successfully uploaded ${result.created} product(s)!`);
      }

      // Reload products
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

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="Products" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Products</h1>
            <p className="mt-2 text-gray-600">Manage Simple, Variant, and Compound products.</p>
          </div>
          <div className="flex gap-2">
            {selectedProducts.length > 0 && canDelete && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete Selected ({selectedProducts.length})
              </button>
            )}
            {canManage && (
              <>
                <button onClick={() => { setShowBulkUpload(!showBulkUpload); setShowForm(false); }} className="px-4 py-2 bg-green-600 text-white rounded">
                  {showBulkUpload ? 'Cancel Upload' : 'Bulk Upload CSV'}
                </button>
                <button onClick={() => { setShowForm(!showForm); setEditingProduct(null); setSelectedMaterials([]); setVariants([]); setSelectedAttributes([]); setProductType('SIMPLE'); setShowBulkUpload(false); }} className="px-4 py-2 bg-blue-600 text-white rounded">
                  {showForm ? 'Cancel' : 'Add Product'}
                </button>
              </>
            )}
          </div>
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

        {showBulkUpload && (
          <div className="p-4 border rounded bg-white space-y-4">
            <h2 className="font-semibold text-lg">Bulk Upload Products via CSV</h2>

            <div className="flex gap-2 border-b">
              <button
                type="button"
                onClick={() => setBulkUploadType('SIMPLE')}
                className={`px-4 py-2 ${bulkUploadType === 'SIMPLE' ? 'bg-blue-600 text-white' : 'bg-gray-200'} rounded-t`}
              >
                Simple Products
              </button>
              <button
                type="button"
                onClick={() => setBulkUploadType('VARIANT')}
                className={`px-4 py-2 ${bulkUploadType === 'VARIANT' ? 'bg-blue-600 text-white' : 'bg-gray-200'} rounded-t`}
              >
                Variant Products
              </button>
              <button
                type="button"
                onClick={() => setBulkUploadType('COMPOSITE')}
                className={`px-4 py-2 ${bulkUploadType === 'COMPOSITE' ? 'bg-blue-600 text-white' : 'bg-gray-200'} rounded-t`}
              >
                Compound Products
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-sm text-gray-700 mb-2">
                  <strong>Instructions:</strong> Download the sample CSV file, fill it with your product data following the format, then upload it.
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
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  disabled={uploading}
                />
              </div>

              {uploading && (
                <div className="text-blue-600">Uploading and processing CSV...</div>
              )}
            </div>
          </div>
        )}

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

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                name="isFavorite"
                className="w-4 h-4 rounded border-gray-300"
                defaultChecked={editingProduct?.isFavorite}
              />
              <span className="text-sm text-gray-700 font-medium">Favorite Product</span>
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
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700">Stock</span>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        name="isUnlimited"
                        className="w-4 h-4 rounded border-gray-300"
                        defaultChecked={editingProduct?.isUnlimited}
                        onChange={(e) => {
                          const stockInput = document.querySelector('input[name="stock"]') as HTMLInputElement;
                          if (stockInput) stockInput.disabled = e.target.checked;
                        }}
                      />
                      <span className="text-xs text-gray-600">Unlimited Quantity</span>
                    </label>
                  </div>
                  <input
                    name="stock"
                    type="number"
                    min="0"
                    className="w-full border rounded px-3 py-2 disabled:bg-gray-100 disabled:text-gray-500"
                    defaultValue={editingProduct?.stock || 0}
                    disabled={editingProduct?.isUnlimited}
                  />
                </div>
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
              <div className="space-y-3">
                <div className="p-3 border rounded bg-gray-50">
                  <label className="block text-sm text-gray-700 font-medium mb-2">
                    Select Attributes for This Product
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {variantAttributes.map((attr) => (
                      <label key={attr.id} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedAttributes.includes(attr.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAttributes([...selectedAttributes, attr.id]);
                            } else {
                              setSelectedAttributes(selectedAttributes.filter((id) => id !== attr.id));
                              // Remove this attribute from all variants
                              setVariants(
                                variants.map((v) => {
                                  const newAttrs = { ...v.attributes };
                                  delete newAttrs[attr.name];
                                  return { ...v, attributes: newAttrs };
                                })
                              );
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm text-gray-700">{attr.name}</span>
                      </label>
                    ))}
                  </div>
                  {variantAttributes.length === 0 && (
                    <p className="text-xs text-gray-500 mt-2">
                      No attributes defined. Create attributes in{' '}
                      <a href="/admin/settings/variant-attributes" className="text-blue-600 underline">
                        Variant Attributes
                      </a>{' '}
                      first.
                    </p>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-700 font-medium">Variants</span>
                  <button
                    type="button"
                    onClick={() => setVariants([...variants, { name: '', attributes: {}, price: 0, stock: 0 }])}
                    className="px-3 py-1 border rounded text-sm hover:bg-gray-50"
                    disabled={selectedAttributes.length === 0}
                  >
                    + Add Variant
                  </button>
                </div>
                {variants.map((variant, idx) => (
                  <div key={idx} className="p-3 border rounded space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-700 mb-1">Variant Name</label>
                        <select
                          value={variant.name || ''}
                          onChange={(e) => {
                            const newVariants = [...variants];
                            const selectedName = e.target.value;
                            newVariants[idx].name = selectedName;

                            // If the selected name is a combination (contains space), parse it and set attributes
                            if (selectedName.includes(' ')) {
                              const parts = selectedName.split(' ');
                              const selectedAttrs = variantAttributes.filter((attr) =>
                                selectedAttributes.includes(attr.id)
                              );

                              // Try to match parts to attribute values
                              const newAttributes: Record<string, string> = {};
                              parts.forEach((part) => {
                                selectedAttrs.forEach((attr) => {
                                  if (Array.isArray(attr.values) && attr.values.includes(part)) {
                                    newAttributes[attr.name] = part;
                                  }
                                });
                              });
                              newVariants[idx].attributes = { ...newVariants[idx].attributes, ...newAttributes };
                            } else {
                              // Single value - find which attribute it belongs to
                              const selectedAttrs = variantAttributes.filter((attr) =>
                                selectedAttributes.includes(attr.id)
                              );
                              selectedAttrs.forEach((attr) => {
                                if (Array.isArray(attr.values) && attr.values.includes(selectedName)) {
                                  newVariants[idx].attributes = {
                                    ...newVariants[idx].attributes,
                                    [attr.name]: selectedName
                                  };
                                }
                              });
                            }

                            setVariants(newVariants);
                          }}
                          className="w-full border rounded px-2 py-1 text-sm"
                          disabled={selectedAttributes.length === 0}
                        >
                          <option value="">
                            {selectedAttributes.length === 0
                              ? 'Select attributes first'
                              : 'Select variant name...'}
                          </option>
                          {variantAttributes
                            .filter((attr) => selectedAttributes.includes(attr.id))
                            .map((attr) => (
                              <optgroup key={attr.id} label={attr.name}>
                                {Array.isArray(attr.values) &&
                                  attr.values.map((val) => (
                                    <option key={val} value={val}>
                                      {val}
                                    </option>
                                  ))}
                              </optgroup>
                            ))}
                          {/* Generate all combinations if multiple attributes are selected */}
                          {variantAttributes.filter((attr) => selectedAttributes.includes(attr.id)).length > 1 && (
                            <optgroup label="Combinations">
                              {(() => {
                                const attrs = variantAttributes.filter((attr) =>
                                  selectedAttributes.includes(attr.id)
                                );
                                if (attrs.length === 0) return null;

                                // Generate all combinations
                                const combinations: string[] = [];
                                const generateCombinations = (
                                  current: string[],
                                  remaining: typeof attrs
                                ) => {
                                  if (remaining.length === 0) {
                                    if (current.length > 0) {
                                      combinations.push(current.join(' '));
                                    }
                                    return;
                                  }
                                  const [first, ...rest] = remaining;
                                  if (Array.isArray(first.values)) {
                                    first.values.forEach((val) => {
                                      generateCombinations([...current, val], rest);
                                    });
                                  }
                                };
                                generateCombinations([], attrs);

                                return combinations.map((combo) => (
                                  <option key={combo} value={combo}>
                                    {combo}
                                  </option>
                                ));
                              })()}
                            </optgroup>
                          )}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-700 mb-1">Price *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={variant.price}
                          onChange={(e) => {
                            const newVariants = [...variants];
                            newVariants[idx].price = Number(e.target.value) || 0;
                            setVariants(newVariants);
                          }}
                          className="w-full border rounded px-2 py-1 text-sm"
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {variantAttributes
                        .filter((attr) => selectedAttributes.includes(attr.id))
                        .map((attr) => (
                          <div key={attr.id}>
                            <label className="block text-xs text-gray-700 mb-1">{attr.name}</label>
                            <select
                              value={variant.attributes[attr.name] || ''}
                              onChange={(e) => {
                                const newVariants = [...variants];
                                if (!newVariants[idx].attributes) newVariants[idx].attributes = {};
                                newVariants[idx].attributes[attr.name] = e.target.value;
                                setVariants(newVariants);
                              }}
                              className="w-full border rounded px-2 py-1 text-sm"
                            >
                              <option value="">Select {attr.name}...</option>
                              {Array.isArray(attr.values) &&
                                attr.values.map((val) => (
                                  <option key={val} value={val}>
                                    {val}
                                  </option>
                                ))}
                            </select>
                          </div>
                        ))}
                    </div>
                    {selectedAttributes.length === 0 && (
                      <p className="text-xs text-gray-500">
                        Select attributes above to use them in variants.
                      </p>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-gray-700 mb-1">
                          Cost Price {variant.costPrice === undefined && '(will use product default)'}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={variant.costPrice !== undefined ? variant.costPrice : ''}
                          onChange={(e) => {
                            const newVariants = [...variants];
                            newVariants[idx].costPrice = e.target.value ? Number(e.target.value) : undefined;
                            setVariants(newVariants);
                          }}
                          placeholder="Leave empty = use product default"
                          className="w-full border rounded px-2 py-1 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-700 mb-1">SKU</label>
                        <input
                          type="text"
                          value={variant.sku || ''}
                          onChange={(e) => {
                            const newVariants = [...variants];
                            newVariants[idx].sku = e.target.value;
                            setVariants(newVariants);
                          }}
                          className="w-full border rounded px-2 py-1 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-700 mb-1">Stock</label>
                        <input
                          type="number"
                          min="0"
                          value={variant.stock}
                          onChange={(e) => {
                            const newVariants = [...variants];
                            newVariants[idx].stock = Number(e.target.value) || 0;
                            setVariants(newVariants);
                          }}
                          className="w-full border rounded px-2 py-1 text-sm"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setVariants(variants.filter((_, i) => i !== idx))}
                      className="w-full px-2 py-1 border rounded text-sm text-red-600 hover:bg-red-50"
                    >
                      Remove Variant
                    </button>
                  </div>
                ))}
                {variants.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-2">
                    No variants added. Click "+ Add Variant" to create variants.
                  </p>
                )}
              </div>
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
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 gap-4">
            <h2 className="font-semibold text-lg">Products ({products.length})</h2>
            {products.length > 0 && (
              <div className="flex items-center gap-4 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selectedProducts.length === products.length && products.length > 0}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                  />
                  <span>Select All Products</span>
                </label>
                {selectedProducts.length > 0 && (
                  <span className="text-sm text-blue-600 font-medium border-l pl-4">
                    {selectedProducts.length} selected
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="space-y-2">
            {products.map((p) => (
              <div key={p.id} className="border rounded px-3 py-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedProducts.includes(p.id)}
                      onChange={() => toggleProductSelection(p.id)}
                      className="mt-1 h-4 w-4 rounded"
                    />
                    <div className="flex-1">
                      <div className="font-medium">
                        {p.name} <span className="text-xs text-gray-500">({p.sku})</span>
                        <span className="ml-2 text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">{p.type}</span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        Rs. {Number(p.price).toFixed(2)}
                        {p.costPrice && <span className="ml-2">Cost: Rs. {Number(p.costPrice).toFixed(2)}</span>}
                        {p.type === 'SIMPLE' && (
                          <span className="ml-2">
                            Stock: {p.isUnlimited ? <span className="font-semibold text-green-600">Unlimited</span> : p.stock}
                          </span>
                        )}
                        {' • '}
                        {p.category?.name ?? 'General'}
                        {p.defaultTax && ` • Tax: ${p.defaultTax.name} (${p.defaultTax.percent}%)`}
                      </div>
                      {p.variants && p.variants.length > 0 && (
                        <div className="text-xs text-gray-600 mt-2">
                          <strong>Variants:</strong>{' '}
                          {p.variants.map((v, i) => (
                            <span key={v.id || i}>
                              {v.name || 'Variant'} ({Object.entries(v.attributes || {}).map(([k, v]) => `${k}: ${v}`).join(', ')}) @ Rs. {Number(v.price).toFixed(2)}
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
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {canManage && (
                      <button onClick={() => handleEdit(p)} className="text-sm px-2 py-1 border rounded hover:bg-gray-50">
                        Edit
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => handleDelete(p.id)} className="text-sm px-2 py-1 border rounded text-red-600 hover:bg-red-50">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {products.length === 0 && <p className="text-sm text-gray-600">No products found.</p>}
          </div>
        </div>

        <ConfirmationModal
          isOpen={showDeleteModal}
          title="Delete Selected Products"
          message={`Are you sure you want to delete ${selectedProducts.length} product(s)? This action cannot be undone.`}
          onConfirm={handleBulkDelete}
          onCancel={() => setShowDeleteModal(false)}
          confirmVariant="danger"
          confirmText="Delete Products"
        />
      </div>
    </div>
  );
}
