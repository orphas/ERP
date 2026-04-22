"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuthz } from "@/lib/useAuthz";

type DeliveryDetail = {
  id: number;
  reference: string;
  date: string;
  status: string;
  carrier?: string;
  waybill?: string;
  order?: { reference: string };
  items: Array<{ id: number; orderId: number; quantity: number }>;
};

export default function DeliveryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuthz();
  const [delivery, setDelivery] = useState<DeliveryDetail | null>(null);
  const [status, setStatus] = useState("pending");
  const [carrier, setCarrier] = useState("");
  const [waybill, setWaybill] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/sales/deliveries/${id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load delivery");
    setDelivery(data);
    setStatus(data.status || "pending");
    setCarrier(data.carrier || "");
    setWaybill(data.waybill || "");
  }, [id]);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Failed to load delivery"));
  }, [load]);

  const save = async () => {
    if (!can(`/api/sales/deliveries/${id}`, "PUT")) return;
    try {
      const res = await fetch(`/api/sales/deliveries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, carrier, waybill }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to update delivery" }));
        throw new Error(data.error || "Failed to update delivery");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update delivery");
    }
  };

  const remove = async () => {
    if (!can(`/api/sales/deliveries/${id}`, "DELETE")) return;
    if (!window.confirm("Delete this delivery? Delivered quantities and linked accounting entries will be reversed automatically.")) return;
    const typed = window.prompt("Type DELETE to confirm permanent deletion", "");
    if ((typed || "").trim().toUpperCase() !== "DELETE") return;
    try {
      const res = await fetch(`/api/sales/deliveries/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to delete delivery" }));
        throw new Error(data.error || "Failed to delete delivery");
      }
      window.location.href = "/sales/deliveries";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete delivery");
    }
  };

  if (!delivery) return <main className="card">Loading delivery...</main>;

  return (
    <main className="space-y-6">
      <div className="page-header"><div><h1 className="page-title">Delivery {delivery.reference}</h1><p className="page-subtitle">Order: {delivery.order?.reference || "-"}</p></div><div className="flex gap-2"><a href={`/api/print/delivery/${id}?lang=en`} target="_blank" rel="noreferrer" className="btn-secondary">Print EN</a><a href={`/api/print/delivery/${id}?lang=fr`} target="_blank" rel="noreferrer" className="btn-secondary">Print FR</a><Link href="/sales/deliveries" className="btn-secondary">Back to Deliveries</Link></div></div>
      {error && <div className="alert-error">{error}</div>}

      <section className="card grid gap-4 md:grid-cols-4">
        <div><div className="stat-label">Date</div><div>{new Date(delivery.date).toLocaleDateString()}</div></div>
        <div><div className="stat-label">Status</div><span className="badge badge-blue">{delivery.status}</span></div>
        <div><div className="stat-label">Carrier</div><div>{delivery.carrier || "-"}</div></div>
        <div><div className="stat-label">Waybill</div><div>{delivery.waybill || "-"}</div></div>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-white">Update Delivery</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="form-group"><label className="label">Status</label><select className="input" value={status} onChange={(e) => setStatus(e.target.value)} disabled={!can(`/api/sales/deliveries/${id}`, "PUT")}><option value="pending">pending</option><option value="partial">partial</option><option value="delivered">delivered</option></select></div>
          <div className="form-group"><label className="label">Carrier</label><input className="input" value={carrier} onChange={(e) => setCarrier(e.target.value)} disabled={!can(`/api/sales/deliveries/${id}`, "PUT")} /></div>
          <div className="form-group"><label className="label">Waybill</label><input className="input" value={waybill} onChange={(e) => setWaybill(e.target.value)} disabled={!can(`/api/sales/deliveries/${id}`, "PUT")} /></div>
        </div>
        <div className="flex gap-3 flex-wrap"><button className="btn-primary" onClick={save} disabled={!can(`/api/sales/deliveries/${id}`, "PUT")}>Save Delivery</button><button className="btn-danger" onClick={remove} disabled={!can(`/api/sales/deliveries/${id}`, "DELETE")}>Delete Delivery</button></div>
      </section>
    </main>
  );
}
