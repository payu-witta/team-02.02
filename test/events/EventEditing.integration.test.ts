import { createComposedApp } from "../../src/composition";
import { loginAs } from "../helpers/authSession";
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
