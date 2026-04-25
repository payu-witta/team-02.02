import { Err, Ok, type Result } from "../lib/result";
import type { UserRole } from "../auth/User";
import type { ILoggingService } from "../service/LoggingService";
import type { IEventRepository } from "../events/InEventRepository";
import type { IRsvpRepository, Rsvp } from "./InRsvpRepository";
import {
  EventNotFoundError,
  InvalidStateError,
  PromotionFailedError,
  UnauthorizedError,
  type RsvpError,
} from "./errors";

export interface ToggleRsvpInput {
  eventId: string;
  userId: string;
  userRole: UserRole;
}

export interface IRsvpService {
  toggleRsvp(input: ToggleRsvpInput): Promise<Result<Rsvp, RsvpError>>;
  getRsvpForUser(eventId: string, userId: string): Promise<Result<Rsvp | null, RsvpError>>;
  getWaitlistPosition(eventId: string, userId: string): Promise<Result<number | null, RsvpError>>;
}

class RsvpService implements IRsvpService {
  constructor(
    private readonly rsvpRepo: IRsvpRepository,
    private readonly eventRepo: IEventRepository,
    private readonly logger: ILoggingService,
  ) {}

  async toggleRsvp(input: ToggleRsvpInput): Promise<Result<Rsvp, RsvpError>> {
    const { eventId, userId, userRole } = input;

    if (userRole !== "user") {
      return Err(UnauthorizedError("Organizers and admins cannot RSVP to events."));
    }

    const eventResult = await this.eventRepo.findById(eventId);
    if (!eventResult.ok) {
      return Err(EventNotFoundError(`Event ${eventId} not found.`));
    }
    const event = eventResult.value;

    if (event.status !== "published") {
      return Err(InvalidStateError(`Cannot RSVP to an event with status "${event.status}".`));
    }

    const existingResult = await this.rsvpRepo.findByEventAndUser(eventId, userId);
    const existing = existingResult.value;
    const isActive =
      existing !== null &&
      (existing.status === "going" || existing.status === "waitlisted");

    if (isActive) {
      const shouldPromote = existing!.status === "going";
      const firstWaitlisted = shouldPromote
        ? (await this.rsvpRepo.findByEventId(eventId)).value.find((r) => r.status === "waitlisted")
        : undefined;

      if (!shouldPromote || firstWaitlisted === undefined) {
        const cancelled = await this.rsvpRepo.upsert({ eventId, userId, status: "cancelled" });
        this.logger.info(`User ${userId} cancelled RSVP for event ${eventId}`);
        return Ok(cancelled.value);
      }

      if (this.rsvpRepo.atomicCancelAndPromote) {
        try {
          const result = await this.rsvpRepo.atomicCancelAndPromote(
            eventId,
            userId,
            firstWaitlisted.userId,
          );
          this.logger.info(
            `User ${userId} cancelled RSVP; promoted ${firstWaitlisted.userId} for event ${eventId}`,
          );
          return Ok(result.value);
        } catch (error) {
          this.logger.error(
            `Atomic cancel+promote failed for event ${eventId}: ${this.formatUnknownError(error)}`,
          );
          return Err(
            PromotionFailedError(
              `Failed to promote waitlisted RSVP for event ${eventId}; cancellation was not finalized.`,
            ),
          );
        }
      }

      const cancelled = await this.rsvpRepo.upsert({ eventId, userId, status: "cancelled" });
      this.logger.info(`User ${userId} cancelled RSVP for event ${eventId}`);
      try {
        await this.rsvpRepo.upsert({
          eventId: firstWaitlisted.eventId,
          userId: firstWaitlisted.userId,
          status: "going",
        });
        this.logger.info(`Promoted user ${firstWaitlisted.userId} from waitlist for event ${eventId}`);
        return Ok(cancelled.value);
      } catch (error) {
        this.logger.error(
          `Promotion failed for event ${eventId}; restoring cancelled RSVP for user ${userId}: ${this.formatUnknownError(error)}`,
        );
        try {
          await this.rsvpRepo.upsert({ eventId, userId, status: "going" });
        } catch (rollbackError) {
          this.logger.error(
            `Rollback failed for event ${eventId}, user ${userId}: ${this.formatUnknownError(rollbackError)}`,
          );
        }
        return Err(
          PromotionFailedError(
            `Failed to promote waitlisted RSVP for event ${eventId}; cancellation was not finalized.`,
          ),
        );
      }
    }

    let targetStatus: Rsvp["status"] = "going";
    if (event.capacity !== undefined) {
      const countResult = await this.rsvpRepo.countGoingByEventId(eventId);
      if (countResult.value >= event.capacity) {
        targetStatus = "waitlisted";
      }
    }

    const upserted = await this.rsvpRepo.upsert({ eventId, userId, status: targetStatus });
    this.logger.info(`User ${userId} RSVPed to event ${eventId} as "${targetStatus}"`);
    return Ok(upserted.value);
  }

  async getRsvpForUser(
    eventId: string,
    userId: string,
  ): Promise<Result<Rsvp | null, RsvpError>> {
    const eventResult = await this.eventRepo.findById(eventId);
    if (eventResult.ok === false) {
      return Err(EventNotFoundError(`Event ${eventId} not found.`));
    }
    const result = await this.rsvpRepo.findByEventAndUser(eventId, userId);
    return Ok(result.value);
  }

  async getWaitlistPosition(
    eventId: string,
    userId: string,
  ): Promise<Result<number | null, RsvpError>> {
    const eventResult = await this.eventRepo.findById(eventId);
    if (!eventResult.ok) {
      return Err(EventNotFoundError(`Event ${eventId} not found.`));
    }

    const allResult = await this.rsvpRepo.findByEventId(eventId);
    const waitlisted = allResult.value.filter((r) => r.status === "waitlisted");
    const index = waitlisted.findIndex((r) => r.userId === userId);
    return Ok(index === -1 ? null : index + 1);
  }

  private formatUnknownError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}

export function CreateRsvpService(
  rsvpRepo: IRsvpRepository,
  eventRepo: IEventRepository,
  logger: ILoggingService,
): IRsvpService {
  return new RsvpService(rsvpRepo, eventRepo, logger);
}