import { randomUUID } from "node:crypto";
import type { Result } from "../lib/result";
import { Err, Ok } from "../lib/result";
import type { CreateEventData, Event, EventFilters, EventStatus, IEventRepository } from "./types";

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function startOfWeekMonday(d: Date): Date {
  const day = d.getDay(); // 0=Sun ... 6=Sat
  const diffToMonday = (day + 6) % 7; // Mon -> 0, Tue -> 1, ... Sun -> 6
  const monday = new Date(d);
  monday.setDate(d.getDate() - diffToMonday);
  return startOfDay(monday);
}

function weekendRange(now: Date): { start: Date; end: Date } {
  const weekStart = startOfWeekMonday(now);
  const saturday = new Date(weekStart);
  saturday.setDate(weekStart.getDate() + 5);
  const sunday = new Date(weekStart);
  sunday.setDate(weekStart.getDate() + 6);

  const start = startOfDay(saturday);
  const end = endOfDay(sunday);

  // If we've already passed Sunday night, interpret "this weekend" as the next weekend.
  if (now.getTime() > end.getTime()) {
    const nextSaturday = new Date(start);
    nextSaturday.setDate(start.getDate() + 7);
    const nextSunday = new Date(end);
    nextSunday.setDate(end.getDate() + 7);
    return { start: nextSaturday, end: nextSunday };
  }

  return { start, end };
}

function weekRange(now: Date): { start: Date; end: Date } {
  const start = startOfWeekMonday(now);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end: endOfDay(end) };
}

function matchesTimeframe(event: Event, timeframe: NonNullable<EventFilters["timeframe"]>, now: Date) {
  const startMs = event.startDatetime.getTime();
  const nowMs = now.getTime();

  if (timeframe === "upcoming") {
    return startMs >= nowMs;
  }

  if (timeframe === "this_week") {
    const { start, end } = weekRange(now);
    return startMs >= nowMs && startMs >= start.getTime() && startMs <= end.getTime();
  }

  const { start, end } = weekendRange(now);
  return startMs >= nowMs && startMs >= start.getTime() && startMs <= end.getTime();
}

function coerceStatuses(status?: EventFilters["status"]): EventStatus[] | null {
  if (!status) return null;
  return Array.isArray(status) ? status : [status];
}

function seedEvents(now: Date = new Date()): Event[] {
  const organizerA = "seed-organizer-a";
  const organizerB = "seed-organizer-b";

  const inDays = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);
  const inHours = (n: number) => new Date(now.getTime() + n * 60 * 60 * 1000);
  const hoursAfter = (d: Date, n: number) => new Date(d.getTime() + n * 60 * 60 * 1000);

  const createdAt = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const mk = (e: Omit<Event, "createdAt" | "updatedAt">): Event => ({
    ...e,
    createdAt,
    updatedAt: createdAt,
  });

  const saturdayThisWeek = weekendRange(now).start;
  const sundayThisWeek = new Date(saturdayThisWeek);
  sundayThisWeek.setDate(saturdayThisWeek.getDate() + 1);

  return [
    mk({
      id: randomUUID(),
      title: "Campus Board Games Night",
      description: "Bring a game or join a table. Snacks provided.",
      location: "Student Union",
      category: "social",
      status: "published",
      startDatetime: inDays(3),
      endDatetime: hoursAfter(inDays(3), 2),
      organizerId: organizerA,
    }),
    mk({
      id: randomUUID(),
      title: "Intro to TypeScript Workshop",
      description: "Hands-on session covering types, narrowing, and generics.",
      location: "CS Lab 120",
      category: "educational",
      status: "published",
      startDatetime: inDays(1),
      endDatetime: hoursAfter(inDays(1), 1),
      organizerId: organizerB,
    }),
    mk({
      id: randomUUID(),
      title: "Community Park Cleanup",
      description: "Volunteer with us to clean up the park trails.",
      location: "Riverside Park Entrance",
      category: "volunteer",
      status: "published",
      startDatetime: saturdayThisWeek,
      endDatetime: hoursAfter(saturdayThisWeek, 2),
      organizerId: organizerA,
    }),
    mk({
      id: randomUUID(),
      title: "Sunday Morning Fun Run",
      description: "5k at an easy pace. All levels welcome.",
      location: "Track Field",
      category: "sports",
      status: "published",
      startDatetime: new Date(sundayThisWeek.getTime() + 9 * 60 * 60 * 1000),
      endDatetime: new Date(sundayThisWeek.getTime() + 11 * 60 * 60 * 1000),
      organizerId: organizerB,
    }),
    mk({
      id: randomUUID(),
      title: "Gallery Sketch Meetup",
      description: "Bring a sketchbook. Quiet, casual, and friendly.",
      location: "Downtown Art Gallery",
      category: "arts",
      status: "draft",
      startDatetime: inDays(5),
      endDatetime: hoursAfter(inDays(5), 2),
      organizerId: organizerA,
    }),
    mk({
      id: randomUUID(),
      title: "Last Month's Study Group",
      description: "An older event used to verify past filtering.",
      location: "Library Room 2",
      category: "educational",
      status: "past",
      startDatetime: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      endDatetime: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
      organizerId: organizerB,
    }),
    mk({
      id: randomUUID(),
      title: "Cancelled Picnic",
      description: "This event is cancelled and should not appear in published-only lists.",
      location: "Main Quad",
      category: "social",
      status: "cancelled",
      startDatetime: inHours(10),
      endDatetime: inHours(12),
      organizerId: organizerA,
    }),
  ];
}

