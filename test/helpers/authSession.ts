import request from "supertest";
import type { Express } from "express";

export type AuthedAgent = ReturnType<typeof request.agent>;

export async function loginAs(
  app: Express,
  role: "admin" | "staff" | "user",
): Promise<AuthedAgent> {
  const credentials: Record<string, { email: string; password: string }> = {
    admin: { email: "admin@app.test", password: "password123" },
    staff: { email: "staff@app.test", password: "password123" },
    user:  { email: "user@app.test",  password: "password123" },
  };

  const agent = request.agent(app);
  await agent.post("/login").type("form").send(credentials[role]).expect(302);
  return agent;
}
