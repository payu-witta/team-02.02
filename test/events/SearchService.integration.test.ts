import { createComposedApp } from "../../src/composition";
import { CreateEventService } from "../../src/events/EventService";
import { CreatePrismaEventRepository } from "../../src/events/PrismaEventRepository";
import { getPrismaClient } from "../../src/lib/prisma";
import { cleanDatabase } from "../helpers/cleanDatabase";
import { loginAs } from "../helpers/authSession";

const app = createComposedApp().getExpressApp();

beforeEach(async () => { await cleanDatabase(); });

const repo = CreatePrismaEventRepository(getPrismaClient());
const rsvpRepo = { countGoingByEventId: async () => ({ ok: true as const, value: 0 }) };
const service = CreateEventService(repo, rsvpRepo as any);

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

describe("Feature 10 — searchEvents (Prisma)", () => {
  it("empty query returns all published upcoming events", async () => {
    await seedPublishedEvent({ title: "Alpha Event" });
    await seedPublishedEvent({ title: "Beta Event" });

    const result = await service.searchEvents({ query: "" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.length).toBeGreaterThanOrEqual(2);
  });

  it("whitespace-only query returns all published upcoming events", async () => {
    await seedPublishedEvent({ title: "Alpha Event" });

    const result = await service.searchEvents({ query: "   " });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.length).toBeGreaterThanOrEqual(1);
  });

  it("matches title case-insensitively", async () => {
    await seedPublishedEvent({ title: "Park Cleanup Day" });
    await seedPublishedEvent({ title: "Indoor Workshop" });

    const result = await service.searchEvents({ query: "PARK" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.some(e => e.title === "Park Cleanup Day")).toBe(true);
      expect(result.value.some(e => e.title === "Indoor Workshop")).toBe(false);
    }
  });

  it("matches description", async () => {
    await seedPublishedEvent({
      title: "Community Day",
      description: "Join us at the riverside for a great time.",
    });
    await seedPublishedEvent({ title: "Other Event" });

    const result = await service.searchEvents({ query: "riverside" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.some(e => e.title === "Community Day")).toBe(true);
      expect(result.value.some(e => e.title === "Other Event")).toBe(false);
    }
  });

  it("matches location", async () => {
    await seedPublishedEvent({ title: "Meetup", location: "Riverside Park" });
    await seedPublishedEvent({ title: "Workshop", location: "Downtown Hall" });

    const result = await service.searchEvents({ query: "riverside" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.some(e => e.title === "Meetup")).toBe(true);
      expect(result.value.some(e => e.title === "Workshop")).toBe(false);
    }
  });

  it("returns empty array when nothing matches", async () => {
    await seedPublishedEvent({ title: "Real Event" });

    const result = await service.searchEvents({ query: "zzznomatch" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(0);
  });

  it("returns InvalidSearchError when query exceeds 200 characters", async () => {
    const result = await service.searchEvents({ query: "a".repeat(201) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.value.name).toBe("InvalidSearchError");
  });
});