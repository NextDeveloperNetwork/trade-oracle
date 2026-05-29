import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode") || "PAPER";

    // Batch delete everything for the given mode
    await Promise.all([
      prisma.trade.deleteMany({ where: { mode } }),
      prisma.position.deleteMany({ where: { mode } }),
      prisma.completedTrade.deleteMany({ where: { mode } }),
      prisma.balanceSnapshot.deleteMany({ where: { mode } }),
    ]);

    return NextResponse.json({ success: true, message: `System reset for ${mode} complete.` });
  } catch (error) {
    console.error("Reset API error:", error);
    return NextResponse.json({ error: "Failed to reset system" }, { status: 500 });
  }
}
