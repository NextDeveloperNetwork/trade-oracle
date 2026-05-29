import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log("Connecting to database...");
    await prisma.$connect();
    console.log("Successfully connected!");
    
    const count = await prisma.trade.count();
    console.log(`Total trades in DB: ${count}`);
    
    const config = await prisma.userConfig.findFirst();
    console.log("Config from DB:", config);
    
  } catch (e: any) {
    console.error("Database connection failed:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
