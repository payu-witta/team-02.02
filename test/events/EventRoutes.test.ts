import request from "supertest";
import { createComposedApp } from "../../src/composition";
import { cleanDatabase } from "../helpers/cleanDatabase";

describe("Event Routing Sprint 2", () => {
  let app: any;
  // Initialize with empty arrays to prevent the "undefined" header error
  let adminCookie: string[] = [];
  let memberCookie: string[] = [];
  let testEventId: string;

  beforeAll(async () => {
    await cleanDatabase();
    app = createComposedApp().getExpressApp();

    // 1. Log in Admin
    const adminLogin = await request(app)
      .post("/login")
      .send({ email: "admin@app.test", password: "password123" });
    adminCookie = adminLogin.get("Set-Cookie") ?? [];

    // 2. Log in Member
    const memberLogin = await request(app)
      .post("/login")
      .send({ email: "user@app.test", password: "password123" });
    memberCookie = memberLogin.get("Set-Cookie") ?? [];

    // ─── NEW: Seed a Draft Event ───
    // We create a real event so 'test-draft-123' (or its real ID) exists.
    const createRes = await request(app)
      .post("/events")
      .set("Cookie", adminCookie)
      .send({
        title: "Test Draft Event",
        description: "Testing HTMX",
        location: "Test Lab",
        category: "Tech",
        startDatetime: "2026-05-01T10:00",
        endDatetime: "2026-05-01T12:00"
      });
    
    // Capture the real ID created by the service
    // (Assuming your redirect is to /events/:id)
    const locationHeader = createRes.get("Location");
    testEventId = locationHeader?.split("/").pop() ?? "failed-to-get-id";
  });

  it("GET /dashboard should return 403 for members", async () => {
    const response = await request(app)
      .get("/dashboard")
      .set("Cookie", memberCookie); // Now using a real signed cookie

    expect(response.status).toBe(403);
  });

});