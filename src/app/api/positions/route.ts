import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode") || "PAPER";
    const positions = await prisma.position.findMany({
      where: { mode }
    });
    return NextResponse.json(positions);
  } catch (error) {
    console.error("GET positions error:", error);
    return NextResponse.json({ error: "Failed to fetch positions" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const mode = body.mode || "PAPER";
    const position = await prisma.position.upsert({
      where: { coin_mode: { coin: body.coin, mode } },
      update: {
        amount: parseFloat(body.amount),
        invested: parseFloat(body.invested),
        entryPrice: parseFloat(body.entryPrice),
      },
      create: {
        coin: body.coin,
        amount: parseFloat(body.amount),
        invested: parseFloat(body.invested),
        entryPrice: parseFloat(body.entryPrice),
        strategy: body.strategy,
        mode,
      }
    });

    return NextResponse.json(position);
  } catch (error) {
    console.error("POST positions error:", error);
    return NextResponse.json({ error: "Failed to record position" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const coin = searchParams.get("coin");
    const mode = searchParams.get("mode") || "PAPER";
    if (!coin) return NextResponse.json({ error: "Coin required" }, { status: 400 });
    
    await prisma.position.delete({
      where: { coin_mode: { coin, mode } }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE positions error:", error);
    return NextResponse.json({ error: "Failed to delete position" }, { status: 500 });
  }
}
