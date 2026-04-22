"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthz } from "@/lib/useAuthz";

interface Product {
  id: number;
  name: string;
  sku: string;
  price: string;
  isActive?: boolean;
  category?: { name: string };
  unit?: { code?: string; name?: string } | null;
}

export default function ProductsList() {
  const { can } = useAuthz();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setActionError("");
      const res = await fetch("/api/inventory/products");
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const message = data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : "Failed to fetch products";
        throw new Error(message);
      }

      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching products:", error);
      setProducts([]);
      setActionError(error instanceof Error ? error.message : "Failed to fetch products");
    } finally {
      setLoading(false);
    }
  };

  const categories = Array.from(
    new Set(products.map((item) => item.category?.name).filter(Boolean) as string[])
  );

  const filteredProducts = products
    .filter((product) => {
      const query = search.trim().toLowerCase();
      const name = (product.name || "").toLowerCase();
      const sku = (product.sku || "").toLowerCase();
      const matchesSearch =
        !query ||
        name.includes(query) ||
        sku.includes(query);
      const matchesCategory =
        categoryFilter === "all" || (product.category?.name || "") === categoryFilter;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === "price_desc") return Number(b.price) - Number(a.price);
      if (sortBy === "price_asc") return Number(a.price) - Number(b.price);
      if (sortBy === "sku") return (a.sku || "").localeCompare(b.sku || "");
      return (a.name || "").localeCompare(b.name || "");
    });

  const totalValue = filteredProducts.reduce((sum, p) => sum + Number(p.price || 0), 0);

  const handleDelete = async (product: Product) => {
    const ok = window.confirm(`Delete product ${product.name}? This action permanently removes the product and may affect linked transactions.`);
    if (!ok) return;
    const typed = window.prompt("Type DELETE to confirm permanent deletion", "");
    if ((typed || "").trim().toUpperCase() !== "DELETE") return;

    try {
      const res = await fetch(`/api/inventory/products/${product.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Delete failed" }));
        throw new Error(data.error || "Delete failed");
      }
      await fetchProducts();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const handleEditSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingProduct) return;

    setSaving(true);
    setActionError("");

    try {
      const res = await fetch(`/api/inventory/products/${editingProduct.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingProduct.name,
          sku: editingProduct.sku,
          price: Number(editingProduct.price),
          isActive: editingProduct.isActive ?? true,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Update failed" }));
        throw new Error(data.error || "Update failed");
      }

      setEditingProduct(null);
      await fetchProducts();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">Catalog, pricing visibility, and quick filtering</p>
        </div>
        {can("/api/inventory/products", "POST") ? (
          <Link href="/inventory/products/new" className="btn-primary">
            + Add Product
          </Link>
        ) : (
          <button className="btn-secondary" disabled>
            + Add Product
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card-sm">
          <div className="stat-label">Filtered Products</div>
          <div className="stat-value text-cyan-300">{filteredProducts.length}</div>
        </div>
        <div className="card-sm">
          <div className="stat-label">Categories</div>
          <div className="stat-value text-emerald-300">{categories.length}</div>
        </div>
        <div className="card-sm">
          <div className="stat-label">Price Total (MAD)</div>
          <div className="stat-value text-amber-300">{totalValue.toFixed(2)}</div>
        </div>
      </div>

      <div className="card-sm grid gap-3 md:grid-cols-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by product or SKU"
          className="input-sm"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="input-sm"
        >
          <option value="all">All categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="input-sm">
          <option value="name">Sort: Name</option>
          <option value="sku">Sort: SKU</option>
          <option value="price_desc">Sort: Price high to low</option>
          <option value="price_asc">Sort: Price low to high</option>
        </select>
      </div>

      {actionError && <div className="alert-error">{actionError}</div>}

      {loading ? (
        <p className="text-slate-400">Loading...</p>
      ) : filteredProducts.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-slate-400 mb-4">No products match your filters</p>
          <Link href="/inventory/products/new" className="text-blue-600 hover:underline">
            Create your first product
          </Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id}>
                  <td className="font-medium">{product.name}</td>
                  <td className="text-sm text-slate-400">{product.sku}</td>
                  <td>{product.category?.name || "-"}</td>
                  <td>{product.unit?.code || product.unit?.name || "-"}</td>
                  <td className="font-semibold">MAD {product.price}</td>
                  <td className="space-x-3 whitespace-nowrap">
                    {can(`/api/inventory/products/${product.id}`, "PUT") ? (
                      <button onClick={() => setEditingProduct(product)} className="text-cyan-300 hover:text-cyan-200">
                        Edit
                      </button>
                    ) : (
                      <span className="text-slate-500">Edit</span>
                    )}
                    {can(`/api/inventory/products/${product.id}`, "DELETE") ? (
                      <button onClick={() => handleDelete(product)} className="text-red-300 hover:text-red-200">
                        Delete
                      </button>
                    ) : (
                      <span className="text-slate-500">Delete</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingProduct && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="text-lg font-semibold text-white">Edit Product</h2>
              <button className="btn-ghost btn-sm" onClick={() => setEditingProduct(null)}>
                Close
              </button>
            </div>
            <form onSubmit={handleEditSave}>
              <div className="modal-body grid gap-4">
                <div className="form-group">
                  <label className="label">Name</label>
                  <input
                    className="input"
                    value={editingProduct.name}
                    onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="label">SKU</label>
                  <input
                    className="input"
                    value={editingProduct.sku}
                    onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="label">Price (MAD)</label>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    value={editingProduct.price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: e.target.value })}
                    required
                  />
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={editingProduct.isActive ?? true}
                    onChange={(e) => setEditingProduct({ ...editingProduct, isActive: e.target.checked })}
                  />
                  Active product
                </label>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setEditingProduct(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
