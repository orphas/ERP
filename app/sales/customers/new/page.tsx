"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UniversalActionBar, UniversalField, UniversalFormGrid, UniversalFormSection } from "@/components/ui/UniversalForm";

export default function NewCustomerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    deliveryAddress: "",
    ice: "",
    ifCode: "",
    rc: "",
    creditLimit: "0",
    defaultCreditTermDays: "30",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
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
      const creditLimit = Number(formData.creditLimit);
      const defaultCreditTermDays = Number(formData.defaultCreditTermDays);
      const res = await fetch("/api/sales/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          creditLimit: Number.isFinite(creditLimit) ? creditLimit : 0,
          defaultCreditTermDays: Number.isFinite(defaultCreditTermDays) ? defaultCreditTermDays : 30,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to create customer" }));
        throw new Error(data.error || "Failed to create customer");
      }

      router.push("/sales/customers");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/sales/customers" className="text-blue-600 hover:underline">
          ← Back to Customers
        </Link>
        <h1 className="text-3xl font-bold">Add New Customer</h1>
      </div>

      <UniversalFormSection
        title="Customer Creation"
        description="Use the universal customer form with commercial and fiscal fields."
        className="max-w-3xl"
      >
        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <h2 className="text-xl font-bold mt-6 mb-4">Basic Information</h2>

          <UniversalField label="Company Name *">
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="input"
              placeholder="e.g., ABC Trading Co."
            />
          </UniversalField>

          <UniversalFormGrid className="grid grid-cols-2 gap-4">
            <UniversalField label="Email">
              <input type="email" name="email" value={formData.email} onChange={handleChange} className="input" placeholder="contact@company.ma" />
            </UniversalField>
            <UniversalField label="Phone">
              <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="input" placeholder="+212 5XX XXX XXX" />
            </UniversalField>
          </UniversalFormGrid>

          <h2 className="text-xl font-bold mt-6 mb-4">Address Information</h2>

          <UniversalField label="Billing Address">
            <textarea name="address" value={formData.address} onChange={handleChange} className="input" rows={3} placeholder="Street address..." />
          </UniversalField>

          <UniversalField label="Delivery Address">
            <textarea name="deliveryAddress" value={formData.deliveryAddress} onChange={handleChange} className="input" rows={3} placeholder="Delivery address (if different)..." />
          </UniversalField>

          <h2 className="text-xl font-bold mt-6 mb-4">Tax Information</h2>

          <UniversalFormGrid className="grid grid-cols-3 gap-4">
            <UniversalField label="ICE (Identifiant Commun)">
              <input type="text" name="ice" value={formData.ice} onChange={handleChange} className="input" placeholder="15 digits" />
            </UniversalField>
            <UniversalField label="IF (Identifiant Fiscal)">
              <input type="text" name="ifCode" value={formData.ifCode} onChange={handleChange} className="input" />
            </UniversalField>
            <UniversalField label="RC (Registre Commerce)">
              <input type="text" name="rc" value={formData.rc} onChange={handleChange} className="input" />
            </UniversalField>
          </UniversalFormGrid>

          <h2 className="text-xl font-bold mt-6 mb-4">Business Terms</h2>

          <UniversalFormGrid className="grid grid-cols-2 gap-4">
            <UniversalField label="Default Credit Terms (days)">
              <select name="defaultCreditTermDays" value={formData.defaultCreditTermDays} onChange={handleChange} className="input">
                <option value="7">7 days</option>
                <option value="15">15 days</option>
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
              </select>
            </UniversalField>
          </UniversalFormGrid>

          <UniversalField label="Credit Limit (MAD)">
            <input type="number" name="creditLimit" value={formData.creditLimit} onChange={handleChange} step="0.01" className="input" placeholder="0.00" />
          </UniversalField>

          <UniversalActionBar className="flex gap-4 pt-4">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Creating..." : "Create Customer"}
            </button>
            <Link href="/sales/customers" className="btn-secondary">
              Cancel
            </Link>
          </UniversalActionBar>
        </form>
      </UniversalFormSection>
    </div>
  );
}
