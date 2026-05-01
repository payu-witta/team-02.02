import { createComposedApp } from "../../src/composition";
import { cleanDatabase } from "../helpers/cleanDatabase";
import { loginAs } from "../helpers/authSession";
import { getPrismaClient } from "../../src/lib/prisma";

describe("My RSVPs Integration", () => {
  const app = createComposedApp();
  const expressApp = app.getExpressApp();
  const prisma = getPrismaClient();

  beforeEach(async () => {
    await cleanDatabase();
  });

  it("returns 200 for an authenticated user", async () => {
    const user = await loginAs(expressApp, "user");

    await user.get("/my-rsvps").expect(200);
  });

  it("returns 403 for staff", async () => {
    const staff = await loginAs(expressApp, "staff");

    await staff.get("/my-rsvps").expect(403);
  });

  it("shows only the current user's RSVPs", async () => {
    const user = await loginAs(expressApp, "user");
    const userId = "user-reader";

    await prisma.event.createMany({
      data: [
        {
          id: "my-event",
          title: "My RSVP Event",
          description: "desc",
          location: "Campus",
          category: "social",
          status: "published",
          capacity: 10,
          startDatetime: new Date("2026-05-01T10:00:00.000Z"),
          endDatetime: new Date("2026-05-01T12:00:00.000Z"),
          organizerId: "user-staff",
        },
        {
          id: "other-event",
          title: "Other User Event",
          description: "desc",
          location: "Campus",
          category: "social",
          status: "published",
          capacity: 10,
          startDatetime: new Date("2026-05-02T10:00:00.000Z"),
          endDatetime: new Date("2026-05-02T12:00:00.000Z"),
          organizerId: "user-staff",
        },
      ],
    });

    await prisma.rsvp.createMany({
      data: [
        {
          eventId: "my-event",
          userId,
          status: "going",
        },
        {
          eventId: "other-event",
          userId: "someone-else",
          status: "going",
        },
      ],
    });

    const res = await user.get("/my-rsvps").expect(200);

    expect(res.text).toContain("My RSVP Event");
    expect(res.text).not.toContain("Other User Event");
  });

  it("shows going RSVP in upcoming and cancelled RSVP in history", async () => {
    const user = await loginAs(expressApp, "user");
    const userId = "user-reader";

    await prisma.event.createMany({
      data: [
        {
          id: "going-event",
          title: "Going Event",
          description: "desc",
          location: "Campus",
          category: "social",
          status: "published",
          capacity: 10,
          startDatetime: new Date("2026-05-01T10:00:00.000Z"),
          endDatetime: new Date("2026-05-01T12:00:00.000Z"),
          organizerId: "user-staff",
        },
        {
          id: "cancelled-event",
          title: "Cancelled Event",
          description: "desc",
          location: "Campus",
          category: "social",
          status: "published",
          capacity: 10,
          startDatetime: new Date("2026-04-01T10:00:00.000Z"),
          endDatetime: new Date("2026-04-01T12:00:00.000Z"),
          organizerId: "user-staff",
        },
      ],
    });

    await prisma.rsvp.createMany({
      data: [
        {
          eventId: "going-event",
          userId,
          status: "going",
        },
        {
          eventId: "cancelled-event",
          userId,
          status: "cancelled",
        },
      ],
    });

    const res = await user.get("/my-rsvps").expect(200);

    expect(res.text).toContain("Going Event");
    expect(res.text).toContain("Cancelled Event");
  });
});