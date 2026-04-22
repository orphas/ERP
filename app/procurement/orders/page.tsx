"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthz } from "@/lib/useAuthz";
import UniversalListActions from "@/components/ui/UniversalListActions";
import { UniversalActionBar, UniversalField, UniversalFormGrid, UniversalFormSection } from "@/components/ui/UniversalForm";
import DataTable, { DataColumn } from "@/components/ui/DataTable";

type Supplier = { id: number; name: string; defaultCurrency?: string };
type Product = { id: number; name: string; cost?: string; price?: string };
type POItem = { id: number; product?: Product; quantity: number; receivedQty: string; unitPrice: string; lineTotal: string };
type POExpense = { id: number; supplier?: Supplier; description: string; amount: string; vatRate: string; vatAmount: string; total: string };
type PurchaseOrder = {
  id: number;
  reference: string;
  purchaseType: string;
  status: string;
  currency?: string;
  total: string;
  supplier: Supplier;
  items: POItem[];
  expenses?: POExpense[];
};
type POWithMeta = PurchaseOrder & {
  subtotal?: string;
  vatAmount?: string;
  incoterm?: string;
  originCountry?: string;
  expectedPort?: string;
  date?: string;
  exchangeRate?: string;
};

type DraftPOLine = {
  id: number;
  productId: string;
  quantity: string;
  unitPrice: string;
};

type DraftPOExpense = {
  id: number;
  supplierId: string;
  description: string;
  amount: string;
  vatRate: string;
  externalRef: string;
};

