import { CreateEventFilterService } from "../../src/events/EventService";
import { CreatePrismaEventRepository } from "../../src/events/PrismaEventRepository";
import { getPrismaClient } from "../../src/prisma/client";
import { cleanDatabase } from "../helpers/cleanDatabase";
import { loginAs } from "../helpers/authSession";
import { createComposedApp } from "../../src/composition";

const app = createComposedApp().getExpressApp();

beforeEach(async () => { await cleanDatabase(); });

const repo = CreatePrismaEventRepository(getPrismaClient());
const service = CreateEventFilterService(repo);

// Helper: seed and publish an event via HTTP
async function seedPublishedEvent(overrides: Record<string, string> = {}) {
  const agent = await loginAs(app, "staff");
  const base = {
    title: "Test Event",
    description: "A test event description.",
    location: "Test Hall",
    category: "social",
    startDatetime: new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 16),
    endDatetime:   new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 16),
  };
  const createRes = await agent.post("/events").type("form").send({ ...base, ...overrides }).expect(302);
  const eventId = (createRes.headers.location as string).replace("/events/", "");
  await agent.post(`/events/${eventId}/publish`).expect(302);
  return eventId;
}

describe("Feature 6 — filterEvents (Prisma)", () => {
  it("empty filters returns all published upcoming events", async () => {
    await seedPublishedEvent({ title: "Social Event",  category: "social" });
    await seedPublishedEvent({ title: "Volunteer Day", category: "volunteer" });

    const result = await service.filterEvents({ });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.length).toBeGreaterThanOrEqual(2);
  });

  it("filters by category", async () => {
    await seedPublishedEvent({ title: "Social Event",  category: "social" });
    await seedPublishedEvent({ title: "Volunteer Day", category: "volunteer" });

    const result = await service.filterEvents({ category: "social", timeframe: "upcoming" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.every(e => e.category === "social")).toBe(true);
      expect(result.value.some(e => e.title === "Social Event")).toBe(true);
    }
  });

  it("filters by timeframe upcoming", async () => {
    await seedPublishedEvent({ title: "Upcoming Event" });

    const result = await service.filterEvents({ timeframe: "upcoming" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const now = new Date();
      expect(result.value.every(e => e.startDatetime >= now)).toBe(true);
    }
  });

  it("filters by both category and timeframe", async () => {
    await seedPublishedEvent({ title: "Volunteer Soon", category: "volunteer" });
    await seedPublishedEvent({ title: "Social Soon",    category: "social" });

    const result = await service.filterEvents({ category: "volunteer", timeframe: "upcoming" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.every(e => e.category === "volunteer")).toBe(true);
    }
  });

  it("returns InvalidCategoryError for unknown category", async () => {
    const result = await service.filterEvents({ category: "invalid-cat" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.value.name).toBe("InvalidCategoryError");
  });

  it("returns InvalidTimeframeError for unknown timeframe", async () => {
    const result = await service.filterEvents({ timeframe: "next_month" as any });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.value.name).toBe("InvalidTimeframeError");
  });
});