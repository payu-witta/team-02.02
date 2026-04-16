import { createComposedApp } from "../../src/composition";
import { loginAs, createUserAndLogin } from "../helpers/authSession";
import { seedEvent, BASE_EVENT } from "../helpers/seedEvent";

const app = createComposedApp().getExpressApp();

describe("Feature 3 — Event Editing: happy path", () => {
  it("staff edits their own event → 302 redirect to the event page", async () => {
    const agent = await loginAs(app, "staff");
    const eventId = await seedEvent(app, agent);

    const res = await agent
      .post(`/events/${eventId}/edit`)
      .type("form")
      .send({ ...BASE_EVENT, title: "Updated Title" });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`/events/${eventId}`);
  });
});

describe("Feature 3 — Event Editing: not found", () => {
  it("editing a non-existent event ID → 404", async () => {
    const agent = await loginAs(app, "staff");

    const res = await agent
      .post("/events/00000000-0000-0000-0000-000000000000/edit")
      .type("form")
      .send(BASE_EVENT);

    expect(res.status).toBe(404);
  });
});

describe("Feature 3 — Event Editing: invalid state", () => {
  it("editing a cancelled event → 409", async () => {
    const agent = await loginAs(app, "staff");
    const eventId = await seedEvent(app, agent);

    await agent.post(`/events/${eventId}/cancel`).expect(302);

    const res = await agent
      .post(`/events/${eventId}/edit`)
      .type("form")
      .send({ ...BASE_EVENT, title: "Edit After Cancel" });

    expect(res.status).toBe(409);
  });
});

describe("Feature 3 — Event Editing: unauthorized", () => {
  it("member (user role) is rejected with 403", async () => {
    const staffAgent = await loginAs(app, "staff");
    const eventId = await seedEvent(app, staffAgent);

    const userAgent = await loginAs(app, "user");
    const res = await userAgent
      .post(`/events/${eventId}/edit`)
      .type("form")
      .send({ ...BASE_EVENT, title: "Hacked Title" });

    expect(res.status).toBe(403);
  });

  it("staff editing another organizer's event → 403", async () => {
    const ownerAgent = await loginAs(app, "staff");
    const eventId = await seedEvent(app, ownerAgent);

    const adminAgent = await loginAs(app, "admin");
    const otherStaff = await createUserAndLogin(app, adminAgent, {
      email: "other-staff@app.test",
      displayName: "Other Staff",
      password: "password123",
      role: "staff",
    });

    const res = await otherStaff
      .post(`/events/${eventId}/edit`)
      .type("form")
      .send({ ...BASE_EVENT, title: "Stolen Edit" });

    expect(res.status).toBe(403);
  });
});
