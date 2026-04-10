// STUB — owned by Avin (Feature 1). This file exists so the RSVP feature
// can be wired and tested before Avin's full implementation lands.
// Avin will replace this with the real InMemoryEventRepository.

import { randomUUID } from "node:crypto";
import { Err, Ok } from "../lib/result";
import { EventNotFoundError } from "./errors";
import type { CreateEventData, Event, EventFilters, IEventRepository } from "./InEventRepository";

export const DEMO_EVENTS: Event[] = [
  {
    id: "event-published-limited",
    title: "Community Cleanup",
    description: "Help clean up the local park.",
    location: "Riverside Park",
    category: "volunteer",
    status: "published",
    capacity: 3,
    startDatetime: new Date("2026-05-01T10:00:00"),
    endDatetime: new Date("2026-05-01T12:00:00"),
    organizerId: "user-staff",
    createdAt: new Date("2026-04-01"),
    updatedAt: new Date("2026-04-01"),
  },
  {
    id: "event-published-open",
    title: "Tech Meetup",
    description: "Monthly tech talk — all welcome.",
    location: "Community Center",
    category: "educational",
    status: "published",
    capacity: undefined,
    startDatetime: new Date("2026-05-15T18:00:00"),
    endDatetime: new Date("2026-05-15T20:00:00"),
    organizerId: "user-staff",
    createdAt: new Date("2026-04-01"),
    updatedAt: new Date("2026-04-01"),
  },
  {
    id: "event-draft",
    title: "Art Show (Draft)",
    description: "Not yet published — RSVP should be rejected.",
    location: "Gallery",
    category: "arts",
    status: "draft",
    startDatetime: new Date("2026-06-01T10:00:00"),
    endDatetime: new Date("2026-06-01T14:00:00"),
    organizerId: "user-staff",
    createdAt: new Date("2026-04-01"),
    updatedAt: new Date("2026-04-01"),
  },
];

class InMemoryEventRepository implements IEventRepository {
  private readonly events: Map<string, Event>;

  constructor(seed: Event[]) {
    this.events = new Map(seed.map((e) => [e.id, { ...e }]));
  }

  async findById(id: string) {
    const event = this.events.get(id) ?? null;
    if (!event) return Err(EventNotFoundError(`Event "${id}" not found.`));
    return Ok({ ...event });
  }

  async findAll(_filters?: EventFilters) {
    return Ok([...this.events.values()]);
  }

  async create(data: CreateEventData) {
    const event: Event = {
      id: randomUUID(),
      ...data,
      status: "draft",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.events.set(event.id, event);
    return Ok({ ...event });
  }

  async update(id: string, changes: Partial<Omit<Event, "id" | "createdAt" | "organizerId">>) {
    const event = this.events.get(id);
    if (!event) return Err(EventNotFoundError(`Event "${id}" not found.`));
    Object.assign(event, changes, { updatedAt: new Date() });
    return Ok({ ...event });
  }
}

export function CreateInMemoryEventRepository(): IEventRepository {
  return new InMemoryEventRepository([...DEMO_EVENTS]);
}
