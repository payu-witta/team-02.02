import request from "supertest";
import { createComposedApp } from "../../src/composition";
import { loginAs } from "../helpers/authSession";

const app = createComposedApp().getExpressApp();

const validBody = {
  title: "Test Event",
  description: "A valid description for the test event.",
  location: "Room 101",
  category: "social",
  startDatetime: new Date(Date.now() + 86_400_000).toISOString().slice(0, 16),
  endDatetime: new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 16),
};

describe("Feature 1 — Event Creation: happy path", () => {
  it("staff submits valid form → 302 redirect to the new event page", async () => {
    const agent = await loginAs(app, "staff");

    const res = await agent.post("/events").type("form").send(validBody);

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/^\/events\/[a-f0-9-]+$/);
  });
});

describe("Feature 1 — Event Creation: unauthorized access", () => {
  it("member (user role) is rejected with 403", async () => {
    const agent = await loginAs(app, "user");

    const res = await agent.post("/events").type("form").send(validBody);

    expect(res.status).toBe(403);
  });

  it("unauthenticated POST is rejected with 401", async () => {
    const res = await request(app).post("/events").type("form").send(validBody);

    expect(res.status).toBe(401);
  });
});