export default function PurchaseOrdersPage() {
  const { can } = useAuthz();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [purchaseType, setPurchaseType] = useState("local");
  const [incoterm, setIncoterm] = useState("");
  const [originCountry, setOriginCountry] = useState("");
  const [expectedPort, setExpectedPort] = useState("");
  const [customsReference, setCustomsReference] = useState("");
  const [exchangeRate, setExchangeRate] = useState("");
  const [vatRate, setVatRate] = useState("20");
  const [lines, setLines] = useState<DraftPOLine[]>([
    { id: 1, productId: "", quantity: "1", unitPrice: "0" },
  ]);
  const [expenses, setExpenses] = useState<DraftPOExpense[]>([
    { id: 1, supplierId: "", description: "", amount: "0", vatRate: "0", externalRef: "" },
  ]);
  const [error, setError] = useState("");
  const selectedSupplier = suppliers.find((s) => s.id === Number(supplierId));
  const orderCurrency = (selectedSupplier?.defaultCurrency || "MAD").toUpperCase();

  const load = async () => {
    const [ordersData, suppliersData, productsData] = await Promise.all([
      fetch("/api/procurement/orders").then((r) => r.json()),
      fetch("/api/procurement/suppliers").then((r) => r.json()),
      fetch("/api/inventory/products").then((r) => r.json()),
    ]);

    setOrders(Array.isArray(ordersData) ? ordersData : []);
    setSuppliers(Array.isArray(suppliersData) ? suppliersData : []);
    setProducts(Array.isArray(productsData) ? productsData : []);
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

  const updateLine = (id: number, patch: Partial<DraftPOLine>) => {
    setLines((prev) => prev.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  };

  const addExpense = () => {
    setExpenses((prev) => [...prev, { id: Date.now(), supplierId: "", description: "", amount: "0", vatRate: "0", externalRef: "" }]);
  };

  const removeExpense = (id: number) => {
    setExpenses((prev) => (prev.length > 1 ? prev.filter((line) => line.id !== id) : prev));
  };

  const updateExpense = (id: number, patch: Partial<DraftPOExpense>) => {
    setExpenses((prev) => prev.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  };

  const createOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const normalizedItems = lines
        .map((line) => ({
          productId: Number(line.productId),
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
        }))
        .filter((line) => line.productId > 0 && line.quantity > 0 && line.unitPrice >= 0);

      const normalizedExpenses = purchaseType === "import"
        ? expenses
            .map((expense) => ({
              supplierId: Number(expense.supplierId),
              description: expense.description.trim(),
              externalRef: expense.externalRef.trim() || null,
              amount: Number(expense.amount),
              vatRate: Number(expense.vatRate),
            }))
            .filter((expense) => expense.supplierId > 0 && expense.description && expense.amount >= 0 && expense.vatRate >= 0)
        : [];

      if (normalizedItems.length === 0) {
        throw new Error("Add at least one valid product line");
      }

      if (purchaseType === "import" && !originCountry) {
        throw new Error("Origin country is required for international import POs");
      }

      const res = await fetch("/api/procurement/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: Number(supplierId),
          vatRate: Number(vatRate || 20),
          purchaseType,
          incoterm: purchaseType === "import" ? incoterm : null,
          originCountry: purchaseType === "import" ? originCountry : null,
          expectedPort: purchaseType === "import" ? expectedPort : null,
          customsReference: purchaseType === "import" ? customsReference : null,
          exchangeRate: purchaseType === "import" && exchangeRate ? Number(exchangeRate) : null,
          items: normalizedItems,
          expenses: normalizedExpenses,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to create purchase order" }));
        throw new Error(data.error || "Failed to create purchase order");
      }

      setSupplierId("");
  setPurchaseType("local");
  setIncoterm("");
  setOriginCountry("");
  setExpectedPort("");
  setCustomsReference("");
  setExchangeRate("");
  setVatRate("20");
  setLines([{ id: 1, productId: "", quantity: "1", unitPrice: "0" }]);
  setExpenses([{ id: 1, supplierId: "", description: "", amount: "0", vatRate: "0", externalRef: "" }]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create purchase order");
    }
  };

  const deletePurchaseOrder = async (id: number) => {
    if (!can(`/api/procurement/orders/${id}`, "DELETE")) return;
    try {
      const res = await fetch(`/api/procurement/orders/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to delete purchase order" }));
        throw new Error(data.error || "Failed to delete purchase order");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete purchase order");
    }
  };

  const receiveAll = async (order: PurchaseOrder) => {
    if (!can(`/api/procurement/orders/${order.id}/receive`, "POST")) return;
    try {
      const items = order.items
        .map((item) => {
          const remaining = item.quantity - Number(item.receivedQty || 0);
          return { itemId: item.id, receivedQty: remaining > 0 ? remaining : 0 };
        })
        .filter((item) => item.receivedQty > 0);

      if (items.length === 0) {
        throw new Error("No remaining quantity to receive");
      }

      const res = await fetch(`/api/procurement/orders/${order.id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to receive order" }));
        throw new Error(data.error || "Failed to receive order");
      }

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to receive order");
    }
  };

  return (
    <main className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Purchase Orders</h1>
          <p className="page-subtitle">Create supplier orders and mark received quantities.</p>
        </div>
        <a href="#new-purchase-order" className="btn-primary">+ Add Purchase Order</a>
      </div>

      <UniversalFormSection
        title="New Purchase Order"
        description="Use one universal purchase form for products from the main supplier and expenses paid to third-party suppliers."
      >
        {error && <div className="alert-error mb-4">{error}</div>}
        <form id="new-purchase-order" onSubmit={createOrder} className="space-y-4">
          <UniversalField label="Supplier">
            <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
              <option value="">Select supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({(s.defaultCurrency || "MAD").toUpperCase()})</option>
              ))}
            </select>
            {supplierId && (
              <p className="text-xs text-slate-400 mt-1">Order currency will be set to {orderCurrency} from the selected supplier profile.</p>
            )}
          </UniversalField>

          <UniversalFormGrid className="grid gap-3 md:grid-cols-3">
            <UniversalField label="Purchase Type">
              <select className="input" value={purchaseType} onChange={(e) => setPurchaseType(e.target.value)}>
                <option value="local">Local Purchase</option>
                <option value="import">International Import</option>
              </select>
            </UniversalField>
            {purchaseType === "import" && (
              <>
                <UniversalField label="Origin Country">
                  <input className="input" value={originCountry} onChange={(e) => setOriginCountry(e.target.value)} placeholder="e.g. China" />
                </UniversalField>
                <UniversalField label="Incoterm">
                  <input className="input" value={incoterm} onChange={(e) => setIncoterm(e.target.value)} placeholder="e.g. CIF Casablanca" />
                </UniversalField>
                <UniversalField label="Expected Port">
                  <input className="input" value={expectedPort} onChange={(e) => setExpectedPort(e.target.value)} placeholder="e.g. Casablanca" />
                </UniversalField>
                <UniversalField label="Customs Reference">
                  <input className="input" value={customsReference} onChange={(e) => setCustomsReference(e.target.value)} placeholder="BL / Customs File" />
                </UniversalField>
              </>
            )}
            {orderCurrency !== "MAD" && (
              <UniversalField label="Exchange Rate to MAD">
                <input className="input" type="number" min="0" step="0.0001" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} placeholder={`Required for ${orderCurrency}`} />
              </UniversalField>
            )}
          </UniversalFormGrid>

          <UniversalField label="VAT Rate (%)">
            <input className="input" type="number" min="0" step="0.1" value={vatRate} onChange={(e) => setVatRate(e.target.value)} />
          </UniversalField>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-200">Products from Main Supplier</h3>
            {lines.map((line) => (
              <div key={line.id} className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto] items-end">
                <UniversalField label="Product">
                  <select
                    className="input"
                    value={line.productId}
                    onChange={(e) => {
                      const selected = products.find((p) => p.id === Number(e.target.value));
                      updateLine(line.id, {
                        productId: e.target.value,
                        unitPrice: String(Number(selected?.cost || selected?.price || 0)),
                      });
                    }}
                  >
                    <option value="">Select product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </UniversalField>
                <UniversalField label="Quantity">
                  <input className="input" type="number" min="1" value={line.quantity} onChange={(e) => updateLine(line.id, { quantity: e.target.value })} />
                </UniversalField>
                <UniversalField label="Unit Cost">
                  <input className="input" type="number" min="0" step="0.01" value={line.unitPrice} onChange={(e) => updateLine(line.id, { unitPrice: e.target.value })} />
                </UniversalField>
                <button type="button" className="btn-secondary btn-sm" onClick={() => removeLine(line.id)}>Remove</button>
              </div>
            ))}
          </div>

          {purchaseType === "import" && (
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-semibold text-slate-200">Landed Costs & Additional Charges</h3>
              <p className="text-xs text-slate-400">Costs related to this purchase paid to third-party companies (e.g. freight carrier, customs broker, port authority). Each line is linked to this PO and should point to the third-party payee.</p>
              {expenses.map((expense) => (
                <div key={expense.id} className="grid gap-3 md:grid-cols-[2fr_2fr_1fr_1fr_1fr_auto] items-end">
                  <UniversalField label="Paid To (Third-Party Supplier)">
                    <select className="input" value={expense.supplierId} onChange={(e) => updateExpense(expense.id, { supplierId: e.target.value })}>
                      <option value="">Select supplier</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </UniversalField>
                  <UniversalField label="Expense Description">
                    <input className="input" value={expense.description} onChange={(e) => updateExpense(expense.id, { description: e.target.value })} placeholder="Transport, offloading, customs broker..." />
                  </UniversalField>
                  <UniversalField label="Supplier Invoice #">
                    <input className="input" value={expense.externalRef} onChange={(e) => updateExpense(expense.id, { externalRef: e.target.value })} placeholder="e.g. INV-2025-081" />
                  </UniversalField>
                  <UniversalField label="Amount">
                    <input className="input" type="number" min="0" step="0.01" value={expense.amount} onChange={(e) => updateExpense(expense.id, { amount: e.target.value })} />
                  </UniversalField>
                  <UniversalField label="VAT %">
                    <input className="input" type="number" min="0" step="0.1" value={expense.vatRate} onChange={(e) => updateExpense(expense.id, { vatRate: e.target.value })} />
                  </UniversalField>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => removeExpense(expense.id)}>Remove</button>
                </div>
              ))}
            </div>
          )}

          <UniversalActionBar>
            <button type="button" className="btn-secondary" onClick={addLine}>+ Add Product Line</button>
            {purchaseType === "import" && (
              <button type="button" className="btn-secondary" onClick={addExpense}>+ Add Expense Line</button>
            )}
            <button className="btn-primary" disabled={!can("/api/procurement/orders", "POST")}>Create PO</button>
          </UniversalActionBar>
        </form>
      </UniversalFormSection>

      <section className="card">
        <h2 className="text-lg font-semibold text-white mb-4">PO Register</h2>
        {(() => {
          const fmt = (v: string | number | null | undefined) => Number(v || 0).toFixed(2);
          const fmtDate = (v: string | null | undefined) => v ? new Date(v).toLocaleDateString() : "-";
          const num = (v: string | number | null | undefined) => {
            const parsed = Number(v ?? 0);
            return Number.isFinite(parsed) ? parsed : 0;
          };
          const fxToMad = (r: POWithMeta) => {
            const currency = String(r.currency || "MAD").toUpperCase();
            if (currency === "MAD") return 1;
            const fx = num(r.exchangeRate);
            return fx > 0 ? fx : 0;
          };
          const totalMad = (r: POWithMeta) => {
            const total = num(r.total);
            const fx = fxToMad(r);
            return fx > 0 ? total * fx : 0;
          };
          const usdToMadRate = (() => {
            const usdOrder = (orders as POWithMeta[]).find((r) => String(r.currency || "MAD").toUpperCase() === "USD" && fxToMad(r) > 0);
            return usdOrder ? fxToMad(usdOrder) : 10;
          })();
          const totalUsd = (r: POWithMeta) => {
            const currency = String(r.currency || "MAD").toUpperCase();
            const total = num(r.total);
            if (currency === "USD") return total;
            const mad = totalMad(r);
            return usdToMadRate > 0 ? mad / usdToMadRate : 0;
          };
          const poColumns: DataColumn<POWithMeta>[] = [
            {
              key: "reference", label: "PO #", sortable: true,
              getValue: (r) => r.reference,
              render: (r) => <Link href={`/procurement/orders/${r.id}`} className="font-medium text-cyan-300 hover:text-cyan-200">{r.reference}</Link>,
            },
            {
              key: "supplier", label: "Supplier", sortable: true,
              getValue: (r) => r.supplier?.name || "",
              render: (r) => r.supplier?.name || "-",
            },
            {
              key: "purchaseType", label: "Type", sortable: true,
              getValue: (r) => r.purchaseType,
              render: (r) => <span className={`badge ${r.purchaseType === "import" ? "badge-purple" : "badge-cyan"}`}>{r.purchaseType}</span>,
            },
            {
              key: "status", label: "Status", sortable: true,
              getValue: (r) => r.status,
              render: (r) => <span className={`badge ${r.status === "received" ? "badge-green" : r.status === "partial" ? "badge-amber" : "badge-slate"}`}>{r.status}</span>,
            },
            {
              key: "exchangeRate", label: "FX to MAD", defaultVisible: true, sortable: true,
              getValue: (r) => {
                const currency = String(r.currency || "MAD").toUpperCase();
                return currency === "MAD" ? 0 : fxToMad(r);
              },
              render: (r) => {
                const currency = String(r.currency || "MAD").toUpperCase();
                const fx = fxToMad(r);
                return currency === "MAD" ? <span className="text-slate-500">-</span> : (fx > 0 ? fx.toFixed(4) : <span className="text-rose-300">Missing</span>);
              },
            },
            {
              key: "itemCount", label: "Products", sortable: true,
              getValue: (r) => r.items?.length ?? 0,
              render: (r) => r.items?.length ?? 0,
            },
            {
              key: "productsTotal", label: "Products Subtotal", defaultVisible: false, sortable: true,
              getValue: (r) => r.items?.reduce((s, i) => s + Number(i.lineTotal || 0), 0) ?? 0,
              render: (r) => {
                const currency = String(r.currency || "MAD").toUpperCase();
                const amount = r.items?.reduce((s, i) => s + Number(i.lineTotal || 0), 0);
                return `${currency} ${fmt(amount)}`;
              },
            },
            {
              key: "expensesTotal", label: "Expenses", defaultVisible: false, sortable: true,
              getValue: (r) => r.expenses?.reduce((s, e) => s + Number(e.total || e.amount || 0), 0) ?? 0,
              render: (r) => {
                const currency = String(r.currency || "MAD").toUpperCase();
                const amount = r.expenses?.reduce((s, e) => s + Number(e.total || e.amount || 0), 0);
                return `${currency} ${fmt(amount)}`;
              },
            },
            {
              key: "vatAmount", label: "VAT Amount", defaultVisible: false, sortable: true,
              getValue: (r) => r.vatAmount ? Number(r.vatAmount) : r.expenses?.reduce((s, e) => s + Number(e.vatAmount || 0), 0) ?? 0,
              render: (r) => {
                const currency = String(r.currency || "MAD").toUpperCase();
                const amount = r.vatAmount ?? r.expenses?.reduce((s, e) => s + Number(e.vatAmount || 0), 0);
                return `${currency} ${fmt(amount)}`;
              },
            },
            {
              key: "total", label: "Total", sortable: true,
              getValue: (r) => Number(r.total),
              render: (r) => <span className="font-semibold text-cyan-200">{(r.currency || "MAD").toUpperCase()} {fmt(r.total)}</span>,
            },
            {
              key: "totalMad", label: "Total (MAD)", defaultVisible: true, sortable: true,
              getValue: (r) => totalMad(r),
              render: (r) => <span>MAD {fmt(totalMad(r))}</span>,
            },
            {
              key: "totalUsd", label: "Total (USD)", defaultVisible: true, sortable: true,
              getValue: (r) => totalUsd(r),
              render: (r) => <span>USD {fmt(totalUsd(r))}</span>,
            },
            {
              key: "receivedPct", label: "Received %", defaultVisible: true, sortable: true,
              getValue: (r) => {
                const totalQty = r.items?.reduce((s, i) => s + Number(i.quantity || 0), 0) ?? 0;
                const recQty = r.items?.reduce((s, i) => s + Number(i.receivedQty || 0), 0) ?? 0;
                return totalQty > 0 ? Math.round((recQty / totalQty) * 100) : 0;
              },
              render: (r) => {
                const totalQty = r.items?.reduce((s, i) => s + Number(i.quantity || 0), 0) ?? 0;
                const recQty = r.items?.reduce((s, i) => s + Number(i.receivedQty || 0), 0) ?? 0;
                const pct = totalQty > 0 ? Math.round((recQty / totalQty) * 100) : 0;
                return <span className={pct >= 100 ? "text-emerald-400" : pct > 0 ? "text-amber-400" : "text-slate-500"}>{pct}%</span>;
              },
            },
            {
              key: "originCountry", label: "Origin", defaultVisible: false, sortable: true,
              getValue: (r) => r.originCountry || "",
              render: (r) => r.originCountry || <span className="text-slate-500">—</span>,
            },
            {
              key: "incoterm", label: "Incoterm", defaultVisible: false, sortable: true,
              getValue: (r) => r.incoterm || "",
              render: (r) => r.incoterm || <span className="text-slate-500">—</span>,
            },
            {
              key: "expectedPort", label: "Port", defaultVisible: false, sortable: true,
              getValue: (r) => r.expectedPort || "",
              render: (r) => r.expectedPort || <span className="text-slate-500">—</span>,
            },
            {
              key: "date", label: "Date", defaultVisible: false, sortable: true,
              getValue: (r) => r.date || "",
              render: (r) => fmtDate(r.date),
            },
            {
              key: "actions", label: "Actions", sortable: false,
              render: (order) => (
                <UniversalListActions
                  id={order.id}
                  deleteLabel="purchase order"
                  viewHref={`/procurement/orders/${order.id}`}
                  printDocument="purchase-order"
                  canDelete={can(`/api/procurement/orders/${order.id}`, "DELETE")}
                  onDelete={deletePurchaseOrder}
                >
                  {order.status !== "received" && can(`/api/procurement/orders/${order.id}/receive`, "POST") && (
                    <button className="btn-primary btn-xs" onClick={() => receiveAll(order)}>
                      Receive Remaining
                    </button>
                  )}
                </UniversalListActions>
              ),
            },
          ];
          return <DataTable columns={poColumns} rows={orders as POWithMeta[]} rowKey={(r) => r.id} maxHeight="72vh" emptyMessage="No purchase orders found." preferencesKey="procurement.orders.register" />;
        })()}
      </section>
    </main>
  );
}
