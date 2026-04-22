import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

type NamedRecord = { id: number; name: string };
type ProductRecord = { id: number; name: string; sku?: string };
type InvoiceItemRecord = { itemType: string; description: string | null };
type InvoiceDetail = { id: number; reference: string; items: InvoiceItemRecord[] };
type POExpenseRecord = { supplierId: number; description: string; externalRef: string | null };
type PODetail = { id: number; expenses: POExpenseRecord[] };
type CreatedEntity = { id: number };
type JournalEntry = {
  description: string | null;
  lines: Array<{
    type: "debit" | "credit";
    amount: string;
    account?: { code?: string };
  }>;
};

async function apiLogin(request: APIRequestContext) {
  const login = await request.post("/api/auth/login", {
    data: { username: "admin", password: "admin123" },
  });
  expect(login.ok()).toBeTruthy();
}

async function loginViaUi(page: Page) {
  await page.goto("/login");
  await page.locator('input[autocomplete="username"]').fill("admin");
  await page.locator('input[autocomplete="current-password"]').fill("admin123");
  await page.getByRole("button", { name: "Enter ERP workspace" }).click();
  await expect(page).toHaveURL(/^(?!.*\/login).*/);
}

async function ensureActiveCustomer(request: APIRequestContext): Promise<NamedRecord> {
  const listRes = await request.get("/api/sales/customers?isActive=true");
  expect(listRes.ok()).toBeTruthy();
  const customers = (await listRes.json()) as NamedRecord[];
  if (customers.length > 0) return customers[0];

  const created = await request.post("/api/sales/customers", {
    data: {
      name: `E2E Customer ${Date.now()}`,
      email: "e2e-customer@example.com",
      phone: "+212600000001",
      isActive: true,
    },
  });
  expect(created.ok()).toBeTruthy();
  return (await created.json()) as NamedRecord;
}

async function ensureSupplier(request: APIRequestContext): Promise<NamedRecord> {
  const listRes = await request.get("/api/procurement/suppliers");
  expect(listRes.ok()).toBeTruthy();
  const suppliers = (await listRes.json()) as NamedRecord[];
  if (suppliers.length > 0) return suppliers[0];

  const created = await request.post("/api/procurement/suppliers", {
    data: {
      name: `E2E Supplier ${Date.now()}`,
      email: "e2e-supplier@example.com",
      phone: "+212600000002",
      isActive: true,
      defaultCurrency: "MAD",
    },
  });
  expect(created.ok()).toBeTruthy();
  return (await created.json()) as NamedRecord;
}

async function ensureProduct(request: APIRequestContext): Promise<ProductRecord> {
  const productsRes = await request.get("/api/inventory/products");
  expect(productsRes.ok()).toBeTruthy();
  const products = (await productsRes.json()) as ProductRecord[];
  if (products.length > 0) return products[0];

  const categoriesRes = await request.get("/api/inventory/categories");
  expect(categoriesRes.ok()).toBeTruthy();
  const categories = (await categoriesRes.json()) as Array<{ id: number; name: string }>;
  let categoryId = categories[0]?.id;

  if (!categoryId) {
    const createdCategory = await request.post("/api/inventory/categories", {
      data: { name: `E2E Category ${Date.now()}` },
    });
    expect(createdCategory.ok()).toBeTruthy();
    const category = (await createdCategory.json()) as { id: number };
    categoryId = category.id;
  }

  const createdProduct = await request.post("/api/inventory/products", {
    data: {
      name: `E2E Product ${Date.now()}`,
      sku: `E2E-SKU-${Date.now()}`,
      categoryId,
      price: 100,
      cost: 60,
      isActive: true,
    },
  });
  expect(createdProduct.ok()).toBeTruthy();
  return (await createdProduct.json()) as ProductRecord;
}

