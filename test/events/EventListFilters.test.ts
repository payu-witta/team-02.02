import { InMemoryEventRepository } from "../../src/events/InMemoryEventRepository";
import { EventService } from "../../src/events/EventService";
import type { Event } from "../../src/events/types";

function makeEvent(
  partial: Partial<Event> &
    Pick<Event, "id" | "title" | "description" | "location" | "category" | "status" | "startDatetime" | "endDatetime" | "organizerId">,
): Event {
  const now = new Date("2026-04-01T00:00:00.000Z");
  return {
    createdAt: now,
    updatedAt: now,
    capacity: undefined,
    ...partial,
  };
}

describe("Feature 6 — category and timeframe filters", () => {
  test("listPublishedUpcoming returns only published upcoming when no filters", async () => {
    const now = new Date("2026-04-14T12:00:00.000Z");
    const events: Event[] = [
      makeEvent({
        id: "1",
        title: "Upcoming published",
        description: "",
        location: "A",
        category: "social",
        status: "published",
        startDatetime: new Date("2026-04-15T12:00:00.000Z"),
        endDatetime: new Date("2026-04-15T13:00:00.000Z"),
        organizerId: "org",
      }),
      makeEvent({
        id: "2",
        title: "Draft",
        description: "",
        location: "B",
        category: "social",
        status: "draft",
        startDatetime: new Date("2026-04-16T12:00:00.000Z"),
        endDatetime: new Date("2026-04-16T13:00:00.000Z"),
        organizerId: "org",
      }),
      makeEvent({
        id: "3",
        title: "Past published",
        description: "",
        location: "C",
        category: "social",
        status: "published",
        startDatetime: new Date("2026-04-01T12:00:00.000Z"),
        endDatetime: new Date("2026-04-01T13:00:00.000Z"),
        organizerId: "org",
      }),
    ];

    const repo = new InMemoryEventRepository(events, () => now);
    const service = new EventService(repo);
    const res = await service.listPublishedUpcoming();
    expect(res.ok).toBe(true);
    expect(res.value.map((e) => e.id)).toEqual(["1"]);
  });

  test("category filter narrows results", async () => {
    const now = new Date("2026-04-14T12:00:00.000Z");
    const repo = new InMemoryEventRepository(
      [
        makeEvent({
          id: "1",
          title: "Volunteer cleanup",
          description: "Help out",
          location: "Park",
          category: "volunteer",
          status: "published",
          startDatetime: new Date("2026-04-15T12:00:00.000Z"),
          endDatetime: new Date("2026-04-15T13:00:00.000Z"),
          organizerId: "org",
        }),
        makeEvent({
          id: "2",
          title: "Fun run",
          description: "5k",
          location: "Track",
          category: "sports",
          status: "published",
          startDatetime: new Date("2026-04-15T14:00:00.000Z"),
          endDatetime: new Date("2026-04-15T15:00:00.000Z"),
          organizerId: "org",
        }),
      ],
      () => now,
    );

    const service = new EventService(repo);
    const res = await service.listPublishedUpcoming({ category: "sports" });
    expect(res.ok).toBe(true);
    expect(res.value.map((e) => e.id)).toEqual(["2"]);
  });

  test("timeframe=this_weekend includes only upcoming events in the weekend window", async () => {
    const now = new Date("2026-04-14T12:00:00.000Z");
    const repo = new InMemoryEventRepository(
      [
        makeEvent({
          id: "fri",
          title: "Friday thing",
          description: "",
          location: "X",
          category: "social",
          status: "published",
          startDatetime: new Date("2026-04-17T20:00:00.000Z"),
          endDatetime: new Date("2026-04-17T21:00:00.000Z"),
          organizerId: "org",
        }),
        makeEvent({
          id: "sat",
          title: "Saturday thing",
          description: "",
          location: "X",
          category: "social",
          status: "published",
          startDatetime: new Date("2026-04-18T10:00:00.000Z"),
          endDatetime: new Date("2026-04-18T11:00:00.000Z"),
          organizerId: "org",
        }),
        makeEvent({
          id: "sun",
          title: "Sunday thing",
          description: "",
          location: "X",
          category: "social",
          status: "published",
          startDatetime: new Date("2026-04-19T10:00:00.000Z"),
          endDatetime: new Date("2026-04-19T11:00:00.000Z"),
          organizerId: "org",
        }),
      ],
      () => now,
    );

    const service = new EventService(repo);
    const res = await service.listPublishedUpcoming({ timeframe: "this_weekend" });
    expect(res.ok).toBe(true);
    expect(res.value.map((e) => e.id)).toEqual(["sat", "sun"]);
  });
});