export class InMemoryEventRepository implements IEventRepository {
  private events: Event[];

  constructor(
    seed: Event[] = seedEvents(),
    private readonly now: () => Date = () => new Date(),
  ) {
    this.events = [...seed];
  }

  async findById(
    id: string,
  ): Promise<Result<Event, { name: "EventNotFoundError"; message: string }>> {
    const found = this.events.find((e) => e.id === id);
    if (!found) {
      return Err({
        name: "EventNotFoundError" as const,
        message: `No event found with id ${id}`,
      });
    }
    return Ok(found);
  }

  async findAll(filters: EventFilters = {}): Promise<Result<Event[], never>> {
    const now = this.now();
    const statuses = coerceStatuses(filters.status);

    const filtered = this.events
      .filter((e) => (filters.organizerId ? e.organizerId === filters.organizerId : true))
      .filter((e) => (filters.category ? e.category === filters.category : true))
      .filter((e) => (statuses ? statuses.includes(e.status) : true))
      .filter((e) => (filters.timeframe ? matchesTimeframe(e, filters.timeframe, now) : true))
      .sort((a, b) => a.startDatetime.getTime() - b.startDatetime.getTime());

    return Ok(filtered);
  }

  async create(data: CreateEventData): Promise<Result<Event, never>> {
    const now = new Date();
    const event: Event = {
      id: randomUUID(),
      title: data.title,
      description: data.description,
      location: data.location,
      category: data.category,
      status: "draft",
      capacity: data.capacity,
      startDatetime: data.startDatetime,
      endDatetime: data.endDatetime,
      organizerId: data.organizerId,
      createdAt: now,
      updatedAt: now,
    };
    this.events.push(event);
    return Ok(event);
  }

  async update(
    id: string,
    changes: Partial<Omit<Event, "id" | "createdAt" | "organizerId">>,
  ): Promise<Result<Event, { name: "EventNotFoundError"; message: string }>> {
    const idx = this.events.findIndex((e) => e.id === id);
    if (idx < 0) {
      return Err({
        name: "EventNotFoundError" as const,
        message: `No event found with id ${id}`,
      });
    }

    const existing = this.events[idx];
    const updated: Event = {
      ...existing,
      ...changes,
      updatedAt: new Date(),
    };
    this.events[idx] = updated;
    return Ok(updated);
  }
}

export function CreateInMemoryEventRepository(seed?: Event[]): IEventRepository {
  return new InMemoryEventRepository(seed);
}