test.describe("Third-party expense fields", () => {
  test("invoice charge line captures third-party metadata", async ({ page, request }) => {
    await apiLogin(request);
    const customer = await ensureActiveCustomer(request);
    const supplier = await ensureSupplier(request);

    await loginViaUi(page);
    await page.goto("/sales/invoices");

    const token = `TP-INV-${Date.now()}`;
    const invoiceForm = page.locator("#new-invoice");

    await invoiceForm.locator("select").first().selectOption(String(customer.id));

    const thirdPartySupplierSelect = invoiceForm
      .locator("select")
      .filter({ has: page.locator("option", { hasText: "Select third-party supplier" }) })
      .first();

    await thirdPartySupplierSelect.selectOption(String(supplier.id));
    await invoiceForm
      .locator('input[placeholder="Transport, customs, brokerage..."]')
      .first()
      .fill(`Freight adjustment ${token}`);
    await invoiceForm
      .locator('input[placeholder="Third-party invoice/ref"]')
      .first()
      .fill(token);
    await invoiceForm
      .locator('.form-group:has-text("Unit Price") input')
      .last()
      .fill("37.5");

    const createInvoiceResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/api/sales/invoices") && response.request().method() === "POST"
    );
    await invoiceForm.getByRole("button", { name: "Create Invoice" }).click();
    const createInvoiceResponse = await createInvoiceResponsePromise;
    expect(createInvoiceResponse.status()).toBe(201);
    const createdInvoice = (await createInvoiceResponse.json()) as CreatedEntity;
    expect(createdInvoice.id).toBeGreaterThan(0);

    const invoiceId = createdInvoice.id;
    const invoiceRes = await request.get(`/api/sales/invoices/${invoiceId}`);
    expect(invoiceRes.ok()).toBeTruthy();
    const invoice = (await invoiceRes.json()) as InvoiceDetail;

    const matchingCharge = invoice.items.find(
      (item) =>
        item.itemType === "charge" &&
        (item.description || "").includes(`Paid to third party: ${supplier.name}`) &&
        (item.description || "").includes(`Third-party invoice: ${token}`)
    );

    expect(matchingCharge).toBeTruthy();

    const journalRes = await request.get("/api/finance/journal");
    expect(journalRes.ok()).toBeTruthy();
    const journals = (await journalRes.json()) as JournalEntry[];
    const posting = journals.find((entry) => entry.description === `Invoice posting ${invoice.reference}`);
    expect(posting).toBeTruthy();

    const thirdPartyPayable = posting?.lines.find(
      (line) => line.type === "credit" && line.account?.code === "4480" && Number(line.amount) === 37.5
    );
    const cogsLine = posting?.lines.find(
      (line) => line.type === "debit" && line.account?.code === "6110" && Number(line.amount) >= 37.5
    );

    expect(thirdPartyPayable).toBeTruthy();
    expect(cogsLine).toBeTruthy();
  });

  test("purchase order expense line stores third-party payee and supplier invoice", async ({ page, request }) => {
    await apiLogin(request);
    const supplier = await ensureSupplier(request);
    const product = await ensureProduct(request);

    await loginViaUi(page);
    await page.goto("/procurement/orders");

    const token = `TP-PO-${Date.now()}`;
    const poForm = page.locator("#new-purchase-order");

    await poForm.locator("select").first().selectOption(String(supplier.id));
    await poForm
      .locator('.form-group:has-text("Purchase Type") select')
      .first()
      .selectOption("import");
    await poForm
      .locator('input[placeholder="e.g. China"]')
      .first()
      .fill("Morocco");
    await poForm
      .locator('.form-group:has-text("Product") select')
      .first()
      .selectOption(String(product.id));

    await poForm
      .locator('.form-group:has-text("Paid To (Third-Party Supplier)") select')
      .first()
      .selectOption(String(supplier.id));
    await poForm
      .locator('input[placeholder="Transport, offloading, customs broker..."]')
      .first()
      .fill(`Freight service ${token}`);
    await poForm
      .locator('input[placeholder="e.g. INV-2025-081"]')
      .first()
      .fill(token);
    await poForm
      .locator('.form-group:has-text("Amount") input')
      .first()
      .fill("12");
    await poForm
      .locator('.form-group:has-text("VAT %") input')
      .first()
      .fill("10");

    const createPoResponsePromise = page.waitForResponse(
      (response) => response.url().includes("/api/procurement/orders") && response.request().method() === "POST"
    );
    await poForm.getByRole("button", { name: "Create PO" }).click();
    const createPoResponse = await createPoResponsePromise;
    expect(createPoResponse.status()).toBe(201);
    const createdPo = (await createPoResponse.json()) as CreatedEntity;
    expect(createdPo.id).toBeGreaterThan(0);

    const poId = createdPo.id;
    const poRes = await request.get(`/api/procurement/orders/${poId}`);
    expect(poRes.ok()).toBeTruthy();
    const po = (await poRes.json()) as PODetail;

    const matchingExpense = po.expenses.find(
      (expense) =>
        expense.supplierId === supplier.id &&
        expense.externalRef === token &&
        expense.description.includes(token)
    );

    expect(matchingExpense).toBeTruthy();
  });
});
