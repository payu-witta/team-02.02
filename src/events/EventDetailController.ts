import type { Request, Response } from "express";
import { getAuthenticatedUser,recordPageView } from "../session/AppSession";
import type { ILoggingService } from "../service/LoggingService";
import type { IEventDetailService } from "./EventDetailService";

export interface IEventDetailController {
  showEventDetail(req: Request, res: Response): Promise<void>;
}

class EventDetailController implements IEventDetailController {
  constructor(
    private readonly eventDetailService: IEventDetailService,
    private readonly logger: ILoggingService,
  ) {}

  async showEventDetail(req: Request, res: Response): Promise<void> {
    const currentUser = getAuthenticatedUser(req.session as never);
    const browserSession = recordPageView(req.session as never);

    if (!currentUser) {
      res.redirect("/login");
      return;
    }

    const result = await this.eventDetailService.getEventDetail({
      eventId: typeof req.params.eventId === "string" ? req.params.eventId : "",
      actingUserId: currentUser.userId,
      actingUserRole: currentUser.role,
    });

    if (!result.ok) {
      res.status(404).render("partials/error", {
        message: "Event not found.",
        layout: false,
      });
      return;
    }

    res.render("events/detail", {
      ...result.value,
      session: browserSession,
      pageError: null,
    });
  }
}

export function CreateEventDetailController(
  eventDetailService: IEventDetailService,
  logger: ILoggingService,
): IEventDetailController {
  return new EventDetailController(eventDetailService, logger);
}