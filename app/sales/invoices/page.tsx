"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuthz } from "@/lib/useAuthz";
import UniversalListActions from "@/components/ui/UniversalListActions";
import { UniversalActionBar, UniversalField, UniversalFormGrid, UniversalFormSection } from "@/components/ui/UniversalForm";
import DataTable, { DataColumn } from "@/components/ui/DataTable";

type Invoice = {
  id: number;
  reference: string;
  status: string;
  date: string;
  dueDate?: string | null;
  subtotal: string;
  vatRate: string;
  vatAmount: string;
  total: string;
  paidAmount: string;
  order?: { id: number; reference?: string; deliveries?: Array<{ id: number; reference: string }> };
  deliveries?: Array<{ id: number; reference: string }>;
  customer?: { name: string; email?: string };
  items?: Array<{ id: number; itemType?: string; lineTotal?: string }>;
};

type StandaloneDeliveryLine = {
  invoiceItemId: number;
  productName: string;
  invoicedQty: number;
  deliverNowQty: string;
};

type Customer = { id: number; name: string };
type Product = { id: number; name: string; price?: string; cost?: string };
type Supplier = { id: number; name: string; isActive?: boolean };

type DraftProductLine = {
  id: number;
  productId: string;
  quantity: string;
  unitPrice: string;
};

type DraftExpenseLine = {
  id: number;
  supplierId: string;
  description: string;
  externalRef: string;
  quantity: string;
  unitPrice: string;
};

type DeliveryComposerLine = {
  orderItemId: number;
  productName: string;
  orderedQty: number;
  deliveredQty: number;
  deliverNowQty: string;
};

type DeliveryComposerExpense = {
  id: number;
  supplierId: string;
  description: string;
  amount: string;
};

type InvoiceOrderDetail = {
  id: number;
  reference: string;
  order?: {
    id: number;
    reference: string;
    items: Array<{
      id: number;
      quantity: number;
      deliveredQty: number;
      product?: { name?: string | null };
    }>;
  } | null;
  items?: Array<{
    id: number;
    itemType: string;
    quantity: number;
    lineTotal: string;
    product?: { name?: string | null } | null;
    description?: string | null;
  }>;
};

