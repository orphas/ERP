import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

async function seed() {
  console.log("🌱 Starting seed...");

  try {
    // Create categories
    const categories = await prisma.category.createMany({
      data: [
        { name: "Electronics", description: "Electronic devices and components" },
        { name: "Furniture", description: "Office and home furniture" },
        { name: "Software", description: "Software licenses and subscriptions" },
        { name: "Services", description: "Professional services" },
        { name: "Supplies", description: "Office supplies and materials" },
      ],
    });

    console.log("✓ Created categories");

    // Create units
    const units = await prisma.unitOfMeasure.createMany({
      data: [
        { name: "Piece", code: "PC" },
        { name: "Box", code: "BOX" },
        { name: "Kilogram", code: "KG" },
        { name: "Meter", code: "M" },
        { name: "Liter", code: "L" },
        { name: "Hour", code: "HR" },
      ],
    });

    console.log("✓ Created units");

    // Create warehouse
    const warehouse = await prisma.warehouse.create({
      data: {
        name: "Main Warehouse",
        code: "WH-001",
        zoneType: "main",
        address: "123 Business St, Casablanca, Morocco",
        isActive: true,
      },
    });

    console.log("✓ Created warehouse");

    // Create sample products
    await prisma.product.createMany({
      data: [
        {
          name: "Laptop Pro",
          sku: "LAP-001",
          price: "12999.99",
          cost: "9999.99",
          categoryId: 1,
          description: "High-performance laptop",
          minStockThreshold: 5,
          isActive: true,
        },
        {
          name: "Office Chair",
          sku: "CHR-001",
          price: "2999.99",
          cost: "1999.99",
          categoryId: 2,
          description: "Ergonomic office chair",
          minStockThreshold: 10,
          isActive: true,
        },
        {
          name: "Monitor 27\"",
          sku: "MON-001",
          price: "3999.99",
          cost: "2999.99",
          categoryId: 1,
          description: "4K monitor",
          minStockThreshold: 8,
          isActive: true,
        },
        {
          name: "Printer Ink",
          sku: "INK-001",
          price: "199.99",
          cost: "99.99",
          categoryId: 5,
          description: "Printer ink cartridge",
          minStockThreshold: 20,
          isActive: true,
        },
      ],
    });

    console.log("✓ Created products");

    // Create sample customers
    await prisma.customer.createMany({
      data: [
        {
          name: "ABC Trading Company",
          email: "contact@abctrading.ma",
          phone: "+212 522 123456",
          address: "Rue de Commerce, Casablanca",
          pricingTier: "gold",
          creditLimit: "500000",
          defaultCreditTermDays: 30,
          ice: "000123456789012",
          isActive: true,
        },
        {
          name: "XYZ Enterprises",
          email: "info@xyzenterprises.ma",
          phone: "+212 533 654321",
          address: "Avenue Mohammed V, Rabat",
          pricingTier: "silver",
          creditLimit: "300000",
          defaultCreditTermDays: 30,
          ice: "000987654321098",
          isActive: true,
        },
        {
          name: "Tech Solutions Ltd",
          email: "sales@techsolutions.ma",
          phone: "+212 544 111111",
          address: "Technopolis, Fes",
          pricingTier: "standard",
          creditLimit: "100000",
          defaultCreditTermDays: 15,
          ice: "000555666777888",
          isActive: true,
        },
      ],
    });

    console.log("✓ Created customers");

    // Create sample employees
    await prisma.employee.createMany({
      data: [
        {
          firstName: "Ahmed",
          lastName: "Hassan",
          email: "ahmed.hassan@company.ma",
          phone: "+212 600 111111",
          position: "Sales Manager",
          department: "Sales",
          salary: "25000",
          hireDate: new Date("2023-01-15"),
          isActive: true,
        },
        {
          firstName: "Fatima",
          lastName: "Karim",
          email: "fatima.karim@company.ma",
          phone: "+212 600 222222",
          position: "Accountant",
          department: "Finance",
          salary: "22000",
          hireDate: new Date("2023-03-01"),
          isActive: true,
        },
        {
          firstName: "Mohammed",
          lastName: "Ali",
          email: "mohammed.ali@company.ma",
          phone: "+212 600 333333",
          position: "Warehouse Manager",
          department: "Operations",
          salary: "20000",
          hireDate: new Date("2023-02-10"),
          isActive: true,
        },
      ],
    });

    console.log("✓ Created employees");

    // Create sample suppliers
    await prisma.supplier.createMany({
      data: [
        {
          name: "Electronics Wholesale",
          defaultCurrency: "USD",
          email: "orders@elecwholesale.ma",
          phone: "+212 520 444444",
          address: "Import zone, Port of Casablanca",
          ice: "000111222333444",
          isActive: true,
        },
        {
          name: "Office Furniture Inc",
          defaultCurrency: "MAD",
          email: "sales@officefurn.ma",
          phone: "+212 540 555555",
          address: "Industrial park, Kenitra",
          ice: "000999888777666",
          isActive: true,
        },
      ],
    });

    console.log("✓ Created suppliers");

    // Create sample accounts
    const accountClasses = [
      {
        code: "1110",
        name: "Share Capital",
        type: "equity",
        accountClass: "1",
      },
      {
        code: "3110",
        name: "Petty Cash",
        type: "asset",
        accountClass: "3",
      },
      {
        code: "3141",
        name: "Bank - MAD",
        type: "asset",
        accountClass: "3",
      },
      {
        code: "3200",
        name: "Inventory",
        type: "asset",
        accountClass: "3",
      },
      {
        code: "3410",
        name: "Accounts Receivable - Customers",
        type: "asset",
        accountClass: "3",
      },
      {
        code: "3455",
        name: "VAT Recoverable on Purchases",
        type: "asset",
        accountClass: "3",
      },
      {
        code: "3456",
        name: "VAT Recoverable on Imports",
        type: "asset",
        accountClass: "3",
      },
      {
        code: "4410",
        name: "Accounts Payable - Suppliers",
        type: "liability",
        accountClass: "4",
      },
      {
        code: "4455",
        name: "VAT Collected on Sales",
        type: "liability",
        accountClass: "4",
      },
      {
        code: "4456",
        name: "Import VAT Clearing",
        type: "liability",
        accountClass: "4",
      },
      {
        code: "6110",
        name: "Cost of Goods Sold",
        type: "expense",
        accountClass: "6",
      },
      {
        code: "6550",
        name: "Foreign Exchange Loss",
        type: "expense",
        accountClass: "6",
      },
      {
        code: "7110",
        name: "Sales Revenue",
        type: "income",
        accountClass: "7",
      },
      {
        code: "7550",
        name: "Foreign Exchange Gain",
        type: "income",
        accountClass: "7",
      },
    ];

    await prisma.account.createMany({
      data: accountClasses,
    });

    console.log("✓ Created accounts");

    await prisma.appUser.createMany({
      data: [
        {
          username: "admin",
          passwordHash: hashPassword("admin123"),
          name: "System Admin",
          role: "admin",
          isActive: true,
        },
        {
          username: "manager",
          passwordHash: hashPassword("manager123"),
          name: "Operations Manager",
          role: "manager",
          isActive: true,
        },
        {
          username: "staff",
          passwordHash: hashPassword("staff123"),
          name: "ERP Staff",
          role: "staff",
          isActive: true,
        },
      ],
      skipDuplicates: true,
    });

    console.log("✓ Created application users");

    console.log("✅ Seed completed successfully!");
  } catch (error) {
    console.error("❌ Seed error:", error);
    throw error;
  }
}

seed()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
