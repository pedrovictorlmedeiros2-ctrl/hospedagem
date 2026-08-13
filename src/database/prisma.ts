import { PrismaClient } from "@prisma/client";

let client: PrismaClient | undefined;

/**
 * Single shared PrismaClient instance. Prisma manages its own connection
 * pool internally — creating one per request/command would exhaust
 * database connections under concurrent load.
 */
export function getPrismaClient(): PrismaClient {
  if (!client) {
    client = new PrismaClient({
      log: process.env["NODE_ENV"] === "production" ? ["warn", "error"] : ["warn", "error"],
    });
  }
  return client;
}

export async function disconnectPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = undefined;
  }
}
