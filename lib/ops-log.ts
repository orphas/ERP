import { prisma } from "@/lib/prisma";

export async function logOperation(input: {
  action: string;
  entityType: string;
  entityId?: number | null;
  details?: string | null;
  userId?: number | null;
}) {
  try {
    await prisma.operationsLog.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        details: input.details ?? null,
        userId: input.userId ?? null,
      },
    });
  } catch {
    // Keep business operation successful even if audit logging fails.
  }
}
