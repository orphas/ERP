import { Prisma } from "@prisma/client";

type TxClient = Prisma.TransactionClient;

export type DocumentRefType =
  | "quote"
  | "order"
  | "invoice"
  | "delivery"
  | "purchaseOrder"
  | "journal"
  | "payroll";

const configByType: Record<DocumentRefType, { prefixKey: string; sequenceKey: string }> = {
  quote: { prefixKey: "quoteNumberPrefix", sequenceKey: "quoteSequence" },
  order: { prefixKey: "orderNumberPrefix", sequenceKey: "orderSequence" },
  invoice: { prefixKey: "invoiceNumberPrefix", sequenceKey: "invoiceSequence" },
  delivery: { prefixKey: "deliveryNumberPrefix", sequenceKey: "deliverySequence" },
  purchaseOrder: { prefixKey: "purchaseOrderNumberPrefix", sequenceKey: "purchaseOrderSequence" },
  journal: { prefixKey: "journalNumberPrefix", sequenceKey: "journalSequence" },
  payroll: { prefixKey: "payrollNumberPrefix", sequenceKey: "payrollSequence" },
};

function defaultConfigFor(type: DocumentRefType) {
  if (type === "quote") return { prefix: "QT", sequence: 1 };
  if (type === "order") return { prefix: "SO", sequence: 1 };
  if (type === "invoice") return { prefix: "INV", sequence: 1 };
  if (type === "delivery") return { prefix: "DL", sequence: 1 };
  if (type === "purchaseOrder") return { prefix: "PO", sequence: 1 };
  if (type === "journal") return { prefix: "JE", sequence: 1 };
  return { prefix: "PAY", sequence: 1 };
}

export async function generateDocumentReference(tx: TxClient, type: DocumentRefType): Promise<string> {
  const cfg = configByType[type];
  const defaults = defaultConfigFor(type);

  const current =
    (await tx.companySettings.findUnique({ where: { id: 1 } })) ||
    (await tx.companySettings.create({
      data: {
        id: 1,
        companyName: "Sahara Global Industrial Chemicals & Resins (SGICR)",
        pdfHeaderSpacePx: 72,
        pdfFooterSpacePx: 56,
      },
    }));

  const prefix = String((current as any)[cfg.prefixKey] || defaults.prefix).trim() || defaults.prefix;
  const nextSequence = Number((current as any)[cfg.sequenceKey] ?? defaults.sequence);
  const year = new Date().getFullYear();
  const reference = `${prefix}-${year}-${String(nextSequence).padStart(5, "0")}`;

  await tx.companySettings.update({
    where: { id: current.id },
    data: {
      [cfg.sequenceKey]: nextSequence + 1,
    },
  });

  return reference;
}
