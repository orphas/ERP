"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthz } from "@/lib/useAuthz";
import UniversalListActions from "@/components/ui/UniversalListActions";

type Order = { id: number; reference: string };
type Delivery = { id: number; reference: string; status: string; order: { reference: string; customer?: { name: string } } };

export default function DeliveriesPage() {
  const { can } = useAuthz();
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [orderId, setOrderId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [carrier, setCarrier] = useState("");
  const [waybill, setWaybill] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    const [ordersData, deliveriesData] = await Promise.all([
      fetch("/api/sales/orders").then((r) => r.json()),
      fetch("/api/sales/deliveries").then((r) => r.json()),
    ]);
    setOrders(Array.isArray(ordersData) ? ordersData : []);
    setDeliveries(Array.isArray(deliveriesData) ? deliveriesData : []);
  };

  useEffect(() => {
    load();
  }, []);

  const createDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("/api/sales/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: Number(orderId),
          carrier,
          waybill,
          items: [{ orderId: Number(orderId), quantity: Number(quantity) }],
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to create delivery" }));
        throw new Error(data.error || "Failed to create delivery");
      }

      setOrderId("");
      setQuantity("1");
      setCarrier("");
      setWaybill("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create delivery");
    }
  };

  const deleteDelivery = async (id: number) => {
    if (!can(`/api/sales/deliveries/${id}`, "DELETE")) return;
    try {
      const res = await fetch(`/api/sales/deliveries/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to delete delivery" }));
        throw new Error(data.error || "Failed to delete delivery");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete delivery");
    }
  };

  return (
    <main className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Deliveries</h1>
          <p className="page-subtitle">Issue delivery notes for sales orders and track dispatch references.</p>
        </div>
        <a href="#new-delivery" className="btn-primary">+ Add Delivery</a>
      </div>

      <section id="new-delivery" className="card">
        <h2 className="text-lg font-semibold text-white mb-4">New Delivery</h2>
        {error && <div className="alert-error mb-4">{error}</div>}
        <form onSubmit={createDelivery} className="grid gap-3 md:grid-cols-5 items-end">
          <div className="form-group md:col-span-2">
            <label className="label">Order</label>
            <select className="input" value={orderId} onChange={(e) => setOrderId(e.target.value)} required>
              <option value="">Select order</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>{order.reference}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Qty</label>
            <input className="input" type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="label">Carrier</label>
            <input className="input" value={carrier} onChange={(e) => setCarrier(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="label">Waybill</label>
            <input className="input" value={waybill} onChange={(e) => setWaybill(e.target.value)} />
          </div>
          <button className="btn-primary" disabled={!can("/api/sales/deliveries", "POST")}>Create Delivery</button>
        </form>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Delivery Register</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Order</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((delivery) => (
                <tr key={delivery.id}>
                  <td className="font-medium">
                    <Link href={`/sales/deliveries/${delivery.id}`} className="text-cyan-300 hover:text-cyan-200">
                      {delivery.reference}
                    </Link>
                  </td>
                  <td>{delivery.order?.reference || "-"}</td>
                  <td>{delivery.order?.customer?.name || "-"}</td>
                  <td><span className="badge badge-blue">{delivery.status}</span></td>
                  <td>
                    <UniversalListActions
                      id={delivery.id}
                      deleteLabel="delivery note"
                      viewHref={`/sales/deliveries/${delivery.id}`}
                      printDocument="delivery"
                      canDelete={can(`/api/sales/deliveries/${delivery.id}`, "DELETE")}
                      onDelete={deleteDelivery}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
