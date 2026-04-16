import type { Request, Response } from "express";
import type { ILoggingService } from "../service/LoggingService";
import type { AppSessionStore } from "../session/AppSession";
import { getAuthenticatedUser } from "../session/AppSession";
import type { IRsvpService } from "./RsvpService";
import type { RsvpError } from "./errors";

export interface IRsvpController {
  handleToggle(req: Request, res: Response): Promise<void>;
  handleGetStatus(req: Request, res: Response): Promise<void>;
}

class RsvpController implements IRsvpController {
  constructor(
    private readonly rsvpService: IRsvpService,
    private readonly logger: ILoggingService,
  ) {}

  private mapErrorStatus(name: RsvpError["name"]): number {
    if (name === "EventNotFoundError") return 404;
    if (name === "InvalidStateError") return 409;
    if (name === "UnauthorizedError") return 403;
    if (name === "PromotionFailedError") return 500;
    return 500;
  }

  async handleToggle(req: Request, res: Response): Promise<void> {
    const user = getAuthenticatedUser(req.session as AppSessionStore);

    if (!user) {
      res.status(401).render("partials/error", {
        message: "You must be logged in to RSVP.",
        layout: false,
      });
      return;
    }

    const eventId = typeof req.params.eventId === "string" ? req.params.eventId : "";

    const result = await this.rsvpService.toggleRsvp({
      eventId,
      userId: user.userId,
      userRole: user.role,
    });

    if (result.ok === false) {
      const error = result.value;
      const status = this.mapErrorStatus(error.name);
      this.logger.warn(`RSVP toggle failed for event ${eventId}: ${error.message}`);
      res.status(status).render("partials/error", {
        message: error.message,
        layout: false,
      });
      return;
    }

    const rsvp = result.value;
    this.logger.info(
      `User ${user.userId} toggled RSVP for event ${eventId} → "${rsvp.status}"`,
    );

    let waitlistPosition: number | null = null;
    if (rsvp.status === "waitlisted") {
      const posResult = await this.rsvpService.getWaitlistPosition(eventId, user.userId);
      if (posResult.ok) {
        waitlistPosition = posResult.value;
      }
    }

    res.render("rsvp/partials/button", { eventId, rsvp, waitlistPosition, layout: false });
  }

  async handleGetStatus(req: Request, res: Response): Promise<void> {
    const user = getAuthenticatedUser(req.session as AppSessionStore);

    if (!user) {
      res.status(401).render("partials/error", {
        message: "You must be logged in to view RSVP status.",
        layout: false,
      });
      return;
    }

    const eventId = typeof req.params.eventId === "string" ? req.params.eventId : "";

    const rsvpResult = await this.rsvpService.getRsvpForUser(eventId, user.userId);
    if (rsvpResult.ok === false) {
      const error = rsvpResult.value;
      res.status(this.mapErrorStatus(error.name)).render("partials/error", {
        message: error.message,
        layout: false,
      });
      return;
    }

    const rsvp = rsvpResult.value;
    let waitlistPosition: number | null = null;

    if (rsvp !== null && rsvp.status === "waitlisted") {
      const posResult = await this.rsvpService.getWaitlistPosition(eventId, user.userId);
      if (posResult.ok) {
        waitlistPosition = posResult.value;
      }
    }

    this.logger.info(`GET RSVP status for user ${user.userId} on event ${eventId}`);
    res.render("rsvp/partials/button", { eventId, rsvp, waitlistPosition, layout: false });
  }
}

export function CreateRsvpController(
  rsvpService: IRsvpService,
  logger: ILoggingService,
): IRsvpController {
  return new RsvpController(rsvpService, logger);
}