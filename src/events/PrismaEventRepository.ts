import { PrismaClient, Prisma } from "@prisma/client";
import type { Event as PrismaEvent } from "@prisma/client";
import { Ok, Err } from "../lib/result";
import { EventNotFoundError } from "./errors";
import type {
  Event,
  EventFilters,
  CreateEventData,
  IEventRepository,
} from "./InEventRepository";

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function weekRange(now: Date): { start: Date; end: Date } {
  const start = startOfDay(now);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

function weekendRange(now: Date): { start: Date; end: Date } {
  const day = now.getDay();
  const daysUntilSat = day === 6 ? 0 : 6 - day;
  const sat = new Date(now);
  sat.setDate(now.getDate() + daysUntilSat);
  sat.setHours(0, 0, 0, 0);
  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);
  sun.setHours(23, 59, 59, 999);
  return { start: sat, end: sun };
}

function toEvent(row: PrismaEvent): Event {
  return {
    ...row,
    status: row.status as Event["status"],
    capacity: row.capacity ?? undefined,
  };
}

class PrismaEventRepository implements IEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string) {
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
      const statuses = Array.isArray(filters.status)
        ? filters.status
        : [filters.status];
      where.status = { in: statuses };
    }

    if (filters?.category !== undefined) {
      where.category = filters.category;
    }

    if (filters?.timeframe !== undefined) {
      const now = new Date();
      if (filters.timeframe === "upcoming") {
        where.startDatetime = { gte: now };
      } else if (filters.timeframe === "this_week") {
        const { start, end } = weekRange(now);
        where.startDatetime = { gte: now > start ? now : start, lte: end };
      } else if (filters.timeframe === "this_weekend") {
        const { start, end } = weekendRange(now);
        where.startDatetime = { gte: start, lte: end };
      }
    }

    if (filters?.search !== undefined) {
      const term = filters.search;
      where.OR = [
        { title:       { contains: term } },
        { description: { contains: term } },
        { location:    { contains: term } },
      ];
    }

    const rows = await this.prisma.event.findMany({
      where,
      orderBy: { startDatetime: "asc" },
    });

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
