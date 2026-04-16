import type { Express } from "express";
import type { AuthedAgent } from "./authSession";

export const BASE_EVENT = {
  title: "Seed Event",
  description: "A seeded event for integration testing.",
  location: "Test Hall",
  category: "educational",
  startDatetime: new Date(Date.now() + 86_400_000).toISOString().slice(0, 16),
  endDatetime: new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 16),
};

export async function seedEvent(app: Express, ownerAgent: AuthedAgent): Promise<string> {
  const res = await ownerAgent.post("/events").type("form").send(BASE_EVENT).expect(302);
  const location = res.headers.location as string;
  return location.replace("/events/", "");
}
