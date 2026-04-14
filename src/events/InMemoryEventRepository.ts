import { randomUUID } from "node:crypto";
import { Ok, Err } from "../lib/result";
import type { Result } from "../lib/result";
import type {
  Event,
  EventFilters,
  CreateEventData,
  IEventRepository,
} from "./IEventRepository";

class InMemoryEventRepository implements IEventRepository {
  private readonly store: Map<string, Event> = new Map();

  async findById(
    id: string,
  ): Promise<Result<Event, { name: "EventNotFoundError"; message: string }>> {
    const event = this.store.get(id);
    if (!event) {
      return Err({ name: "EventNotFoundError" as const, message: `Event "${id}" not found.` });
    }
    return Ok({ ...event });
  }

  async findAll(filters?: EventFilters): Promise<Result<Event[], never>> {
    let results = Array.from(this.store.values());

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

  async create(data: CreateEventData): Promise<Result<Event, never>> {
    const now = new Date();
    const event: Event = {
      id: randomUUID(),
      ...data,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(event.id, { ...event });
    return Ok({ ...event });
  }

  async update(
    id: string,
    changes: Partial<Omit<Event, "id" | "createdAt" | "organizerId">>,
  ): Promise<Result<Event, { name: "EventNotFoundError"; message: string }>> {
    const existing = this.store.get(id);
    if (!existing) {
      return Err({ name: "EventNotFoundError" as const, message: `Event "${id}" not found.` });
    }
    const updated: Event = { ...existing, ...changes, updatedAt: new Date() };
    this.store.set(id, { ...updated });
    return Ok({ ...updated });
  }
}

export function CreateInMemoryEventRepository(): IEventRepository {
  return new InMemoryEventRepository();
}
