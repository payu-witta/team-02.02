import type { Response } from "express";
import type { IEventController } from "./IEventController";
import type { IEventService } from "./IEventService";
import type { ILoggingService } from "../service/LoggingService";
import type { IAppBrowserSession, IAuthenticatedUserSession } from "../session/AppSession";
import type { EventError } from "./errors";

function mapErrorStatus(error: EventError): number {
  if (error.name === "InvalidInputError") return 400;
  if (error.name === "UnauthorizedError") return 403;
  if (error.name === "EventNotFoundError") return 404;
  if (error.name === "InvalidStateError") return 409;
  if (error.name === "InvalidTransitionError") return 409;
  return 500;
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

function parseCapacity(value: unknown): number | null | undefined {
  if (value === undefined || value === "") return undefined;
  if (value === null) return null;
  const n = Number(value);
  return isNaN(n) ? undefined : n;
}

function str(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  return value;
}

class EventController implements IEventController {
  constructor(
    private readonly service: IEventService,
    private readonly logger: ILoggingService,
  ) {}

  async showDetail(
    res: Response,
    eventId: string,
    session: IAppBrowserSession,
  ): Promise<void> {
    const result = await this.service.getEventById(eventId);

    if (result.ok === false) {
      this.logger.warn(`Event detail load failed: ${result.value.message}`);
      res.status(404).render("partials/error", {
        message: result.value.message,
        layout: false,
      });
      return;
    }

    const event = result.value;
    const currentUser = session.authenticatedUser;
    const isOwner = currentUser?.userId === event.organizerId;
    const isAdmin = currentUser?.role === "admin";

    if (event.status === "draft" && !isOwner && !isAdmin) {
      res.status(404).render("partials/error", {
        message: "Event not found.",
        layout: false,
      });
      return;
    }

    res.render("events/detail", { session, event });
  }

  async showCreateForm(res: Response, session: IAppBrowserSession): Promise<void> {
    res.render("events/create", { session, pageError: null });
  }

  async createFromForm(
    res: Response,
    body: Record<string, unknown>,
    currentUser: IAuthenticatedUserSession,
    session: IAppBrowserSession,
    isHtmx: boolean,
  ): Promise<void> {
    const result = await this.service.createEvent({
      title: typeof body.title === "string" ? body.title : "",
      description: typeof body.description === "string" ? body.description : "",
      location: typeof body.location === "string" ? body.location : "",
      category: typeof body.category === "string" ? body.category : "",
      capacity: parseCapacity(body.capacity) ?? undefined,
      startDatetime: parseDate(body.startDatetime) ?? new Date(0),
      endDatetime: parseDate(body.endDatetime) ?? new Date(0),
      organizerId: currentUser.userId,
      organizerRole: currentUser.role,
    });

    if (result.ok === false) {
      const status = mapErrorStatus(result.value);
      this.logger.warn(`Create event failed: ${result.value.message}`);
      res.status(status).render("events/create", {
        session,
        pageError: result.value.message,
        layout: isHtmx ? false : undefined,
      });
      return;
    }

    this.logger.info(`Event created: ${result.value.id}`);
    if (isHtmx) {
      res.set("HX-Redirect", `/events/${result.value.id}`).status(204).send();
      return;
    }
    res.redirect(`/events/${result.value.id}`);
  }

  async showEditForm(
    res: Response,
    eventId: string,
    currentUser: IAuthenticatedUserSession,
    session: IAppBrowserSession,
  ): Promise<void> {
    const result = await this.service.getEventById(eventId);

    if (result.ok === false) {
      this.logger.warn(`Edit form load failed: ${result.value.message}`);
      res.status(404).render("partials/error", {
        message: result.value.message,
        layout: false,
      });
      return;
    }

    const event = result.value;
    const isOwner = event.organizerId === currentUser.userId;
    const canEdit = currentUser.role === "admin" || (currentUser.role === "staff" && isOwner);

    if (!canEdit) {
      res.status(403).render("partials/error", {
        message: "You do not have permission to edit this event.",
        layout: false,
      });
      return;
    }

    res.render("events/edit", { session, event, pageError: null });
  }

  async editFromForm(
    res: Response,
    eventId: string,
    body: Record<string, unknown>,
    currentUser: IAuthenticatedUserSession,
    session: IAppBrowserSession,
  ): Promise<void> {
    const result = await this.service.editEvent({
      eventId,
      actingUserId: currentUser.userId,
      actingUserRole: currentUser.role,
      title: str(body.title),
      description: str(body.description),
      location: str(body.location),
      category: str(body.category),
      capacity: parseCapacity(body.capacity),
      startDatetime: parseDate(body.startDatetime),
      endDatetime: parseDate(body.endDatetime),
    });

    if (result.ok === false) {
      const status = mapErrorStatus(result.value);
      this.logger.warn(`Edit event failed: ${result.value.message}`);

      const eventResult = await this.service.getEventById(eventId);
      const event = eventResult.ok ? eventResult.value : null;

      res.status(status).render("events/edit", {
        session,
        event,
        pageError: result.value.message,
      });
      return;
    }

    this.logger.info(`Event updated: ${result.value.id}`);
    res.redirect(`/events/${result.value.id}`);
  }

  // Feature 5
  async publishEvent(
    res: Response,
    eventId: string,
    currentUser: IAuthenticatedUserSession,
    session: IAppBrowserSession,
  ): Promise<void> {
    const result = await this.service.publishEvent({
      eventId,
      actingUserId: currentUser.userId,
      actingUserRole: currentUser.role,
    });

    if (result.ok === false) {
      const status = mapErrorStatus(result.value);
      this.logger.warn(`Publish failed for ${eventId}: ${result.value.message}`);
      res.status(status).redirect(`/events/${eventId}`);
      return;
    }

    this.logger.info(`Event published: ${eventId}`);
    res.redirect(`/events/${eventId}`);
  }

  async cancelEvent(
    res: Response,
    eventId: string,
    currentUser: IAuthenticatedUserSession,
    session: IAppBrowserSession,
  ): Promise<void> {
    const result = await this.service.cancelEvent({
      eventId,
      actingUserId: currentUser.userId,
      actingUserRole: currentUser.role,
    });

    if (result.ok === false) {
      const status = mapErrorStatus(result.value);
      this.logger.warn(`Cancellation failed for ${eventId}: ${result.value.message}`);
      res.status(status).redirect(`/events/${eventId}`);
      return;
    }

    this.logger.info(`Event cancelled: ${eventId}`);
    res.redirect(`/events/${eventId}`);
  }

  //Feature 8
  async showDashboard(
    res: Response,
    currentUser: IAuthenticatedUserSession,
    session: IAppBrowserSession,
  ): Promise<void> {
    const result = await this.service.getOrganizerDashboard(
      currentUser.userId,
      currentUser.role,
    );

    if (result.ok === false) {
      this.logger.warn(`Dashboard load failed: ${result.value.message}`);
      res.status(500).render("partials/error", {
        message: "Could not load dashboard data.",
        layout: false,
      });
      return;
    }

    // result.value contains { published: [], draft: [], archived: [] }
    res.render("events/dashboard", {
      session,
      groups: result.value,
    });
  }

  async searchEvents(
    res: Response,
    query: string,
    session: IAppBrowserSession,
  ): Promise<void> {
    const result = await this.service.searchEvents({ query });
    if (result.ok === false) {
      this.logger.warn(`Search events failed: ${result.value.message}`);
      res.status(500).render("events/search", { session, pageError: result.value.message });
      return;
    }
    res.render("events/search", { session, events: result.value });
  }
}

export function CreateEventController(
  service: IEventService,
  logger: ILoggingService,
): IEventController {
  return new EventController(service, logger);
}
