import { expect, test } from "@playwright/test";

type RoleCase = {
  name: "admin" | "manager" | "staff";
  username: string;
  password: string;
  allowedPages: string[];
  blockedPages: string[];
  allowedApis: string[];
  blockedApis: string[];
};

const roles: RoleCase[] = [
  {
    name: "admin",
    username: "admin",
    password: "admin123",
    allowedPages: ["/settings", "/finance/journal", "/hr/payroll", "/reporting?view=finance"],
    blockedPages: [],
    allowedApis: ["/api/settings/company", "/api/finance/journal", "/api/hr/payroll"],
    blockedApis: [],
  },
  {
    name: "manager",
    username: "manager",
    password: "manager123",
    allowedPages: ["/settings", "/finance/journal", "/hr/payroll", "/reporting?view=sales"],
    blockedPages: [],
    allowedApis: ["/api/settings/company", "/api/finance/journal", "/api/hr/payroll"],
    blockedApis: [],
  },
  {
    name: "staff",
    username: "staff",
    password: "staff123",
    allowedPages: ["/sales/quotes", "/inventory/products", "/reporting?view=inventory"],
    blockedPages: ["/settings", "/finance/journal", "/hr/payroll"],
    allowedApis: ["/api/sales/quotes", "/api/inventory/products", "/api/procurement/orders"],
    blockedApis: ["/api/settings/company", "/api/finance/journal", "/api/hr/payroll"],
  },
];

test.describe("Role Matrix", () => {
  for (const roleCase of roles) {
    test(`${roleCase.name} access policy`, async ({ request }) => {
      const login = await request.post("/api/auth/login", {
        data: {
          username: roleCase.username,
          password: roleCase.password,
        },
      });
      expect(login.ok()).toBeTruthy();

      for (const pagePath of roleCase.allowedPages) {
        const res = await request.get(pagePath, { maxRedirects: 0 });
        expect([200, 307, 308]).toContain(res.status());
      }

      for (const pagePath of roleCase.blockedPages) {
        const res = await request.get(pagePath, { maxRedirects: 0 });
        expect([307, 308]).toContain(res.status());
      }

      for (const apiPath of roleCase.allowedApis) {
        const res = await request.get(apiPath, { maxRedirects: 0 });
        expect(res.status()).toBe(200);
      }

      for (const apiPath of roleCase.blockedApis) {
        const res = await request.get(apiPath, { maxRedirects: 0 });
        expect([401, 403]).toContain(res.status());
      }

      const printRes = await request.get("/api/print/invoice/1", { maxRedirects: 0 });
      expect([200, 404]).toContain(printRes.status());
      if (printRes.status() === 200) {
        expect(printRes.headers()["content-type"]).toContain("application/pdf");
      }
    });
  }
});
