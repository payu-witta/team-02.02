import request from "supertest";
import { createComposedApp } from "../../src/composition";
import { loginAs } from "../helpers/authSession";
import { seedEvent } from "../helpers/seedEvent";

const app = createComposedApp().getExpressApp();

async function seedPublishedEvent(
  staffAgent: Awaited<ReturnType<typeof loginAs>>,
): Promise<string> {
  const eventId = await seedEvent(app, staffAgent);
  await staffAgent.post(`/events/${eventId}/publish`).expect(302);
  return eventId;
}

describe("Feature 4 — RSVP Toggle: happy path", () => {
  it("POST as member on a published event → 200 with going button fragment", async () => {
    const staff = await loginAs(app, "staff");
    const user = await loginAs(app, "user");
    const eventId = await seedPublishedEvent(staff);

    const res = await user
      .post(`/events/${eventId}/rsvp`)
      .set("HX-Request", "true");

    expect(res.status).toBe(200);
    expect(res.text).toContain(`id="rsvp-button-${eventId}"`);
    expect(res.text).toContain("Going");
    expect(res.text).toContain("Cancel RSVP");
  });

  it("second POST cancels the RSVP → 200 back to default RSVP button", async () => {
    const staff = await loginAs(app, "staff");
    const user = await loginAs(app, "user");
    const eventId = await seedPublishedEvent(staff);

    await user.post(`/events/${eventId}/rsvp`).set("HX-Request", "true");
    const res = await user
      .post(`/events/${eventId}/rsvp`)
      .set("HX-Request", "true");

    expect(res.status).toBe(200);
    expect(res.text).toContain(`id="rsvp-button-${eventId}"`);
    expect(res.text).not.toContain("Going");
    expect(res.text).not.toContain("Waitlisted");
  });
});

describe("Feature 4 — RSVP Toggle: error cases", () => {
  it("POST as admin → 403", async () => {
    const staff = await loginAs(app, "staff");
    const admin = await loginAs(app, "admin");
    const eventId = await seedPublishedEvent(staff);

    const res = await admin
      .post(`/events/${eventId}/rsvp`)
      .set("HX-Request", "true");

    expect(res.status).toBe(403);
  });

  it("POST as staff → 403", async () => {
    const staff = await loginAs(app, "staff");
    const eventId = await seedPublishedEvent(staff);

    const res = await staff
      .post(`/events/${eventId}/rsvp`)
      .set("HX-Request", "true");

    expect(res.status).toBe(403);
  });

  it("POST unauthenticated → 401", async () => {
    const staff = await loginAs(app, "staff");
    const eventId = await seedPublishedEvent(staff);

    const res = await request(app)
      .post(`/events/${eventId}/rsvp`)
      .set("HX-Request", "true");

    expect(res.status).toBe(401);
  });

  it("POST to a non-existent event → 404", async () => {
    const user = await loginAs(app, "user");

    const res = await user
      .post("/events/00000000-0000-0000-0000-000000000000/rsvp")
      .set("HX-Request", "true");

    expect(res.status).toBe(404);
  });

  it("POST to a cancelled event → 409", async () => {
    const staff = await loginAs(app, "staff");
    const user = await loginAs(app, "user");
    const eventId = await seedPublishedEvent(staff);

    await staff.post(`/events/${eventId}/cancel`).expect(302);

    const res = await user
      .post(`/events/${eventId}/rsvp`)
      .set("HX-Request", "true");

    expect(res.status).toBe(409);
  });
});

describe("Feature 4 — RSVP GET status: happy path", () => {
  it("GET with no existing RSVP → 200 with default RSVP button", async () => {
    const staff = await loginAs(app, "staff");
    const user = await loginAs(app, "user");
    const eventId = await seedPublishedEvent(staff);

    const res = await user.get(`/events/${eventId}/rsvp`);

    expect(res.status).toBe(200);
    expect(res.text).toContain(`id="rsvp-button-${eventId}"`);
    expect(res.text).not.toContain("Going");
    expect(res.text).not.toContain("Waitlisted");
  });

  it("GET after RSVPing → 200 with going button", async () => {
    const staff = await loginAs(app, "staff");
    const user = await loginAs(app, "user");
    const eventId = await seedPublishedEvent(staff);

    await user.post(`/events/${eventId}/rsvp`).set("HX-Request", "true");
    const res = await user.get(`/events/${eventId}/rsvp`);

    expect(res.status).toBe(200);
    expect(res.text).toContain("Going");
    expect(res.text).toContain("Cancel RSVP");
  });
});
