import { execSync } from "node:child_process";

export default async function globalSetup() {
  process.env.DATABASE_URL = "file:./prisma/test.db";
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: "file:./prisma/test.db" },
    stdio: "inherit",
  });
}
