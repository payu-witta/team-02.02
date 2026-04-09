import { randomUUID } from "node:crypto";
import { Ok } from "../lib/result";
import type { IRsvpRepository, Rsvp, UpsertRsvpData } from "./InRsvpRepository";

class InMemoryRsvpRepository implements IRsvpRepository {
  private readonly rsvps: Map<string, Rsvp> = new Map();

  async findByEventId(eventId: string) {
    const result = [...this.rsvps.values()]
      .filter((r) => r.eventId === eventId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return Ok(result);
  }

  async findByUserId(userId: string) {
    const result = [...this.rsvps.values()]
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return Ok(result);
  }

  async findByEventAndUser(eventId: string, userId: string) {
    const match =
      [...this.rsvps.values()].find(
        (r) => r.eventId === eventId && r.userId === userId,
      ) ?? null;
    return Ok(match);
  }

  async countGoingByEventId(eventId: string) {
    const count = [...this.rsvps.values()].filter(
      (r) => r.eventId === eventId && r.status === "going",
    ).length;
    return Ok(count);
  }

  async upsert(data: UpsertRsvpData) {
    const existing = [...this.rsvps.values()].find(
      (r) => r.eventId === data.eventId && r.userId === data.userId,
    );

    if (existing) {
      existing.status = data.status;
      return Ok({ ...existing });
    }

    const rsvp: Rsvp = {
      id: randomUUID(),
      eventId: data.eventId,
      userId: data.userId,
      status: data.status,
      createdAt: new Date(),
    };
    this.rsvps.set(rsvp.id, rsvp);
    return Ok({ ...rsvp });
  }
}

export function CreateInMemoryRsvpRepository(): IRsvpRepository {
  return new InMemoryRsvpRepository();
}
