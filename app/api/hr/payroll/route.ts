import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isModuleClosed } from "@/lib/period-lock";
import { generateDocumentReference } from "@/lib/doc-ref";

export async function GET() {
  try {
    const payrolls = await prisma.payroll.findMany({
      include: {
        employee: true,
      },
      orderBy: { month: "desc" },
    });

    return NextResponse.json(payrolls);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch payrolls" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { employeeId, month, baseSalary, bonuses, deductions } = body;

    if (!employeeId || !month || baseSalary === undefined) {
      return NextResponse.json({ error: "employeeId, month and baseSalary are required" }, { status: 400 });
    }

    const base = Number(baseSalary);
    const bonus = Number(bonuses ?? 0);
    const deduction = Number(deductions ?? 0);
    const netPay = base + bonus - deduction;
    const payrollMonth = new Date(month);

    if (await isModuleClosed(prisma, "hr", payrollMonth)) {
      return NextResponse.json({ error: "HR period is closed for this month" }, { status: 423 });
    }

    const exists = await prisma.payroll.findUnique({
      where: {
        employeeId_month: {
          employeeId: Number(employeeId),
          month: payrollMonth,
        },
      },
      select: { id: true },
    });
    if (exists) {
      return NextResponse.json({ error: "Payroll already exists for employee and month" }, { status: 400 });
    }

    const payroll = await prisma.$transaction(async (tx) => {
      const reference = await generateDocumentReference(tx, "payroll");
      return tx.payroll.create({
        data: {
          employeeId: Number(employeeId),
          reference,
          month: payrollMonth,
          baseSalary: base,
          bonuses: bonus,
          deductions: deduction,
          netPay,
        },
        include: { employee: true },
      });
    });

    return NextResponse.json(payroll, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create payroll" }, { status: 500 });
  }
}
