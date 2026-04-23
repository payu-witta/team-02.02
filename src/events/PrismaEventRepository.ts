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

    let rows = await this.prisma.event.findMany({
      where,
      orderBy: { startDatetime: "asc" },
    });

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
