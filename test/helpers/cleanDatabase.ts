import { getPrismaClient } from "../../src/lib/prisma.js";

export async function cleanDatabase(): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.rsvp.deleteMany();
  await prisma.event.deleteMany();
}
