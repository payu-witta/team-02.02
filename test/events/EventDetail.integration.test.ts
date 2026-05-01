import request from "supertest";
import { createComposedApp } from "../../src/composition";
import { cleanDatabase } from "../helpers/cleanDatabase";
import { loginAs } from "../helpers/authSession";
import { getPrismaClient } from "../../src/lib/prisma";

describe("Event Detail Integration", () => {
  const app = createComposedApp();
  const expressApp = app.getExpressApp();
  const prisma = getPrismaClient();

  beforeEach(async () => {
    await cleanDatabase();
  });

  it("returns 200 for a published event", async () => {
    const user = await loginAs(expressApp, "user");

    await prisma.event.create({
      data: {
        id: "published-event",
        title: "Published Event",
        description: "desc",
        location: "Campus",
        category: "social",
        status: "published",
        capacity: 10,
        startDatetime: new Date("2026-05-01T10:00:00.000Z"),
        endDatetime: new Date("2026-05-01T12:00:00.000Z"),
        organizerId: "staff-user",
      },
    });

    await user.get("/events/published-event").expect(200);
  });

  it("hides draft event from a regular user", async () => {
    const user = await loginAs(expressApp, "user");

    await prisma.event.create({
      data: {
        id: "draft-event",
        title: "Draft Event",
        description: "desc",
        location: "Campus",
        category: "social",
        status: "draft",
        capacity: 10,
        startDatetime: new Date("2026-05-01T10:00:00.000Z"),
        endDatetime: new Date("2026-05-01T12:00:00.000Z"),
        organizerId: "staff-user",
      },
    });

    const res = await user.get("/events/draft-event");
    expect(res.status).not.toBe(200);
  });

  it("allows staff to access their draft event", async () => {
    const staff = await loginAs(expressApp, "staff");

    await prisma.event.create({
      data: {
        id: "staff-draft-event",
        title: "Staff Draft Event",
        description: "desc",
        location: "Campus",
        category: "social",
        status: "draft",
        capacity: 10,
        startDatetime: new Date("2026-05-01T10:00:00.000Z"),
        endDatetime: new Date("2026-05-01T12:00:00.000Z"),
        organizerId: "user-staff"
      },
    });

    await staff.get("/events/staff-draft-event").expect(200);
  });
});