import request from "supertest";
import type { Express } from "express";
import type { UserRole } from "../../src/auth/User";

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

export async function createUserAndLogin(
  app: Express,
  adminAgent: AuthedAgent,
  opts: { email: string; displayName: string; password: string; role: UserRole },
): Promise<AuthedAgent> {
  await adminAgent.post("/admin/users").type("form").send(opts).expect(302);

  const agent = request.agent(app);
  await agent
    .post("/login")
    .type("form")
    .send({ email: opts.email, password: opts.password })
    .expect(302);
  return agent;
}
