import request from "supertest";
import { createComposedApp } from "../../src/composition";
import { loginAs, createUserAndLogin } from "../helpers/authSession";
import { seedEvent, BASE_EVENT } from "../helpers/seedEvent";

const app = createComposedApp().getExpressApp();

async function seedPublishedEvent(
  staffAgent: Awaited<ReturnType<typeof loginAs>>,
): Promise<string> {
  const eventId = await seedEvent(app, staffAgent);
  await staffAgent.post(`/events/${eventId}/publish`).expect(302);
  return eventId;
}

async function seedPublishedEventWithCapacity(
  staffAgent: Awaited<ReturnType<typeof loginAs>>,
  capacity: number,
): Promise<string> {
  const res = await staffAgent
    .post("/events")
    .type("form")
    .send({ ...BASE_EVENT, capacity: String(capacity) })
    .expect(302);
  const eventId = (res.headers.location as string).replace("/events/", "");
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

describe("Feature 4 — RSVP Toggle: capacity enforcement and reactivation", () => {
  it("second member is waitlisted when event is full", async () => {
    const admin = await loginAs(app, "admin");
    const staff = await loginAs(app, "staff");
    const userA = await loginAs(app, "user");
    const userB = await createUserAndLogin(app, admin, {
      email: "userb@cap.test",
      displayName: "User B",
      password: "password123",
      role: "user",
    });
    const eventId = await seedPublishedEventWithCapacity(staff, 1);

    const resA = await userA.post(`/events/${eventId}/rsvp`).set("HX-Request", "true");
    expect(resA.status).toBe(200);
    expect(resA.text).toContain("Going");

    const resB = await userB.post(`/events/${eventId}/rsvp`).set("HX-Request", "true");
    expect(resB.status).toBe(200);
    expect(resB.text).toContain("Waitlisted");
  });

  it("cancelling going RSVP promotes the waitlisted member", async () => {
    const admin = await loginAs(app, "admin");
    const staff = await loginAs(app, "staff");
    const userA = await loginAs(app, "user");
    const userB = await createUserAndLogin(app, admin, {
      email: "userb@promote.test",
      displayName: "User B",
      password: "password123",
      role: "user",
    });
    const eventId = await seedPublishedEventWithCapacity(staff, 1);

    await userA.post(`/events/${eventId}/rsvp`).set("HX-Request", "true");
    await userB.post(`/events/${eventId}/rsvp`).set("HX-Request", "true");

    await userA.post(`/events/${eventId}/rsvp`).set("HX-Request", "true");

    const resB = await userB.get(`/events/${eventId}/rsvp`);
    expect(resB.status).toBe(200);
    expect(resB.text).toContain("Going");
    expect(resB.text).not.toContain("Waitlisted");
  });

  it("reactivating a cancelled RSVP on a full event lands on waitlist", async () => {
    const admin = await loginAs(app, "admin");
    const staff = await loginAs(app, "staff");
    const userA = await loginAs(app, "user");
    const userB = await createUserAndLogin(app, admin, {
      email: "userb@reactivate.test",
      displayName: "User B",
      password: "password123",
      role: "user",
    });
    const eventId = await seedPublishedEventWithCapacity(staff, 1);

    await userA.post(`/events/${eventId}/rsvp`).set("HX-Request", "true");
    await userB.post(`/events/${eventId}/rsvp`).set("HX-Request", "true");
    await userA.post(`/events/${eventId}/rsvp`).set("HX-Request", "true");

    const resA = await userA.post(`/events/${eventId}/rsvp`).set("HX-Request", "true");
    expect(resA.status).toBe(200);
    expect(resA.text).toContain("Waitlisted");
  });

  it("no capacity limit → all members RSVP as going", async () => {
    const admin = await loginAs(app, "admin");
    const staff = await loginAs(app, "staff");
    const userA = await loginAs(app, "user");
    const userB = await createUserAndLogin(app, admin, {
      email: "userb@nolimit.test",
      displayName: "User B",
      password: "password123",
      role: "user",
    });
    const eventId = await seedPublishedEvent(staff);

    const resA = await userA.post(`/events/${eventId}/rsvp`).set("HX-Request", "true");
    const resB = await userB.post(`/events/${eventId}/rsvp`).set("HX-Request", "true");

    expect(resA.text).toContain("Going");
    expect(resB.text).toContain("Going");
  });
});

describe("Feature 9 — Waitlist promotion and queue positions", () => {
  it("first waitlisted member shows position #1 in button fragment", async () => {
    const admin = await loginAs(app, "admin");
    const staff = await loginAs(app, "staff");
    const userA = await loginAs(app, "user");
    const userB = await createUserAndLogin(app, admin, {
      email: "userb@pos1.test",
      displayName: "User B",
      password: "password123",
      role: "user",
    });
    const eventId = await seedPublishedEventWithCapacity(staff, 1);

    await userA.post(`/events/${eventId}/rsvp`).set("HX-Request", "true");
    const resB = await userB.post(`/events/${eventId}/rsvp`).set("HX-Request", "true");

    expect(resB.text).toContain("Waitlisted");
    expect(resB.text).toContain("#1");
  });

  it("queue shifts after promotion: #2 becomes #1", async () => {
    const admin = await loginAs(app, "admin");
    const staff = await loginAs(app, "staff");
    const userA = await loginAs(app, "user");
    const userB = await createUserAndLogin(app, admin, {
      email: "userb@shift.test",
      displayName: "User B",
      password: "password123",
      role: "user",
    });
    const userC = await createUserAndLogin(app, admin, {
      email: "userc@shift.test",
      displayName: "User C",
      password: "password123",
      role: "user",
    });
    const eventId = await seedPublishedEventWithCapacity(staff, 1);

    await userA.post(`/events/${eventId}/rsvp`).set("HX-Request", "true");
    await userB.post(`/events/${eventId}/rsvp`).set("HX-Request", "true");
    await userC.post(`/events/${eventId}/rsvp`).set("HX-Request", "true");

    await userA.post(`/events/${eventId}/rsvp`).set("HX-Request", "true");

    const resB = await userB.get(`/events/${eventId}/rsvp`);
    expect(resB.text).toContain("Going");

    const resC = await userC.get(`/events/${eventId}/rsvp`);
    expect(resC.text).toContain("Waitlisted");
    expect(resC.text).toContain("#1");
  });

  it("cancelling a waitlisted RSVP does not promote anyone", async () => {
    const admin = await loginAs(app, "admin");
    const staff = await loginAs(app, "staff");
    const userA = await loginAs(app, "user");
    const userB = await createUserAndLogin(app, admin, {
      email: "userb@nowait.test",
      displayName: "User B",
      password: "password123",
      role: "user",
    });
    const eventId = await seedPublishedEventWithCapacity(staff, 1);

    await userA.post(`/events/${eventId}/rsvp`).set("HX-Request", "true");
    await userB.post(`/events/${eventId}/rsvp`).set("HX-Request", "true");

    await userB.post(`/events/${eventId}/rsvp`).set("HX-Request", "true");

    const resA = await userA.get(`/events/${eventId}/rsvp`);
    expect(resA.text).toContain("Going");
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
