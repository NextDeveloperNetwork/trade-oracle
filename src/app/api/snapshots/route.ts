import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const totalUSDT = parseFloat(body.totalUSDT);
    const mode = body.mode || "PAPER";

    if (isNaN(totalUSDT)) {
      console.error("API: Received NaN for totalUSDT");
      return NextResponse.json({ error: "Invalid totalUSDT value" }, { status: 400 });
    }

    const snapshot = await prisma.balanceSnapshot.create({
      data: {
        totalUSDT,
        mode,
      }
    });

    return NextResponse.json(snapshot);
  } catch (error: any) {
    console.error("CRITICAL: POST snapshots error:", error.message || error);
    return NextResponse.json({ 
      error: "Failed to create snapshot",
      details: error.message 
    }, { status: 500 });
  }
}
