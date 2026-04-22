"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";

type Category = { id: number; name: string };
type Unit = { id: number; name: string; code: string };

export default function NewProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    sku: "",
    price: "",
    cost: "",
    categoryId: "",
    unitId: "",
    minStockThreshold: "10",
  });

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [categoriesRes, unitsRes] = await Promise.all([
          fetch("/api/inventory/categories"),
          fetch("/api/inventory/units"),
        ]);
        const [categoriesData, unitsData] = await Promise.all([categoriesRes.json(), unitsRes.json()]);
        const categoriesList = Array.isArray(categoriesData) ? categoriesData : [];
        const unitsList = Array.isArray(unitsData) ? unitsData : [];
        setCategories(categoriesList);
        setUnits(unitsList);
        setFormData((prev) => ({
          ...prev,
          categoryId: prev.categoryId || (categoriesList[0] ? String(categoriesList[0].id) : ""),
        }));
      } catch {
        setError("Failed to load categories and units.");
      }
    };
    loadLookups();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/inventory/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          categoryId: parseInt(formData.categoryId),
          unitId: formData.unitId ? parseInt(formData.unitId) : null,
          price: parseFloat(formData.price),
          cost: parseFloat(formData.cost),
          minStockThreshold: parseInt(formData.minStockThreshold),
        }),
      });

      if (!res.ok) throw new Error("Failed to create product");

      router.push("/inventory/products");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/inventory/products" className="text-blue-600 hover:underline">
          ← Back to Products
        </Link>
        <h1 className="text-3xl font-bold">Add New Product</h1>
      </div>

      <div className="card max-w-2xl">
        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Product Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="input"
              placeholder="e.g., Widget Pro"
            />
          </div>

          <div>
            <label className="label">SKU (Stock Keeping Unit) *</label>
            <input
              type="text"
              name="sku"
              value={formData.sku}
              onChange={handleChange}
              required
              className="input"
              placeholder="e.g., WP-001"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category *</label>
              <select
                name="categoryId"
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                required
                className="input"
              >
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Unit</label>
              <select
                name="unitId"
                value={formData.unitId}
                onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
                className="input"
              >
                <option value="">No unit</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>{unit.code} - {unit.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Price (MAD) *</label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
                required
                step="0.01"
                className="input"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="label">Cost (MAD) *</label>
              <input
                type="number"
                name="cost"
                value={formData.cost}
                onChange={handleChange}
                required
                step="0.01"
                className="input"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="input"
              rows={4}
              placeholder="Product description..."
            />
          </div>

          <div>
            <label className="label">Min Stock Threshold</label>
            <input
              type="number"
              name="minStockThreshold"
              value={formData.minStockThreshold}
              onChange={handleChange}
              className="input"
              placeholder="10"
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Creating..." : "Create Product"}
            </button>
            <Link href="/inventory/products" className="btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
