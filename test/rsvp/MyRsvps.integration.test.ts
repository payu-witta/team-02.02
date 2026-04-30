import request from "supertest";
import { createComposedApp } from "../../src/composition";

describe("My RSVPs Integration", () => {
    const app = createComposedApp();
    const expressApp = app.getExpressApp();

    it("redirects unauthenticated users to login", async () => {
    await request(expressApp)
        .get("/my-rsvps")
        .expect(302);
    });
});