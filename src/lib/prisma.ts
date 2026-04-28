import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

let client: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!client) {
    const url = process.env.DATABASE_URL ?? "file:./dev.db";
    const adapter = new PrismaBetterSqlite3({ url });
    client = new PrismaClient({ adapter } as any);
  }
  return client;
}

export function resetPrismaClient(): void {
  client = null;
}
