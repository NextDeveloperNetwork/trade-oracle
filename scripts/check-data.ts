import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  try {
    const config = await prisma.userConfig.findFirst();
    console.log("CONFIG:", config);
    
    const tradeCount = await prisma.trade.count();
    console.log("TRADES:", tradeCount);
    
    const posCount = await prisma.position.count();
    console.log("POSITIONS:", posCount);

    const compCount = await prisma.completedTrade.count();
    console.log("COMPLETED:", compCount);

  } catch (e: any) {
    console.error("ERROR:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