export default function InvoicesPage() {
  const { can } = useAuthz();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [vatRate, setVatRate] = useState("20");
  const [productLines, setProductLines] = useState<DraftProductLine[]>([
    { id: 1, productId: "", quantity: "1", unitPrice: "0" },
  ]);
  const [expenseLines, setExpenseLines] = useState<DraftExpenseLine[]>([
    { id: 1, supplierId: "", description: "", externalRef: "", quantity: "1", unitPrice: "0" },
  ]);

  const [deliveryInvoice, setDeliveryInvoice] = useState<InvoiceOrderDetail | null>(null);
  const [deliveryLines, setDeliveryLines] = useState<DeliveryComposerLine[]>([]);
  const [deliveryExpenses, setDeliveryExpenses] = useState<DeliveryComposerExpense[]>([
    { id: 1, supplierId: "", description: "", amount: "0" },
  ]);
  const [deliveryCarrier, setDeliveryCarrier] = useState("");
  const [deliveryWaybill, setDeliveryWaybill] = useState("");
  const [deliverySubmitting, setDeliverySubmitting] = useState(false);
  const [deliveryIsStandalone, setDeliveryIsStandalone] = useState(false);
  const [standaloneLines, setStandaloneLines] = useState<StandaloneDeliveryLine[]>([]);

  const [error, setError] = useState("");
  const [deliveryError, setDeliveryError] = useState("");

  const load = async () => {
    const [invoicesData, customersData, productsData, suppliersData] = await Promise.all([
      fetch("/api/sales/invoices").then((r) => r.json()),
      fetch("/api/sales/customers?isActive=true").then((r) => r.json()),
      fetch("/api/inventory/products").then((r) => r.json()),
      fetch("/api/procurement/suppliers").then((r) => r.json()),
    ]);
    setInvoices(Array.isArray(invoicesData) ? invoicesData : []);
    setCustomers(Array.isArray(customersData) ? customersData : []);
    setProducts(Array.isArray(productsData) ? productsData : []);
    setSuppliers(Array.isArray(suppliersData) ? suppliersData : []);
  };

  useEffect(() => {
    load();
  }, []);

  const registerTotals = useMemo(() => {
    const total = invoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
    const paid = invoices.reduce((sum, inv) => sum + Number(inv.paidAmount || 0), 0);
    return { total, paid, outstanding: total - paid };
  }, [invoices]);

  const formTotals = useMemo(() => {
    const validProductLines = productLines
      .map((line) => ({
        productId: Number(line.productId),
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
      }))
      .filter((line) => line.productId > 0 && line.quantity > 0 && line.unitPrice >= 0);

    const validExpenseLines = expenseLines
      .map((line) => ({
        supplierId: Number(line.supplierId),
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        description: line.description.trim(),
      }))
      .filter((line) => line.supplierId > 0 && line.quantity > 0 && line.unitPrice >= 0 && Boolean(line.description));

    const productSubtotal = validProductLines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    const estimatedProductCogs = validProductLines.reduce((sum, line) => {
      const product = products.find((p) => p.id === line.productId);
      return sum + line.quantity * Number(product?.cost || 0);
    }, 0);
    const expenseSubtotal = validExpenseLines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    const subtotal = productSubtotal + expenseSubtotal;
    const vatAmount = subtotal * (Number(vatRate || 0) / 100);
    const total = subtotal + vatAmount;
    const expectedGrossMargin = subtotal - (estimatedProductCogs + expenseSubtotal);

    return {
      productSubtotal,
      estimatedProductCogs,
      expenseSubtotal,
      subtotal,
      vatAmount,
      total,
      expectedGrossMargin,
      validProductCount: validProductLines.length,
      validExpenseCount: validExpenseLines.length,
    };
  }, [expenseLines, productLines, products, vatRate]);

  const addProductLine = () => {
    setProductLines((prev) => [...prev, { id: Date.now(), productId: "", quantity: "1", unitPrice: "0" }]);
  };

  const removeProductLine = (id: number) => {
    setProductLines((prev) => (prev.length > 1 ? prev.filter((line) => line.id !== id) : prev));
  };

  const updateProductLine = (id: number, patch: Partial<DraftProductLine>) => {
    setProductLines((prev) => prev.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  };

  const addExpenseLine = () => {
    setExpenseLines((prev) => [...prev, { id: Date.now(), supplierId: "", description: "", externalRef: "", quantity: "1", unitPrice: "0" }]);
  };

  const removeExpenseLine = (id: number) => {
    setExpenseLines((prev) => (prev.length > 1 ? prev.filter((line) => line.id !== id) : prev));
  };

  const updateExpenseLine = (id: number, patch: Partial<DraftExpenseLine>) => {
    setExpenseLines((prev) => prev.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  };

  const openDeliveryComposer = async (invoiceId: number) => {
    setDeliveryError("");
    try {
      const res = await fetch(`/api/sales/invoices/${invoiceId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load invoice for delivery");

      const detail = data as InvoiceOrderDetail;

      if (detail.order && Array.isArray(detail.order.items)) {
        // Order-linked delivery
        const lines = detail.order.items.map((item) => {
          const orderedQty = Number(item.quantity || 0);
          const deliveredQty = Number(item.deliveredQty || 0);
          const remaining = Math.max(orderedQty - deliveredQty, 0);
          return {
            orderItemId: item.id,
            productName: item.product?.name || `Order item #${item.id}`,
            orderedQty,
            deliveredQty,
            deliverNowQty: String(remaining),
          };
        });
        setDeliveryIsStandalone(false);
        setDeliveryLines(lines);
        setStandaloneLines([]);
      } else {
        // Standalone delivery (no order)
        const productItems = (detail.items || []).filter((i) => i.itemType === "product");
        if (productItems.length === 0) {
          throw new Error("This invoice has no product items to deliver");
        }
        const sLines = productItems.map((item) => ({
          invoiceItemId: item.id,
          productName: item.product?.name || item.description || `Invoice item #${item.id}`,
          invoicedQty: Number(item.quantity || 0),
          deliverNowQty: String(Number(item.quantity || 0)),
        }));
        setDeliveryIsStandalone(true);
        setStandaloneLines(sLines);
        setDeliveryLines([]);
      }

      setDeliveryInvoice(detail);
      setDeliveryCarrier("");
      setDeliveryWaybill("");
      setDeliveryExpenses([{ id: 1, supplierId: "", description: "", amount: "0" }]);
    } catch (err) {
      setDeliveryError(err instanceof Error ? err.message : "Failed to load invoice for delivery");
    }
  };

  const closeDeliveryComposer = () => {
    setDeliveryInvoice(null);
    setDeliveryLines([]);
    setDeliveryError("");
  };

  const updateStandaloneLine = (invoiceItemId: number, value: string) => {
    setStandaloneLines((prev) => prev.map((l) => l.invoiceItemId === invoiceItemId ? { ...l, deliverNowQty: value } : l));
  };

  const updateDeliveryLine = (orderItemId: number, value: string) => {
    setDeliveryLines((prev) => prev.map((line) => (line.orderItemId === orderItemId ? { ...line, deliverNowQty: value } : line)));
  };

  const addDeliveryExpense = () => {
    setDeliveryExpenses((prev) => [...prev, { id: Date.now(), supplierId: "", description: "", amount: "0" }]);
  };

  const removeDeliveryExpense = (id: number) => {
    setDeliveryExpenses((prev) => (prev.length > 1 ? prev.filter((line) => line.id !== id) : prev));
  };

  const updateDeliveryExpense = (id: number, patch: Partial<DeliveryComposerExpense>) => {
    setDeliveryExpenses((prev) => prev.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  };

  const createDeliveryNote = async () => {
    if (!deliveryInvoice) return;
    setDeliveryError("");
    setDeliverySubmitting(true);

    try {
      let normalizedItems: { orderItemId?: number; invoiceItemId?: number; quantity: number }[];

      if (deliveryIsStandalone) {
        normalizedItems = standaloneLines
          .map((line) => ({ invoiceItemId: line.invoiceItemId, quantity: Number(line.deliverNowQty) }))
          .filter((line) => line.quantity > 0);
      } else {
        normalizedItems = deliveryLines
          .map((line) => ({
            orderItemId: line.orderItemId,
            quantity: Number(line.deliverNowQty),
          }))
          .filter((line) => Number.isFinite(line.quantity) && line.quantity > 0);

        const withRemaining = normalizedItems.map((item) => {
          const line = deliveryLines.find((l) => l.orderItemId === item.orderItemId);
          return { ...item, remaining: line ? Math.max(line.orderedQty - line.deliveredQty, 0) : 0 };
        });
        if (withRemaining.some((line) => line.quantity > line.remaining)) {
          throw new Error("Delivered quantity cannot exceed remaining quantity");
        }
      }

      if (normalizedItems.length === 0) {
        throw new Error("Enter at least one delivered quantity greater than zero");
      }

      const normalizedExpenses = deliveryExpenses
        .map((expense) => ({
          supplierId: expense.supplierId ? Number(expense.supplierId) : null,
          description: expense.description.trim(),
          amount: Number(expense.amount),
        }))
        .filter((expense) => expense.description && Number.isFinite(expense.amount) && expense.amount >= 0);

      const res = await fetch(`/api/sales/invoices/${deliveryInvoice.id}/delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carrier: deliveryCarrier || null,
          waybill: deliveryWaybill || null,
          items: normalizedItems,
          standalone: deliveryIsStandalone,
          expenses: normalizedExpenses,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to create delivery note" }));
        throw new Error(data.error || "Failed to create delivery note");
      }

      await load();
      closeDeliveryComposer();
    } catch (err) {
      setDeliveryError(err instanceof Error ? err.message : "Failed to create delivery note");
    } finally {
      setDeliverySubmitting(false);
    }
  };

  const createInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const normalizedProductItems = productLines
        .map((line) => ({
          itemType: "product",
          productId: Number(line.productId),
          description: null,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
        }))
        .filter((line) => line.productId > 0 && line.quantity > 0 && line.unitPrice >= 0);

      const normalizedExpenseItems = expenseLines
        .map((line) => {
          const supplierName = suppliers.find((supplier) => supplier.id === Number(line.supplierId))?.name || "";
          const description = [
            line.description.trim(),
            supplierName ? `Paid to third party: ${supplierName}` : "",
            line.externalRef.trim() ? `Third-party invoice: ${line.externalRef.trim()}` : "",
          ]
            .filter(Boolean)
            .join(" | ");

          return {
            itemType: "charge",
            productId: null,
            description,
            quantity: Number(line.quantity),
            unitPrice: Number(line.unitPrice),
          };
        })
        .filter((line) => Boolean(line.description) && line.quantity > 0 && line.unitPrice >= 0);

      if (!customerId) {
        throw new Error("Please select a customer");
      }

      if (expenseLines.some((line) => line.description.trim() && !line.supplierId)) {
        throw new Error("Each third-party expense line must include a supplier");
      }

      const normalizedItems = [...normalizedProductItems, ...normalizedExpenseItems];
      if (normalizedItems.length === 0) {
        throw new Error("Add at least one valid product or third-party expense line");
      }

      const res = await fetch("/api/sales/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: Number(customerId),
          dueDate: dueDate || null,
          vatRate: Number(vatRate || 20),
          items: normalizedItems,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to create invoice" }));
        throw new Error(data.error || "Failed to create invoice");
      }

      setCustomerId("");
      setDueDate("");
      setVatRate("20");
      setProductLines([{ id: 1, productId: "", quantity: "1", unitPrice: "0" }]);
      setExpenseLines([{ id: 1, supplierId: "", description: "", externalRef: "", quantity: "1", unitPrice: "0" }]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invoice");
    }
  };

  const deleteInvoice = async (id: number) => {
    if (!can(`/api/sales/invoices/${id}`, "DELETE")) return;
    try {
      const res = await fetch(`/api/sales/invoices/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to delete invoice" }));
        throw new Error(data.error || "Failed to delete invoice");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete invoice");
    }
  };

  return (
    <main className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">Create advanced invoices and issue delivery notes from this same screen.</p>
        </div>
        <a href="#new-invoice" className="btn-primary">+ Add Invoice</a>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="card-sm"><div className="stat-label">Invoice Total</div><div className="stat-value text-cyan-300">{registerTotals.total.toFixed(2)}</div></div>
        <div className="card-sm"><div className="stat-label">Paid</div><div className="stat-value text-emerald-300">{registerTotals.paid.toFixed(2)}</div></div>
        <div className="card-sm"><div className="stat-label">Outstanding</div><div className="stat-value text-amber-300">{registerTotals.outstanding.toFixed(2)}</div></div>
      </section>

      <UniversalFormSection
        title="New Invoice"
        description="Products and third-party expense lines are entered separately, with live totals and margin preview."
      >
        {error && <div className="alert-error mb-4">{error}</div>}
        <form id="new-invoice" onSubmit={createInvoice} className="space-y-5">
          <UniversalFormGrid className="grid gap-3 md:grid-cols-3">
            <UniversalField label="Customer">
              <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </UniversalField>
            <UniversalField label="Due Date">
              <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </UniversalField>
            <UniversalField label="VAT Rate (%)">
              <input className="input" type="number" min="0" step="0.1" value={vatRate} onChange={(e) => setVatRate(e.target.value)} />
            </UniversalField>
          </UniversalFormGrid>

          <section className="space-y-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
            <h3 className="text-sm font-semibold text-slate-200">Product Lines (Revenue)</h3>
            {productLines.map((line) => {
              const lineTotal = Number(line.quantity || 0) * Number(line.unitPrice || 0);
              return (
                <div key={line.id} className="grid gap-3 md:grid-cols-[2.2fr_1fr_1fr_1fr_auto] items-end">
                  <UniversalField label="Product">
                    <select
                      className="input"
                      value={line.productId}
                      onChange={(e) => {
                        const selected = products.find((p) => p.id === Number(e.target.value));
                        updateProductLine(line.id, {
                          productId: e.target.value,
                          unitPrice: String(Number(selected?.price || 0)),
                        });
                      }}
                    >
                      <option value="">Select product</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </UniversalField>
                  <UniversalField label="Qty">
                    <input className="input" type="number" min="1" value={line.quantity} onChange={(e) => updateProductLine(line.id, { quantity: e.target.value })} />
                  </UniversalField>
                  <UniversalField label="Unit Price">
                    <input className="input" type="number" min="0" step="0.01" value={line.unitPrice} onChange={(e) => updateProductLine(line.id, { unitPrice: e.target.value })} />
                  </UniversalField>
                  <UniversalField label="Line Total">
                    <input className="input" value={lineTotal.toFixed(2)} readOnly />
                  </UniversalField>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => removeProductLine(line.id)}>Remove</button>
                </div>
              );
            })}
            <button type="button" className="btn-secondary" onClick={addProductLine}>+ Add Product Line</button>
          </section>

          <section className="space-y-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
            <h3 className="text-sm font-semibold text-slate-200">Third-Party Expense Lines (COGS + Payable)</h3>
            <p className="text-xs text-slate-400">These lines are treated as third-party expenses linked to the invoice and posted as payable accruals.</p>
            {expenseLines.map((line) => {
              const lineTotal = Number(line.quantity || 0) * Number(line.unitPrice || 0);
              return (
                <div key={line.id} className="grid gap-3 md:grid-cols-[1.4fr_2fr_1.2fr_0.8fr_0.9fr_0.9fr_auto] items-end">
                  <UniversalField label="Paid To (Third-Party Supplier)">
                    <select className="input" value={line.supplierId} onChange={(e) => updateExpenseLine(line.id, { supplierId: e.target.value })}>
                      <option value="">Select third-party supplier</option>
                      {suppliers
                        .filter((supplier) => supplier.isActive !== false)
                        .map((supplier) => (
                          <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                        ))}
                    </select>
                  </UniversalField>
                  <UniversalField label="Expense Description">
                    <input className="input" value={line.description} onChange={(e) => updateExpenseLine(line.id, { description: e.target.value })} placeholder="Transport, customs, brokerage..." />
                  </UniversalField>
                  <UniversalField label="Supplier Invoice #">
                    <input className="input" value={line.externalRef} onChange={(e) => updateExpenseLine(line.id, { externalRef: e.target.value })} placeholder="Third-party invoice/ref" />
                  </UniversalField>
                  <UniversalField label="Qty">
                    <input className="input" type="number" min="1" value={line.quantity} onChange={(e) => updateExpenseLine(line.id, { quantity: e.target.value })} />
                  </UniversalField>
                  <UniversalField label="Unit Price">
                    <input className="input" type="number" min="0" step="0.01" value={line.unitPrice} onChange={(e) => updateExpenseLine(line.id, { unitPrice: e.target.value })} />
                  </UniversalField>
                  <UniversalField label="Line Total">
                    <input className="input" value={lineTotal.toFixed(2)} readOnly />
                  </UniversalField>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => removeExpenseLine(line.id)}>Remove</button>
                </div>
              );
            })}
            <button type="button" className="btn-secondary" onClick={addExpenseLine}>+ Add Expense Line</button>
          </section>

          <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 rounded-lg border border-white/[0.08] bg-black/20 p-3">
            <div>
              <div className="stat-label">Products Subtotal</div>
              <div className="text-cyan-300 font-semibold">{formTotals.productSubtotal.toFixed(2)}</div>
              <div className="text-[11px] text-slate-400">{formTotals.validProductCount} valid lines</div>
            </div>
            <div>
              <div className="stat-label">Third-Party Expenses</div>
              <div className="text-amber-300 font-semibold">{formTotals.expenseSubtotal.toFixed(2)}</div>
              <div className="text-[11px] text-slate-400">{formTotals.validExpenseCount} valid lines</div>
            </div>
            <div>
              <div className="stat-label">VAT / Grand Total</div>
              <div className="text-slate-100 font-semibold">VAT {formTotals.vatAmount.toFixed(2)}</div>
              <div className="text-emerald-300 font-semibold">Total {formTotals.total.toFixed(2)}</div>
            </div>
            <div>
              <div className="stat-label">Estimated Gross Margin</div>
              <div className={`font-semibold ${formTotals.expectedGrossMargin >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                {formTotals.expectedGrossMargin.toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-400">Assumes product cost from current catalog costs</div>
            </div>
          </section>

          <UniversalActionBar>
            <button className="btn-primary" disabled={!can("/api/sales/invoices", "POST")}>Create Invoice</button>
          </UniversalActionBar>
        </form>
      </UniversalFormSection>

      <section className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Invoice Register</h2>
        {deliveryError && <div className="alert-error mb-4">{deliveryError}</div>}
        {(() => {
          const fmt = (v: string | number | null | undefined) => Number(v || 0).toFixed(2);
          const fmtDate = (v: string | null | undefined) => v ? new Date(v).toLocaleDateString() : "-";
          const statusBadge = (s: string) => {
            const cls = s === "paid" ? "badge-green" : s === "cancelled" ? "badge-red" : s === "overdue" ? "badge-red" : "badge-amber";
            return <span className={`badge ${cls}`}>{s}</span>;
          };
          const invoiceColumns: DataColumn<Invoice>[] = [
            {
              key: "reference", label: "Invoice #", sortable: true,
              getValue: (r) => r.reference,
              render: (r) => <Link href={`/sales/invoices/${r.id}`} className="font-medium text-cyan-300 hover:text-cyan-200">{r.reference}</Link>,
            },
            {
              key: "customer", label: "Customer", sortable: true,
              getValue: (r) => r.customer?.name || "",
              render: (r) => r.customer?.name || "-",
            },
            {
              key: "customerEmail", label: "Customer Email", defaultVisible: false, sortable: true,
              getValue: (r) => r.customer?.email || "",
              render: (r) => r.customer?.email || "-",
            },
            {
              key: "date", label: "Date", sortable: true,
              getValue: (r) => r.date,
              render: (r) => fmtDate(r.date),
            },
            {
              key: "dueDate", label: "Due Date", defaultVisible: true, sortable: true,
              getValue: (r) => r.dueDate || "",
              render: (r) => fmtDate(r.dueDate),
            },
            {
              key: "status", label: "Status", sortable: true,
              getValue: (r) => r.status,
              render: (r) => statusBadge(r.status),
            },
            {
              key: "itemCount", label: "Lines", sortable: true,
              getValue: (r) => r.items?.length ?? 0,
              render: (r) => r.items?.length ?? 0,
            },
            {
              key: "productSubtotal", label: "Products", defaultVisible: false, sortable: true,
              getValue: (r) => r.items?.filter((i) => i.itemType === "product").reduce((s, i) => s + Number(i.lineTotal || 0), 0) ?? 0,
              render: (r) => fmt(r.items?.filter((i) => i.itemType === "product").reduce((s, i) => s + Number(i.lineTotal || 0), 0)),
            },
            {
              key: "chargesSubtotal", label: "3rd-Party Charges", defaultVisible: false, sortable: true,
              getValue: (r) => r.items?.filter((i) => i.itemType === "charge").reduce((s, i) => s + Number(i.lineTotal || 0), 0) ?? 0,
              render: (r) => fmt(r.items?.filter((i) => i.itemType === "charge").reduce((s, i) => s + Number(i.lineTotal || 0), 0)),
            },
            {
              key: "subtotal", label: "Subtotal HT", defaultVisible: false, sortable: true,
              getValue: (r) => Number(r.subtotal),
              render: (r) => fmt(r.subtotal),
            },
            {
              key: "vatRate", label: "VAT %", defaultVisible: false, sortable: true,
              getValue: (r) => Number(r.vatRate),
              render: (r) => `${Number(r.vatRate).toFixed(1)}%`,
            },
            {
              key: "vatAmount", label: "VAT Amount", defaultVisible: false, sortable: true,
              getValue: (r) => Number(r.vatAmount),
              render: (r) => fmt(r.vatAmount),
            },
            {
              key: "total", label: "Total TTC", sortable: true,
              getValue: (r) => Number(r.total),
              render: (r) => <span className="font-semibold text-cyan-200">{fmt(r.total)}</span>,
            },
            {
              key: "paidAmount", label: "Paid", sortable: true,
              getValue: (r) => Number(r.paidAmount),
              render: (r) => <span className="text-emerald-300">{fmt(r.paidAmount)}</span>,
            },
            {
              key: "outstanding", label: "Outstanding", sortable: true,
              getValue: (r) => Number(r.total) - Number(r.paidAmount),
              render: (r) => {
                const v = Number(r.total) - Number(r.paidAmount);
                return <span className={v > 0 ? "text-amber-300 font-semibold" : "text-slate-400"}>{v.toFixed(2)}</span>;
              },
            },
            {
              key: "overdueDays", label: "Overdue Days", defaultVisible: false, sortable: true,
              getValue: (r) => {
                if (!r.dueDate || r.status === "paid" || r.status === "cancelled") return 0;
                return Math.max(Math.floor((Date.now() - new Date(r.dueDate).getTime()) / 86400000), 0);
              },
              render: (r) => {
                if (!r.dueDate || r.status === "paid" || r.status === "cancelled") return <span className="text-slate-500">â€”</span>;
                const days = Math.max(Math.floor((Date.now() - new Date(r.dueDate).getTime()) / 86400000), 0);
                return days > 0 ? <span className="text-rose-400 font-semibold">{days}d</span> : <span className="text-emerald-400">On time</span>;
              },
            },
            {
              key: "orderRef", label: "Order Ref", defaultVisible: false, sortable: true,
              getValue: (r) => r.order?.reference || "",
              render: (r) => r.order?.id ? (
                <Link href={`/sales/orders/${r.order.id}`} className="text-slate-300 hover:text-white">{r.order.reference || `#${r.order.id}`}</Link>
              ) : <span className="text-slate-500">â€”</span>,
            },
            {
              key: "deliveryCount", label: "Deliveries", defaultVisible: false, sortable: true,
              getValue: (r) => (r.order?.deliveries?.length ?? 0) + (r.deliveries?.length ?? 0),
              render: (r) => {
                const count = (r.order?.deliveries?.length ?? 0) + (r.deliveries?.length ?? 0);
                return count > 0 ? <span className="badge badge-green">{count}</span> : <span className="text-slate-500">0</span>;
              },
            },
            {
              key: "actions", label: "Actions", sortable: false,
              render: (invoice) => {
                const latestDelivery = invoice.order?.deliveries?.[0] ?? invoice.deliveries?.[0];
                const hasProductItems = (invoice.items?.some((i) => i.itemType === "product")) ?? false;
                return (
                  <UniversalListActions
                    id={invoice.id}
                    deleteLabel="invoice"
                    viewHref={`/sales/invoices/${invoice.id}`}
                    printDocument="invoice"
                    canDelete={can(`/api/sales/invoices/${invoice.id}`, "DELETE")}
                    onDelete={deleteInvoice}
                  >
                    {latestDelivery && (
                      <a href={`/api/print/delivery/${latestDelivery.id}?lang=en`} target="_blank" rel="noreferrer" className="btn-secondary btn-xs">
                        Print Delivery
                      </a>
                    )}
                    {hasProductItems ? (
                      <button type="button" className="btn-primary btn-xs" onClick={() => openDeliveryComposer(invoice.id)}>
                        Make Delivery Note
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500">No products</span>
                    )}
                  </UniversalListActions>
                );
              },
            },
          ];
          return <DataTable columns={invoiceColumns} rows={invoices} rowKey={(r) => r.id} maxHeight="72vh" emptyMessage="No invoices found." preferencesKey="sales.invoices.register" />;
        })()}
      </section>

      {deliveryInvoice && (
        <UniversalFormSection
          title={`Create Delivery Note - ${deliveryInvoice.reference}`}
          description="Enter delivered quantities by item. If not all quantities are delivered, status is automatically set to partial."
        >
          <div className="grid gap-3 md:grid-cols-2">
            <UniversalField label="Carrier">
              <input className="input" value={deliveryCarrier} onChange={(e) => setDeliveryCarrier(e.target.value)} placeholder="Transporteur" />
            </UniversalField>
            <UniversalField label="Waybill">
              <input className="input" value={deliveryWaybill} onChange={(e) => setDeliveryWaybill(e.target.value)} placeholder="BL / Tracking" />
            </UniversalField>
          </div>

          <div className="space-y-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
            <h3 className="text-sm font-semibold text-slate-200">Delivered Quantities</h3>
            {deliveryIsStandalone ? (
              standaloneLines.map((line) => (
                <div key={line.invoiceItemId} className="grid gap-3 md:grid-cols-[2fr_1fr_1fr] items-end">
                  <UniversalField label="Product">
                    <input className="input" value={line.productName} readOnly />
                  </UniversalField>
                  <UniversalField label="Invoiced Qty">
                    <input className="input" value={String(line.invoicedQty)} readOnly />
                  </UniversalField>
                  <UniversalField label="Deliver Now">
                    <input className="input" type="number" min="0" max={line.invoicedQty} value={line.deliverNowQty} onChange={(e) => updateStandaloneLine(line.invoiceItemId, e.target.value)} />
                  </UniversalField>
                </div>
              ))
            ) : (
              deliveryLines.map((line) => {
                const remaining = Math.max(line.orderedQty - line.deliveredQty, 0);
                return (
                  <div key={line.orderItemId} className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_1fr] items-end">
                    <UniversalField label="Product">
                      <input className="input" value={line.productName} readOnly />
                    </UniversalField>
                    <UniversalField label="Ordered">
                      <input className="input" value={String(line.orderedQty)} readOnly />
                    </UniversalField>
                    <UniversalField label="Already Delivered">
                      <input className="input" value={String(line.deliveredQty)} readOnly />
                    </UniversalField>
                    <UniversalField label={`Deliver Now (remaining ${remaining})`}>
                      <input className="input" type="number" min="0" max={remaining} value={line.deliverNowQty} onChange={(e) => updateDeliveryLine(line.orderItemId, e.target.value)} />
                    </UniversalField>
                  </div>
                );
              })
            )}
          </div>

          <div className="space-y-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
            <h3 className="text-sm font-semibold text-slate-200">Delivery Expenses</h3>
            <p className="text-xs text-slate-400">Attach optional delivery expenses to this delivery note.</p>
            {deliveryExpenses.map((expense) => (
              <div key={expense.id} className="grid gap-3 md:grid-cols-[1.5fr_2fr_1fr_auto] items-end">
                <UniversalField label="Supplier (Optional)">
                  <select className="input" value={expense.supplierId} onChange={(e) => updateDeliveryExpense(expense.id, { supplierId: e.target.value })}>
                    <option value="">Select supplier</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                    ))}
                  </select>
                </UniversalField>
                <UniversalField label="Description">
                  <input className="input" value={expense.description} onChange={(e) => updateDeliveryExpense(expense.id, { description: e.target.value })} placeholder="Freight, handling, insurance..." />
                </UniversalField>
                <UniversalField label="Amount">
                  <input className="input" type="number" min="0" step="0.01" value={expense.amount} onChange={(e) => updateDeliveryExpense(expense.id, { amount: e.target.value })} />
                </UniversalField>
                <button type="button" className="btn-secondary btn-sm" onClick={() => removeDeliveryExpense(expense.id)}>Remove</button>
              </div>
            ))}

            <button type="button" className="btn-secondary" onClick={addDeliveryExpense}>+ Add Delivery Expense</button>
          </div>

          <UniversalActionBar>
            <button type="button" className="btn-secondary" onClick={closeDeliveryComposer}>Cancel</button>
            <button type="button" className="btn-primary" onClick={createDeliveryNote} disabled={deliverySubmitting}>
              {deliverySubmitting ? "Creating..." : "Create Delivery Note"}
            </button>
          </UniversalActionBar>
        </UniversalFormSection>
      )}
    </main>
  );
}
