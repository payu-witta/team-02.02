import { resetPrismaClient } from "../../src/lib/prisma.js";

process.env.DATABASE_URL = "file:./prisma/test.db";
resetPrismaClient();
