import { Ok } from "../../src/lib/result";
import type { IEventRepository } from "../../src/events/InEventRepository";
import { CreateInMemoryRsvpRepository } from "../../src/rsvp/InMemoryRsvpRepository";
import type { IRsvpRepository, Rsvp, UpsertRsvpData } from "../../src/rsvp/InRsvpRepository";
import { CreateRsvpService } from "../../src/rsvp/RsvpService";
import type { ILoggingService } from "../../src/service/LoggingService";
import { CreateMyRsvpsService } from "../../src/rsvp/MyRsvpsService";


function createLoggerMock(): ILoggingService {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

function createEventRepoMock(capacity = 1): IEventRepository {
  return {
    findById: jest.fn().mockResolvedValue(
      Ok({
        id: "event-1",
        title: "Test Event",
        description: "desc",
        location: "loc",
        category: "social",
        status: "published",
        capacity,
        startDatetime: new Date("2026-04-20T10:00:00.000Z"),
        endDatetime: new Date("2026-04-20T12:00:00.000Z"),
        organizerId: "org-1",
        createdAt: new Date("2026-04-01T10:00:00.000Z"),
        updatedAt: new Date("2026-04-01T10:00:00.000Z"),
      }),
    ),
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
}

class ThrowingPromotionRsvpRepository implements IRsvpRepository {
  private readonly byKey = new Map<string, Rsvp>();
  private seq = 1;

  constructor(seed: Array<Omit<Rsvp, "id">>) {
    for (const item of seed) {
      const id = `r-${this.seq++}`;
      this.byKey.set(this.key(item.eventId, item.userId), { ...item, id });
    }
  }

  async findByEventId(eventId: string) {
    const rows = [...this.byKey.values()]
      .filter((r) => r.eventId === eventId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return Ok(rows.map((r) => ({ ...r })));
  }

  async findByUserId(userId: string) {
    const rows = [...this.byKey.values()]
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return Ok(rows.map((r) => ({ ...r })));
  }

  async findByEventAndUser(eventId: string, userId: string) {
    return Ok(this.byKey.get(this.key(eventId, userId)) ?? null);
  }

  async countGoingByEventId(eventId: string) {
    const count = [...this.byKey.values()].filter(
      (r) => r.eventId === eventId && r.status === "going",
    ).length;
    return Ok(count);
  }

  async upsert(data: UpsertRsvpData) {
    if (data.userId === "waitlisted-1" && data.status === "going") {
      throw new Error("promotion exploded");
    }

    const mapKey = this.key(data.eventId, data.userId);
    const existing = this.byKey.get(mapKey);
    if (existing) {
      existing.status = data.status;
      return Ok({ ...existing });
    }

    const created: Rsvp = {
      id: `r-${this.seq++}`,
      eventId: data.eventId,
      userId: data.userId,
      status: data.status,
      createdAt: new Date(),
    };
    this.byKey.set(mapKey, created);
    return Ok({ ...created });
  }

  private key(eventId: string, userId: string): string {
    return `${eventId}:${userId}`;
  }
}

describe("RsvpService waitlist promotion behavior", () => {
  it("promotes the earliest waitlisted user when a going RSVP is cancelled", async () => {
    const rsvpRepo = CreateInMemoryRsvpRepository();
    const service = CreateRsvpService(rsvpRepo, createEventRepoMock(1), createLoggerMock());

    await service.toggleRsvp({ eventId: "event-1", userId: "going-1", userRole: "user" });
    await service.toggleRsvp({ eventId: "event-1", userId: "waitlisted-1", userRole: "user" });
    await service.toggleRsvp({ eventId: "event-1", userId: "waitlisted-2", userRole: "user" });

    const beforeOne = await service.getWaitlistPosition("event-1", "waitlisted-1");
    const beforeTwo = await service.getWaitlistPosition("event-1", "waitlisted-2");
    expect(beforeOne.ok && beforeOne.value).toBe(1);
    expect(beforeTwo.ok && beforeTwo.value).toBe(2);

    const cancel = await service.toggleRsvp({
      eventId: "event-1",
      userId: "going-1",
      userRole: "user",
    });

    expect(cancel.ok).toBe(true);
    expect(cancel.ok && cancel.value.status).toBe("cancelled");

    const promoted = await service.getRsvpForUser("event-1", "waitlisted-1");
    const stillWaiting = await service.getRsvpForUser("event-1", "waitlisted-2");
    expect(promoted.ok && promoted.value?.status).toBe("going");
    expect(stillWaiting.ok && stillWaiting.value?.status).toBe("waitlisted");
  });

  it("does not trigger promotion when a waitlisted RSVP is cancelled", async () => {
    const rsvpRepo = CreateInMemoryRsvpRepository();
    const service = CreateRsvpService(rsvpRepo, createEventRepoMock(1), createLoggerMock());

    await service.toggleRsvp({ eventId: "event-1", userId: "going-1", userRole: "user" });
    await service.toggleRsvp({ eventId: "event-1", userId: "waitlisted-1", userRole: "user" });
    await service.toggleRsvp({ eventId: "event-1", userId: "waitlisted-2", userRole: "user" });

    const cancelWaitlisted = await service.toggleRsvp({
      eventId: "event-1",
      userId: "waitlisted-1",
      userRole: "user",
    });
    expect(cancelWaitlisted.ok).toBe(true);
    expect(cancelWaitlisted.ok && cancelWaitlisted.value.status).toBe("cancelled");

    const goingCount = await rsvpRepo.countGoingByEventId("event-1");
    const remainingWaitlisted = await service.getRsvpForUser("event-1", "waitlisted-2");
    const remainingPosition = await service.getWaitlistPosition("event-1", "waitlisted-2");

    expect(goingCount.value).toBe(1);
    expect(remainingWaitlisted.ok && remainingWaitlisted.value?.status).toBe("waitlisted");
    expect(remainingPosition.ok && remainingPosition.value).toBe(1);
  });

  it("does not promote anyone when no waitlisted users exist", async () => {
    const rsvpRepo = CreateInMemoryRsvpRepository();
    const service = CreateRsvpService(rsvpRepo, createEventRepoMock(2), createLoggerMock());

    await service.toggleRsvp({ eventId: "event-1", userId: "going-1", userRole: "user" });

    const cancel = await service.toggleRsvp({
      eventId: "event-1",
      userId: "going-1",
      userRole: "user",
    });
    expect(cancel.ok).toBe(true);
    expect(cancel.ok && cancel.value.status).toBe("cancelled");

    const allRsvps = await rsvpRepo.findByEventId("event-1");
    const going = allRsvps.value.filter((r) => r.status === "going");
    expect(going).toHaveLength(0);
  });

  it("keeps waitlist positions accurate before and after sequential promotions", async () => {
    const rsvpRepo = CreateInMemoryRsvpRepository();
    const service = CreateRsvpService(rsvpRepo, createEventRepoMock(1), createLoggerMock());

    await service.toggleRsvp({ eventId: "event-1", userId: "going-1", userRole: "user" });
    await service.toggleRsvp({ eventId: "event-1", userId: "waitlisted-1", userRole: "user" });
    await service.toggleRsvp({ eventId: "event-1", userId: "waitlisted-2", userRole: "user" });
    await service.toggleRsvp({ eventId: "event-1", userId: "waitlisted-3", userRole: "user" });

    const p1 = await service.getWaitlistPosition("event-1", "waitlisted-1");
    const p2 = await service.getWaitlistPosition("event-1", "waitlisted-2");
    const p3 = await service.getWaitlistPosition("event-1", "waitlisted-3");
    expect(p1.ok && p1.value).toBe(1);
    expect(p2.ok && p2.value).toBe(2);
    expect(p3.ok && p3.value).toBe(3);

    await service.toggleRsvp({ eventId: "event-1", userId: "going-1", userRole: "user" });
    const afterFirstPromotion = await service.getWaitlistPosition("event-1", "waitlisted-2");
    const afterFirstPromotionTail = await service.getWaitlistPosition("event-1", "waitlisted-3");
    expect(afterFirstPromotion.ok && afterFirstPromotion.value).toBe(1);
    expect(afterFirstPromotionTail.ok && afterFirstPromotionTail.value).toBe(2);

    await service.toggleRsvp({ eventId: "event-1", userId: "waitlisted-1", userRole: "user" });
    const afterSecondPromotion = await service.getWaitlistPosition("event-1", "waitlisted-3");
    expect(afterSecondPromotion.ok && afterSecondPromotion.value).toBe(1);
  });

  it("surfaces a promotion error and restores original RSVP state", async () => {
    const rsvpRepo = new ThrowingPromotionRsvpRepository([
      {
        eventId: "event-1",
        userId: "going-1",
        status: "going",
        createdAt: new Date("2026-04-01T10:00:00.000Z"),
      },
      {
        eventId: "event-1",
        userId: "waitlisted-1",
        status: "waitlisted",
        createdAt: new Date("2026-04-01T11:00:00.000Z"),
      },
    ]);
    const service = CreateRsvpService(rsvpRepo, createEventRepoMock(1), createLoggerMock());

    const result = await service.toggleRsvp({
      eventId: "event-1",
      userId: "going-1",
      userRole: "user",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.value.name).toBe("PromotionFailedError");
    }

    const originalGoing = await rsvpRepo.findByEventAndUser("event-1", "going-1");
    const stillWaitlisted = await rsvpRepo.findByEventAndUser("event-1", "waitlisted-1");
    expect(originalGoing.value?.status).toBe("going");
    expect(stillWaitlisted.value?.status).toBe("waitlisted");
  });
});

describe("MyRsvpsService", () =>{
  it("groups going into upcoming", async () =>{
    const mockRsvpRepo = {
      findByUserId: jest.fn().mockResolvedValue(
        Ok([
          {
            id: "r-1",
            eventId: "event-1",
            userId: "user-1",
            status: "going",
            createdAt: new Date(),
          },
        ])
      ),
    } as any;

    const mockEventRepo = {
      findById: jest.fn()
        .mockResolvedValueOnce(
          Ok({
            id: "event-1",
            title: "going event",
            description: "",
            location: "",
            category: "social",
            status: "published",
            capacity: 10,
            startDatetime: new Date(),
            endDatetime: new Date(),
            organizerId: "org-1",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        ),
    } as any;

    const service = CreateMyRsvpsService(mockRsvpRepo, mockEventRepo);

    const result = await service.getMyRsvps({
      userId: "user-1",
      userRole: "user",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.upcoming).toHaveLength(1);
      expect(result.value.history).toHaveLength(0);
    }
  })
      it("groups waitlisted into upcoming", async() =>{
        const mockRsvpRepo = {
      findByUserId: jest.fn().mockResolvedValue(
        Ok([
          {
            id: "r-1",
            eventId: "event-1",
            userId: "user-1",
            status: "waitlisted",
            createdAt: new Date(),
          },
        ])
      ),
    } as any;

    const mockEventRepo = {
      findById: jest.fn()
        .mockResolvedValueOnce(
          Ok({
            id: "event-1",
            title: "waitlisted vent",
            description: "",
            location: "",
            category: "social",
            status: "published",
            capacity: 10,
            startDatetime: new Date(),
            endDatetime: new Date(),
            organizerId: "org-1",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        ),
    } as any;

    const service = CreateMyRsvpsService(mockRsvpRepo, mockEventRepo);

    const result = await service.getMyRsvps({
      userId: "user-1",
      userRole: "user",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.upcoming).toHaveLength(1);
      expect(result.value.history).toHaveLength(0);
    }
  })
      it("groups cancelled into history", async() =>{
        const mockRsvpRepo = {
      findByUserId: jest.fn().mockResolvedValue(
        Ok([
          {
            id: "r-1",
            eventId: "event-1",
            userId: "user-1",
            status: "cancelled",
            createdAt: new Date(),
          },
        ])
      ),
    } as any;

    const mockEventRepo = {
      findById: jest.fn()
        .mockResolvedValueOnce(
          Ok({
            id: "event-1",
            title: "cancelled event",
            description: "",
            location: "",
            category: "social",
            status: "cancelled",
            capacity: 10,
            startDatetime: new Date(),
            endDatetime: new Date(),
            organizerId: "org-1",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        ),
    } as any;

    const service = CreateMyRsvpsService(mockRsvpRepo, mockEventRepo);

    const result = await service.getMyRsvps({
      userId: "user-1",
      userRole: "user",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.upcoming).toHaveLength(0);
      expect(result.value.history).toHaveLength(1);
    }
  })

  it("sorts upcoming in increasing order", async() =>{
      const mockRsvpRepo = {
      findByUserId: jest.fn().mockResolvedValue(
        Ok([
          {
            id: "r-1",
            eventId: "event-1",
            userId: "user-1",
            status: "going",
            createdAt: new Date(),
          },
          {
            id: "r-2",
            eventId: "event-2",
            userId: "user-1",
            status: "waitlisted",
            createdAt: new Date(),
          },
        ])
      ),
    } as any;

    const mockEventRepo = {
      findById: jest.fn()
        .mockResolvedValueOnce(
          Ok({
            id: "event-1",
            title: "second event",
            description: "",
            location: "",
            category: "social",
            status: "published",
            capacity: 10,
            startDatetime: new Date("2026-05-03T10:00:00.000Z"),
            endDatetime: new Date(),
            organizerId: "org-1",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        )
        .mockResolvedValueOnce(
          Ok({
            id: "event-2",
            title: "first event",
            description: "",
            location: "",
            category: "social",
            status: "published",
            capacity: 10,
            startDatetime: new Date("2026-05-01T10:00:00.000Z"),
            endDatetime: new Date(),
            organizerId: "org-1",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
        ),
    } as any;

    const service = CreateMyRsvpsService(mockRsvpRepo, mockEventRepo);

    const result = await service.getMyRsvps({
      userId: "user-1",
      userRole: "user",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.upcoming[0].event.title).toBe("first event");
      expect(result.value.upcoming[1].event.title).toBe("second event");
    }
  })
})