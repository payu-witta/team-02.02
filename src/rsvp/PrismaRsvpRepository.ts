import { PrismaClient } from "@prisma/client";
import type { Rsvp as PrismaRsvp } from "@prisma/client";
import { Ok } from "../lib/result";
import type { IRsvpRepository, Rsvp, UpsertRsvpData } from "./InRsvpRepository";

function toRsvp(row: PrismaRsvp): Rsvp {
  return {
    ...row,
    status: row.status as Rsvp["status"],
  };
}

class PrismaRsvpRepository implements IRsvpRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEventId(eventId: string) {
    const rows = await this.prisma.rsvp.findMany({
      where: { eventId },
      orderBy: { createdAt: "asc" },
    });
    return Ok(rows.map(toRsvp));
  }

  async findByUserId(userId: string) {
    const rows = await this.prisma.rsvp.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return Ok(rows.map(toRsvp));
  }

  async findByEventAndUser(eventId: string, userId: string) {
    const row = await this.prisma.rsvp.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    return Ok(row ? toRsvp(row) : null);
  }

  async countGoingByEventId(eventId: string) {
    const count = await this.prisma.rsvp.count({
      where: { eventId, status: "going" },
    });
    return Ok(count);
  }

  async upsert(data: UpsertRsvpData) {
    const row = await this.prisma.rsvp.upsert({
      where: { eventId_userId: { eventId: data.eventId, userId: data.userId } },
      update: { status: data.status },
      create: {
        eventId: data.eventId,
        userId: data.userId,
        status: data.status,
      },
    });
    return Ok(toRsvp(row));
  }

  async atomicCancelAndPromote(
    eventId: string,
    cancelUserId: string,
    promoteUserId: string,
  ) {
    const cancelled = await this.prisma.$transaction(async (tx) => {
      const c = await tx.rsvp.update({
        where: { eventId_userId: { eventId, userId: cancelUserId } },
        data: { status: "cancelled" },
      });
      await tx.rsvp.update({
        where: { eventId_userId: { eventId, userId: promoteUserId } },
        data: { status: "going" },
      });
      return c;
    });
    return Ok(toRsvp(cancelled));
  }
}

export function CreatePrismaRsvpRepository(prisma: PrismaClient): IRsvpRepository {
  return new PrismaRsvpRepository(prisma);
}
