"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Category {
  id: number;
  name: string;
  description: string;
}

export default function CategoriesList() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setError("");
      const res = await fetch("/api/inventory/categories");
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const message = data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : "Failed to fetch categories";
        throw new Error(message);
      }

      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching categories:", error);
      setCategories([]);
      setError(error instanceof Error ? error.message : "Failed to fetch categories");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      const res = await fetch("/api/inventory/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, description: "" }),
      });

      if (!res.ok) throw new Error("Failed to create category");

      setNewName("");
      fetchCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/inventory" className="text-blue-600 hover:underline">
          ← Back to Inventory
        </Link>
        <h1 className="text-3xl font-bold">Product Categories</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add New Category */}
        <div className="card lg:col-span-1">
          <h2 className="text-lg font-bold mb-4">Add Category</h2>
          {error && <div className="bg-red-100 text-red-700 px-3 py-2 rounded mb-3 text-sm">{error}</div>}
          <form onSubmit={handleAdd} className="space-y-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Category name"
              className="input"
              required
            />
            <button type="submit" className="btn-primary w-full">
              Add Category
            </button>
          </form>
        </div>

        {/* Categories List */}
        <div className="lg:col-span-2">
          <div className="card">
            <h2 className="text-lg font-bold mb-4">All Categories</h2>

            {loading ? (
              <p className="text-gray-500">Loading...</p>
            ) : categories.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No categories yet</p>
            ) : (
              <div className="space-y-2">
                {categories.map((category) => (
                  <div key={category.id} className="p-3 bg-gray-50 rounded flex justify-between items-center hover:bg-gray-100">
                    <div>
                      <h3 className="font-medium">{category.name}</h3>
                      {category.description && <p className="text-sm text-gray-600">{category.description}</p>}
                    </div>
                    <button className="text-gray-400 hover:text-red-600">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
