import request from "supertest";
import { createComposedApp } from "../../src/composition";
import { loginAs } from "../helpers/authSession";
import { cleanDatabase } from "../helpers/cleanDatabase";

const app = createComposedApp().getExpressApp();

beforeEach(async () => { await cleanDatabase(); });

const base = {
  title: "Test Event",
  description: "A test event description.",
  location: "Test Hall",
  category: "social",
  startDatetime: new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 16),
  endDatetime:   new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 16),
};

async function seedPublishedEvent(overrides: Record<string, string> = {}) {
  const agent = await loginAs(app, "staff");
  const createRes = await agent
    .post("/events")
    .type("form")
    .send({ ...base, ...overrides })
    .expect(302);
  const eventId = (createRes.headers.location as string).replace("/events/", "");
  await agent.post(`/events/${eventId}/publish`).expect(302);
  return eventId;
}

describe("Feature 6 — category filter", () => {
  it("GET /events?category=social returns only social events", async () => {
    const agent = await loginAs(app, "staff");
    await seedPublishedEvent({ title: "Social Event",  category: "social" });
    await seedPublishedEvent({ title: "Volunteer Day", category: "volunteer" });

    const res = await agent.get("/events?category=social");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Social Event");
    expect(res.text).not.toContain("Volunteer Day");
  });

  it("GET /events?category=volunteer returns only volunteer events", async () => {
    const agent = await loginAs(app, "staff");
    await seedPublishedEvent({ title: "Volunteer Day", category: "volunteer" });
    await seedPublishedEvent({ title: "Social Night",  category: "social" });

    const res = await agent.get("/events?category=volunteer");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Volunteer Day");
    expect(res.text).not.toContain("Social Night");
  });

  it("GET /events with no filters returns all published upcoming events", async () => {
    const agent = await loginAs(app, "staff");
    await seedPublishedEvent({ title: "Social Event",  category: "social" });
    await seedPublishedEvent({ title: "Volunteer Day", category: "volunteer" });

    const res = await agent.get("/events");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Social Event");
    expect(res.text).toContain("Volunteer Day");
  });
});

describe("Feature 6 — timeframe filter", () => {
  it("GET /events?timeframe=upcoming returns future events", async () => {
    const agent = await loginAs(app, "staff");
    await seedPublishedEvent({ title: "Near Event" });

    const res = await agent.get("/events?timeframe=upcoming");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Near Event");
  });

  it("GET /events?timeframe=this_week returns events within 7 days", async () => {
    const agent = await loginAs(app, "staff");
    await seedPublishedEvent({
      title: "This Week Event",
      startDatetime: new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 16),
      endDatetime:   new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 16),
    });
    await seedPublishedEvent({
      title: "Far Future Event",
      startDatetime: new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 16),
      endDatetime:   new Date(Date.now() + 11 * 86_400_000).toISOString().slice(0, 16),
    });

    const res = await agent.get("/events?timeframe=this_week");
    expect(res.status).toBe(200);
    expect(res.text).toContain("This Week Event");
    expect(res.text).not.toContain("Far Future Event");
  });

  it("GET /events?category=volunteer&timeframe=upcoming returns combined filter", async () => {
    const agent = await loginAs(app, "staff");
    await seedPublishedEvent({ title: "Volunteer Soon", category: "volunteer" });
    await seedPublishedEvent({ title: "Social Soon",    category: "social" });

    const res = await agent.get("/events?category=volunteer&timeframe=upcoming");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Volunteer Soon");
    expect(res.text).not.toContain("Social Soon");
  });
});

describe("Feature 6 — unauthenticated access", () => {
  it("GET /events without login → 302 redirect to /login", async () => {
    const res = await request(app).get("/events");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/login");
  });
});