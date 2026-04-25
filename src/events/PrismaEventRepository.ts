import { PrismaClient } from "@prisma/client";
import { Ok, Err } from "../lib/result";
import { EventNotFoundError } from "./errors";
import type { Event, EventFilters, CreateEventData, IEventRepository } from "./InEventRepository";

function toEvent(raw: any): Event {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    location: raw.location,
    category: raw.category,
    status: raw.status as Event["status"],
    capacity: raw.capacity ?? undefined,
    startDatetime: raw.startDatetime,
    endDatetime: raw.endDatetime,
    organizerId: raw.organizerId,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

class PrismaEventRepository implements IEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) {
      return Err(EventNotFoundError(`Event "${id}" not found.`));
    }
    return Ok(toEvent(event));
  }

  async findAll(filters?: EventFilters) {
    const now = new Date();
    const where: any = {};
    const row = await this.prisma.event.findUnique({ where: { id } });
    if (!row) return Err(EventNotFoundError(`Event "${id}" not found.`));
    return Ok(toEvent(row));
  }

  async findAll(filters?: EventFilters) {
    const where: Prisma.EventWhereInput = {};

    if (filters?.organizerId !== undefined) {
      where.organizerId = filters.organizerId;
    }

    if (filters?.status !== undefined) {
      where.status = Array.isArray(filters.status)
        ? { in: filters.status }
        : filters.status;
      const statuses = Array.isArray(filters.status)
        ? filters.status
        : [filters.status];
      where.status = { in: statuses };
    }

    if (filters?.category !== undefined) {
      where.category = filters.category;
    }

    // Feature 6 — date-range queries for timeframe
    if (filters?.timeframe !== undefined) {
      if (filters.timeframe === "upcoming") {
        where.startDatetime = { gte: now };
      } else if (filters.timeframe === "this_week") {
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() + 7);
        where.startDatetime = { gte: now, lte: weekEnd };
      } else if (filters.timeframe === "this_weekend") {
        const day = now.getDay();
        const daysUntilSat = day === 6 ? 0 : 6 - day;
        const sat = new Date(now);
        sat.setDate(now.getDate() + daysUntilSat);
        sat.setHours(0, 0, 0, 0);
        const sun = new Date(sat);
        sun.setDate(sat.getDate() + 1);
        sun.setHours(23, 59, 59, 999);
        where.startDatetime = { gte: sat, lte: sun };
      }
    }

    const events = await this.prisma.event.findMany({
      where,
      orderBy: { startDatetime: "asc" },
    });

    return Ok(events.map(toEvent));
  }

  async create(data: CreateEventData) {
    const event = await this.prisma.event.create({
      data: { ...data, status: "draft" },
    });
    return Ok(toEvent(event));
  }

  async update(id: string, changes: Partial<Omit<Event, "id" | "createdAt" | "organizerId">>) {
    const existing = await this.prisma.event.findUnique({ where: { id } });
    if (!existing) {
      return Err(EventNotFoundError(`Event "${id}" not found.`));
    }
    const updated = await this.prisma.event.update({ where: { id }, data: changes });
    return Ok(toEvent(updated));
  }
}

export function CreatePrismaEventRepository(prisma: PrismaClient): IEventRepository {
  return new PrismaEventRepository(prisma);
}
    if (filters?.search !== undefined) {
      const term = filters.search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.title.toLowerCase().includes(term) ||
          r.description.toLowerCase().includes(term) ||
          r.location.toLowerCase().includes(term),
      );
    }

    return Ok(rows.map(toEvent));
  }

  async create(data: CreateEventData) {
    const row = await this.prisma.event.create({
      data: { ...data, status: "draft" },
    });
    return Ok(toEvent(row));
  }

  async update(
    id: string,
    changes: Partial<Omit<Event, "id" | "createdAt" | "organizerId">>,
  ) {
    try {
      const row = await this.prisma.event.update({
        where: { id },
        data: changes,
      });
      return Ok(toEvent(row));
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2025"
      ) {
        return Err(EventNotFoundError(`Event "${id}" not found.`));
      }
      throw e;
    }
  }
}

export function CreatePrismaEventRepository(
  prisma: PrismaClient,
): IEventRepository {
  return new PrismaEventRepository(prisma);
}
