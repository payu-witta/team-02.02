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

    if (!result.ok) {
      const status = this.mapErrorStatus(result.value.name);
      this.logger.warn(`RSVP toggle failed for event ${eventId}: ${result.value.message}`);
      res.status(status).render("partials/error", {
        message: result.value.message,
        layout: false,
      });
      return;
    }

    this.logger.info(
      `User ${user.userId} toggled RSVP for event ${eventId} → "${result.value.status}"`,
    );
    res.redirect(`/home`);
  }

  async handleGetStatus(req: Request, res: Response): Promise<void> {
    // Implemented in next commit.
    res.status(501).render("partials/error", { message: "Not implemented.", layout: false });
  }
}

export function CreateRsvpController(
  rsvpService: IRsvpService,
  logger: ILoggingService,
): IRsvpController {
  return new RsvpController(rsvpService, logger);
}
