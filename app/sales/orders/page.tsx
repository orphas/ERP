"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthz } from "@/lib/useAuthz";
import UniversalListActions from "@/components/ui/UniversalListActions";
import DataTable, { DataColumn } from "@/components/ui/DataTable";

type Customer = { id: number; name: string };
type Product = { id: number; name: string; price: string };
type Order = {
  id: number;
  reference: string;
  status: string;
  total: string;
  customer: Customer;
  _count?: { invoices: number; deliveries: number };
};
type OrderWithMeta = Order & {
  subtotal?: string;
  vatAmount?: string;
  date?: string;
  createdAt?: string;
  items?: Array<{ id: number; quantity: number; lineTotal: string }>;
};

type DraftOrderLine = {
  id: number;
  productId: string;
  quantity: string;
  unitPrice: string;
};

export default function OrdersPage() {
  const { can } = useAuthz();
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<DraftOrderLine[]>([
    { id: 1, productId: "", quantity: "1", unitPrice: "0" },
  ]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [ordersData, customerData, productData] = await Promise.all([
      fetch("/api/sales/orders").then((r) => r.json()),
      fetch("/api/sales/customers").then((r) => r.json()),
      fetch("/api/inventory/products").then((r) => r.json()),
    ]);

    setOrders(Array.isArray(ordersData) ? ordersData : []);
    setCustomers(Array.isArray(customerData) ? customerData : []);
    setProducts(Array.isArray(productData) ? productData : []);
  };

  useEffect(() => {
    load();
  }, []);

  const addLine = () => {
    setLines((prev) => [...prev, { id: Date.now(), productId: "", quantity: "1", unitPrice: "0" }]);
  };

  const removeLine = (id: number) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((line) => line.id !== id) : prev));
  };

  const updateLine = (id: number, patch: Partial<DraftOrderLine>) => {
    setLines((prev) => prev.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  };

  const createOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const normalizedItems = lines
        .map((line) => ({
          productId: Number(line.productId),
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
        }))
        .filter((line) => line.productId > 0 && line.quantity > 0 && line.unitPrice > 0);

      if (normalizedItems.length === 0) {
        throw new Error("Add at least one valid product line");
      }

      const res = await fetch("/api/sales/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: Number(customerId),
          items: normalizedItems,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to create order" }));
        throw new Error(data.error || "Failed to create order");
      }

      setCustomerId("");
  setLines([{ id: 1, productId: "", quantity: "1", unitPrice: "0" }]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create order");
    } finally {
      setSaving(false);
    }
  };

  const generateInvoice = async (id: number) => {
    if (!can(`/api/sales/orders/${id}/invoice`, "POST")) return;
    try {
      const res = await fetch(`/api/sales/orders/${id}/invoice`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to create invoice" }));
        throw new Error(data.error || "Failed to create invoice");
      }
      await load();
      setSuccess("Invoice created successfully.");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invoice");
    }
  };

  const deleteOrder = async (id: number) => {
    if (!can(`/api/sales/orders/${id}`, "DELETE")) return;
    try {
      const res = await fetch(`/api/sales/orders/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to delete order" }));
        throw new Error(data.error || "Failed to delete order");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete order");
    }
  };

  return (
    <main className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Sales Orders</h1>
          <p className="page-subtitle">Create customer orders and generate invoices from confirmed orders.</p>
        </div>
        <a href="#new-sales-order" className="btn-primary">+ Add Sales Order</a>
      </div>

      <section id="new-sales-order" className="card">
        <h2 className="text-lg font-semibold text-white mb-4">New Order</h2>
        {error && <div className="alert-error mb-4">{error}</div>}
        {success && <div className="alert-success mb-4">{success}</div>}
        <form onSubmit={createOrder} className="space-y-4">
          <div className="form-group">
            <label className="label">Customer</label>
            <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
              <option value="">Select customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            {lines.map((line) => (
              <div key={line.id} className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto] items-end">
                <div className="form-group">
                  <label className="label">Product</label>
                  <select
                    className="input"
                    value={line.productId}
                    onChange={(e) => {
                      const selected = products.find((p) => p.id === Number(e.target.value));
                      updateLine(line.id, {
                        productId: e.target.value,
                        unitPrice: selected ? String(Number(selected.price || 0)) : "0",
                      });
                    }}
                    required
                  >
                    <option value="">Select product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">Quantity</label>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    value={line.quantity}
                    onChange={(e) => updateLine(line.id, { quantity: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="label">Unit Price</label>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitPrice}
                    onChange={(e) => updateLine(line.id, { unitPrice: e.target.value })}
                    required
                  />
                </div>
                <button type="button" className="btn-secondary btn-sm" onClick={() => removeLine(line.id)}>Remove</button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-secondary" onClick={addLine}>+ Add Product Line</button>
            <button className="btn-primary" disabled={saving || !can("/api/sales/orders", "POST")}>
              {saving ? "Creating..." : "Create Order"}
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Order Register</h2>
        {(() => {
          const fmt = (v: string | number | null | undefined) => Number(v || 0).toFixed(2);
          const fmtDate = (v: string | null | undefined) => v ? new Date(v).toLocaleDateString() : "-";
          const orderCols: DataColumn<OrderWithMeta>[] = [
            {
              key: "reference", label: "Order #", sortable: true,
              getValue: (r) => r.reference,
              render: (r) => <Link href={`/sales/orders/${r.id}`} className="font-medium text-cyan-300 hover:text-cyan-200">{r.reference}</Link>,
            },
            {
              key: "customer", label: "Customer", sortable: true,
              getValue: (r) => r.customer?.name || "",
              render: (r) => r.customer?.name || "-",
            },
            {
              key: "status", label: "Status", sortable: true,
              getValue: (r) => r.status,
              render: (r) => {
                const cls = r.status === "delivered" ? "badge-green" : r.status === "shipped" ? "badge-cyan" : r.status === "cancelled" ? "badge-red" : "badge-blue";
                return <span className={`badge ${cls}`}>{r.status}</span>;
              },
            },
            {
              key: "itemCount", label: "Lines", sortable: true, defaultVisible: false,
              getValue: (r) => r.items?.length ?? 0,
              render: (r) => r.items?.length ?? 0,
            },
            {
              key: "subtotal", label: "Subtotal HT", defaultVisible: false, sortable: true,
              getValue: (r) => Number(r.subtotal ?? 0),
              render: (r) => fmt(r.subtotal),
            },
            {
              key: "vatAmount", label: "VAT", defaultVisible: false, sortable: true,
              getValue: (r) => Number(r.vatAmount ?? 0),
              render: (r) => fmt(r.vatAmount),
            },
            {
              key: "total", label: "Total", sortable: true,
              getValue: (r) => Number(r.total),
              render: (r) => <span className="font-semibold text-cyan-200">{fmt(r.total)}</span>,
            },
            {
              key: "invoiceCount", label: "Invoices", sortable: true,
              getValue: (r) => r._count?.invoices ?? 0,
              render: (r) => {
                const c = r._count?.invoices ?? 0;
                return c > 0 ? <span className="badge badge-green">{c}</span> : <span className="text-slate-500">0</span>;
              },
            },
            {
              key: "deliveryCount", label: "Deliveries", sortable: true, defaultVisible: false,
              getValue: (r) => r._count?.deliveries ?? 0,
              render: (r) => {
                const c = r._count?.deliveries ?? 0;
                return c > 0 ? <span className="badge badge-cyan">{c}</span> : <span className="text-slate-500">0</span>;
              },
            },
            {
              key: "date", label: "Date", defaultVisible: false, sortable: true,
              getValue: (r) => r.date || r.createdAt || "",
              render: (r) => fmtDate(r.date || r.createdAt),
            },
            {
              key: "actions", label: "Actions", sortable: false,
              render: (order) => (
                <UniversalListActions
                  id={order.id}
                  deleteLabel="sales order"
                  viewHref={`/sales/orders/${order.id}`}
                  printDocument="order"
                  canDelete={can(`/api/sales/orders/${order.id}`, "DELETE")}
                  onDelete={deleteOrder}
                >
                  {(order._count?.invoices ?? 0) > 0 ? (
                    <Link href="/sales/invoices" className="btn-secondary btn-xs">Invoice created</Link>
                  ) : (
                    <button className="btn-primary btn-xs" disabled={!can(`/api/sales/orders/${order.id}/invoice`, "POST")} onClick={() => generateInvoice(order.id)}>
                      Create Invoice
                    </button>
                  )}
                </UniversalListActions>
              ),
            },
          ];
          return <DataTable columns={orderCols} rows={orders as OrderWithMeta[]} rowKey={(r) => r.id} maxHeight="72vh" emptyMessage="No orders found." preferencesKey="sales.orders.register" />;
        })()}
      </section>
    </main>
  );
}
