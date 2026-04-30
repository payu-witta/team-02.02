import request from "supertest";
import { createComposedApp } from "../../src/composition";

describe("Event Detail Integration", () => {
  const app = createComposedApp();
  const expressApp = app.getExpressApp();

  it("returns 302 for a missing event", async () => {
    await request(expressApp)
      .get("/events/not-real")
      .expect(302);
  });
});