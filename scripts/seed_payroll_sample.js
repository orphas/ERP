const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const suffix = Date.now();
  const employee = await prisma.employee.create({
    data: {
      firstName: "Sara",
      lastName: "Bennani",
      email: `sara.${suffix}@sgicr.example`,
      hireDate: new Date("2025-01-10"),
      salary: 15000,
      department: "Finance",
      position: "Accountant",
      isActive: true,
    },
  });

  await prisma.payroll.create({
    data: {
      employeeId: employee.id,
      month: new Date("2026-04-01"),
      baseSalary: 15000,
      bonuses: 500,
      deductions: 250,
      netPay: 15250,
    },
  });

  console.log("Created employee and payroll", employee.id);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
