import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode") || "PAPER";
    const trades = await prisma.trade.findMany({
      where: { mode },
      orderBy: { time: "desc" },
      take: 100
    });
    return NextResponse.json(trades);
  } catch (error) {
    console.error("GET trades error:", error);
    return NextResponse.json({ error: "Failed to fetch trades" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const trade = await prisma.trade.create({
      data: {
        coin: body.coin,
        action: body.action,
        amount: parseFloat(body.amount),
        price: parseFloat(body.price),
        totalUSDT: parseFloat(body.totalUSDT),
        strategy: body.strategy,
        mode: body.mode || "PAPER",
      }
    });
    return NextResponse.json(trade);
  } catch (error) {
    console.error("POST trades error:", error);
    return NextResponse.json({ error: "Failed to record trade" }, { status: 500 });
  }
}
