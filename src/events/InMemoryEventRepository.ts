import { randomUUID } from "node:crypto";
import { Err, Ok } from "../lib/result";
import { EventNotFoundError } from "./errors";
import type {
  Event,
  EventFilters,
  CreateEventData,
  IEventRepository,
} from "./InEventRepository";

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
    const event = this.events.get(id);
    if (!event) {
      return Err(EventNotFoundError(`Event "${id}" not found.`));
    }
    return Ok({ ...event });
  }

  async findAll(filters?: EventFilters) {
    let results = Array.from(this.events.values());

    if (filters) {
      if (filters.organizerId !== undefined) {
        results = results.filter((e) => e.organizerId === filters.organizerId);
      }

      if (filters.status !== undefined) {
        const statuses = Array.isArray(filters.status)
          ? filters.status
          : [filters.status];
        results = results.filter((e) => statuses.includes(e.status));
      }

      if (filters.category !== undefined) {
        results = results.filter((e) => e.category === filters.category);
      }

      if (filters.search !== undefined) {
        const term = filters.search.toLowerCase();
        results = results.filter(
          (e) =>
            e.title.toLowerCase().includes(term) ||
            e.description.toLowerCase().includes(term) ||
            e.location.toLowerCase().includes(term),
        );
      }

      if (filters.timeframe !== undefined) {
        const now = new Date();
        if (filters.timeframe === "upcoming") {
          results = results.filter((e) => e.startDatetime >= now);
        } else if (filters.timeframe === "this_week") {
          const weekEnd = new Date(now);
          weekEnd.setDate(weekEnd.getDate() + 7);
          results = results.filter(
            (e) => e.startDatetime >= now && e.startDatetime <= weekEnd,
          );
        } else if (filters.timeframe === "this_weekend") {
          const day = now.getDay();
          const daysUntilSat = day === 6 ? 0 : 6 - day;
          const sat = new Date(now);
          sat.setDate(now.getDate() + daysUntilSat);
          sat.setHours(0, 0, 0, 0);
          const sun = new Date(sat);
          sun.setDate(sat.getDate() + 1);
          sun.setHours(23, 59, 59, 999);
          results = results.filter(
            (e) => e.startDatetime >= sat && e.startDatetime <= sun,
          );
        }
      }
    }

    results.sort((a, b) => a.startDatetime.getTime() - b.startDatetime.getTime());
    return Ok(results.map((e) => ({ ...e })));
  }

  async create(data: CreateEventData) {
    const now = new Date();
    const event: Event = {
      id: randomUUID(),
      ...data,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };
    this.events.set(event.id, { ...event });
    return Ok({ ...event });
  }

  async update(
    id: string,
    changes: Partial<Omit<Event, "id" | "createdAt" | "organizerId">>,
  ) {
    const existing = this.events.get(id);
    if (!existing) {
      return Err(EventNotFoundError(`Event "${id}" not found.`));
    }
    const updated: Event = { ...existing, ...changes, updatedAt: new Date() };
    this.events.set(id, { ...updated });
    return Ok({ ...updated });
  }
}

export function CreateInMemoryEventRepository(): IEventRepository {
  return new InMemoryEventRepository([...DEMO_EVENTS]);
}
