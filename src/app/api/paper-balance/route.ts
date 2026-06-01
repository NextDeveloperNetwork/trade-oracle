import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const balances = await prisma.paperBalance.findMany({
      where: { amount: { gt: 0 } }  // Skip zeroed-out (purged) balances
    });
    const portfolio: Record<string, number> = {};
    balances.forEach((b: { asset: string; amount: number }) => {
      portfolio[b.asset] = b.amount;
    });
    // Ensure USDT exists
    if (portfolio.USDT === undefined) {
       portfolio.USDT = 10000;
       await prisma.paperBalance.upsert({
         where: { asset: "USDT" },
         update: { amount: 10000 },
         create: { asset: "USDT", amount: 10000 }
       });
    }
    return NextResponse.json(portfolio);
  } catch (error) {
    console.error("Paper balance fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch paper balances" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { asset, amount } = await req.json();
    const balance = await prisma.paperBalance.upsert({
      where: { asset },
      update: { amount },
      create: { asset, amount }
    });
    return NextResponse.json(balance);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update paper balance" }, { status: 500 });
  }
}
