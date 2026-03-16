import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "./db/prisma.js";

const DEMO_ACCOUNTS = [
  { username: "demo", password: "demo123456" },
  { username: "judge", password: "judge123456" },
];

async function seed() {
  console.log("[Seed] Creating demo accounts...");

  for (const account of DEMO_ACCOUNTS) {
    const existing = await prisma.user.findUnique({
      where: { username: account.username },
    });

    if (!existing) {
      const hashed = await bcrypt.hash(account.password, 10);
      await prisma.user.create({
        data: { username: account.username, password: hashed },
      });
      console.log(`[Seed] Created: ${account.username} / ${account.password}`);
    } else {
      console.log(`[Seed] Already exists: ${account.username}`);
    }
  }

  console.log("[Seed] Done.");
}

seed()
  .catch((err) => {
    console.error("[Seed] Failed:", err);
    process.exit(1);
  });
