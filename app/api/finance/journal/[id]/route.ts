import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reverseAndDeleteJournalEntryById } from "@/lib/delete-cascade";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const entry = await prisma.journalEntry.findUnique({
      where: { id },
      include: {
        lines: {
          include: { account: true },
        },
      },
    });

    if (!entry) {
      return NextResponse.json({ error: "Journal entry not found" }, { status: 404 });
    }

    return NextResponse.json(entry);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch journal entry" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const entry = await prisma.journalEntry.findUnique({
      where: { id },
      select: { id: true, isPosted: true },
    });
    if (!entry) {
      return NextResponse.json({ error: "Journal entry not found" }, { status: 404 });
    }
    if (entry.isPosted) {
      return NextResponse.json({ error: "Posted entries cannot be edited" }, { status: 400 });
    }

    const data = await req.json();
    const updated = await prisma.journalEntry.update({
      where: { id },
      data: { description: data.description ?? null },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update journal entry" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    const id = parseInt(rawId);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const entry = await prisma.journalEntry.findUnique({ where: { id }, select: { id: true } });
    if (!entry) {
      return NextResponse.json({ error: "Journal entry not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await reverseAndDeleteJournalEntryById(tx, id);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete journal entry" }, { status: 500 });
  }
}
