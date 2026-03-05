import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import Database from "better-sqlite3";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const dbPath = (process.env.DATABASE_URL || "file:./dev.db").replace(
    "file:",
    ""
  );
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  const adapter = new PrismaBetterSqlite3(db);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
