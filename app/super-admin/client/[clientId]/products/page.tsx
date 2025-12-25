'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function ClientProductsPage() {
    const params = useParams();
    const router = useRouter();
    const clientId = params.clientId as string;
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const res = await fetch(`/api/products?clientId=${clientId}`);
                if (res.ok) {
                    const data = await res.json();
                    setProducts(data);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchProducts();
    }, [clientId]);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 hover:bg-gray-200 rounded-full"
                >
                    <ArrowLeft className="h-6 w-6" />
                </button>
                <h1 className="text-2xl font-bold">Client Products</h1>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-3 font-semibold text-gray-700">Name</th>
                            <th className="px-6 py-3 font-semibold text-gray-700">SKU</th>
                            <th className="px-6 py-3 font-semibold text-gray-700">Price</th>
                            <th className="px-6 py-3 font-semibold text-gray-700">Stock</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">Loading products...</td></tr>
                        ) : products.length === 0 ? (
                            <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No products found.</td></tr>
                        ) : (
                            products.map((p) => (
                                <tr key={p.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-3 font-medium text-gray-900">{p.name}</td>
                                    <td className="px-6 py-3 text-gray-600 font-mono text-xs">{p.sku}</td>
                                    <td className="px-6 py-3 text-gray-600">{Number(p.price).toFixed(2)}</td>
                                    <td className="px-6 py-3">
                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${p.stock > 10 ? 'bg-green-100 text-green-800' :
                                                p.stock > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                            {p.stock}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
