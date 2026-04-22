import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromCookies } from "@/lib/auth";

type SearchResult = {
  id: string;
  module: string;
  label: string;
  subLabel: string;
  href: string;
};

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromCookies();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() || "";

  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const includeHr = user.role === "admin" || user.role === "manager";
  const includeFinance = user.role === "admin" || user.role === "manager";

  const [products, customers, employees, suppliers, accounts] = await Promise.all([
    prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: query } },
          { sku: { contains: query } },
        ],
      },
      select: { id: true, name: true, sku: true },
      take: 5,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.customer.findMany({
      where: {
        OR: [{ name: { contains: query } }, { email: { contains: query } }],
      },
      select: { id: true, name: true, email: true },
      take: 5,
      orderBy: { updatedAt: "desc" },
    }),
    includeHr
      ? prisma.employee.findMany({
      where: {
        OR: [
          { firstName: { contains: query } },
          { lastName: { contains: query } },
          { email: { contains: query } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, department: true },
      take: 5,
      orderBy: { updatedAt: "desc" },
    })
      : Promise.resolve([]),
    prisma.supplier.findMany({
      where: {
        OR: [{ name: { contains: query } }, { email: { contains: query } }],
      },
      select: { id: true, name: true, email: true },
      take: 5,
      orderBy: { updatedAt: "desc" },
    }),
    includeFinance
      ? prisma.account.findMany({
      where: {
        OR: [{ code: { contains: query } }, { name: { contains: query } }],
      },
      select: { id: true, code: true, name: true, type: true },
      take: 5,
      orderBy: { updatedAt: "desc" },
    })
      : Promise.resolve([]),
  ]);

  const results: SearchResult[] = [
    ...products.map((p) => ({
      id: `product-${p.id}`,
      module: "Inventory",
      label: p.name,
      subLabel: p.sku,
      href: "/inventory/products",
    })),
    ...customers.map((c) => ({
      id: `customer-${c.id}`,
      module: "Sales",
      label: c.name,
      subLabel: c.email || "Customer",
      href: "/sales/customers",
    })),
    ...employees.map((e) => ({
      id: `employee-${e.id}`,
      module: "HR",
      label: `${e.firstName} ${e.lastName}`,
      subLabel: e.department || "Employee",
      href: "/hr/employees",
    })),
    ...suppliers.map((s) => ({
      id: `supplier-${s.id}`,
      module: "Procurement",
      label: s.name,
      subLabel: s.email || "Supplier",
      href: "/procurement/suppliers",
    })),
    ...accounts.map((a) => ({
      id: `account-${a.id}`,
      module: "Finance",
      label: `${a.code} - ${a.name}`,
      subLabel: a.type,
      href: "/finance/accounts",
    })),
  ];

  return NextResponse.json({ results: results.slice(0, 20) });
}
