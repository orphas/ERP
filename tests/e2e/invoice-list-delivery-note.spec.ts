import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

type NamedRecord = { id: number; name: string };
type ProductRecord = { id: number; name: string; sku?: string; price?: string };
type WarehouseRecord = { id: number; name: string; code: string };
type SalesOrder = { id: number; reference: string };
type Delivery = { id: number; reference: string };
type Invoice = { id: number; reference: string };

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
      phone: "+212600000011",
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
      phone: "+212600000012",
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
    categoryId = (await createdCategory.json()).id as number;
  }

  const now = Date.now();
  const createdProduct = await request.post("/api/inventory/products", {
    data: {
      name: `E2E Product ${now}`,
      sku: `E2E-SKU-${now}`,
      categoryId,
      price: 100,
      cost: 60,
      isActive: true,
    },
  });
  expect(createdProduct.ok()).toBeTruthy();
  return (await createdProduct.json()) as ProductRecord;
}

async function ensureWarehouse(request: APIRequestContext): Promise<WarehouseRecord> {
  const listRes = await request.get("/api/inventory/warehouses?isActive=true");
  expect(listRes.ok()).toBeTruthy();
  const warehouses = (await listRes.json()) as WarehouseRecord[];
  if (warehouses.length > 0) return warehouses[0];

  const now = Date.now();
  const created = await request.post("/api/inventory/warehouses", {
    data: {
      name: `E2E Warehouse ${now}`,
      code: `E2E-WH-${now}`,
      zoneType: "main",
      isActive: true,
    },
  });
  expect(created.ok()).toBeTruthy();
  return (await created.json()) as WarehouseRecord;
}

async function ensureStockBatch(request: APIRequestContext, productId: number, warehouseId: number) {
  const now = Date.now();
  const createBatch = await request.post("/api/inventory/batches", {
    data: {
      productId,
      warehouseId,
      batchNumber: `E2E-BATCH-${now}`,
      quantity: 20,
      availableQuantity: 20,
      landedUnitCost: 60,
    },
  });
  expect(createBatch.ok()).toBeTruthy();
}

test.describe("Invoice list delivery-note action", () => {
  test("shows Print Delivery Note only when invoice has linked delivery", async ({ request, page }) => {
    await apiLogin(request);

    const customer = await ensureActiveCustomer(request);
    const supplier = await ensureSupplier(request);
    const product = await ensureProduct(request);
    const warehouse = await ensureWarehouse(request);
    await ensureStockBatch(request, product.id, warehouse.id);

    const orderRes = await request.post("/api/sales/orders", {
      data: {
        customerId: customer.id,
        creditTermDays: 15,
        vatRate: 20,
        items: [{ productId: product.id, quantity: 1, unitPrice: Number(product.price || 100) }],
      },
    });
    expect(orderRes.status()).toBe(201);
    const order = (await orderRes.json()) as SalesOrder;

    const deliveryRes = await request.post("/api/sales/deliveries", {
      data: {
        orderId: order.id,
        carrier: "E2E Carrier",
        waybill: `WB-${Date.now()}`,
        items: [{ orderId: order.id, quantity: 1 }],
      },
    });
    expect(deliveryRes.status()).toBe(201);
    const delivery = (await deliveryRes.json()) as Delivery;

    const invoiceFromOrderRes = await request.post(`/api/sales/orders/${order.id}/invoice`);
    expect(invoiceFromOrderRes.status()).toBe(201);
    const invoiceFromOrder = (await invoiceFromOrderRes.json()) as Invoice;

    const invoiceWithoutDeliveryRes = await request.post("/api/sales/invoices", {
      data: {
        customerId: customer.id,
        dueDate: null,
        vatRate: 20,
        items: [
          {
            itemType: "charge",
            productId: null,
            description: `Standalone expense | Paid to third party: ${supplier.name} | Third-party invoice: E2E-NO-DEL-${Date.now()}`,
            quantity: 1,
            unitPrice: 25,
          },
        ],
      },
    });
    expect(invoiceWithoutDeliveryRes.status()).toBe(201);
    const invoiceWithoutDelivery = (await invoiceWithoutDeliveryRes.json()) as Invoice;

    await loginViaUi(page);
    await page.goto("/sales/invoices");

    const withDeliveryRow = page
      .locator("tbody tr")
      .filter({ has: page.locator(`a[href="/sales/invoices/${invoiceFromOrder.id}"]`) })
      .first();
    await expect(withDeliveryRow).toBeVisible();
    const printDeliveryLink = withDeliveryRow.locator(`a[href="/api/print/delivery/${delivery.id}?lang=en"]`);
    await expect(printDeliveryLink).toBeVisible();
    await expect(printDeliveryLink).toHaveText("Print Delivery Note");

    const withoutDeliveryRow = page
      .locator("tbody tr")
      .filter({ has: page.locator(`a[href="/sales/invoices/${invoiceWithoutDelivery.id}"]`) })
      .first();
    await expect(withoutDeliveryRow).toBeVisible();
    const noDeliveryButton = withoutDeliveryRow.getByRole("button", { name: "No Delivery Note" });
    await expect(noDeliveryButton).toBeVisible();
    await expect(noDeliveryButton).toBeDisabled();
  });
});
