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
