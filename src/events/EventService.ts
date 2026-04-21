import { Result, Ok, Err } from "../lib/result";
import type { IEventRepository, Event, EventFilters } from "./InEventRepository";
import type {
  IEventService,
  CreateEventInput,
  EditEventInput,
  EventTransitionInput,
  OrganizerDashboardData,
  SearchEventsInput,
} from "./IEventService";
import type { EventError, FilterError } from "./errors";
import {
  EventNotFoundError,
  InvalidInputError,
  UnauthorizedError,
  InvalidStateError,
  InvalidTransitionError,
  InvalidCategoryError,
  InvalidTimeframeError,
} from "./errors";
import type { IRsvpRepository } from "../rsvp/InRsvpRepository";
import type { UserRole } from "../auth/User";

const VALID_CATEGORIES = ["social", "educational", "volunteer", "sports", "arts"] as const;

function validateFields(
  fields: {
    title?: string;
    description?: string;
    location?: string;
    category?: string;
    capacity?: number | null;
    startDatetime?: Date;
    endDatetime?: Date;
  },
  requireAll: boolean,
): EventError | null {
  if (requireAll || fields.title !== undefined) {
    if (!fields.title || fields.title.trim().length === 0) {
      return InvalidInputError("Title is required.");
    }
    if (fields.title.trim().length > 100) {
      return InvalidInputError("Title must be 100 characters or fewer.");
    }
  }
  if (requireAll || fields.description !== undefined) {
    if (!fields.description || fields.description.trim().length === 0) {
      return InvalidInputError("Description is required.");
    }
    if (fields.description.trim().length > 1000) {
      return InvalidInputError("Description must be 1000 characters or fewer.");
    }
  }
  if (requireAll || fields.location !== undefined) {
    if (!fields.location || fields.location.trim().length === 0) {
      return InvalidInputError("Location is required.");
    }
  }
  if (requireAll || fields.category !== undefined) {
    if (!fields.category || !(VALID_CATEGORIES as readonly string[]).includes(fields.category)) {
      return InvalidInputError(`Category must be one of: ${VALID_CATEGORIES.join(", ")}.`);
    }
  }
  if (fields.capacity !== undefined && fields.capacity !== null) {
    if (!Number.isInteger(fields.capacity) || fields.capacity <= 0) {
      return InvalidInputError("Capacity must be a positive whole number.");
    }
  }

  const start = fields.startDatetime;
  const end = fields.endDatetime;

  if (requireAll) {
    if (!start || isNaN(start.getTime())) {
      return InvalidInputError("Start date/time is required.");
    }
    if (!end || isNaN(end.getTime())) {
      return InvalidInputError("End date/time is required.");
    }
  }

  if (start && end && !isNaN(start.getTime()) && !isNaN(end.getTime()) && end <= start) {
    return InvalidInputError("End date/time must be after start date/time.");
  }

  return null;
}

export { validateFields };

export class EventService implements IEventService {
  constructor(
    private readonly eventRepo: IEventRepository,
    private readonly rsvpRepo: IRsvpRepository,
  ) {}

  async getEventById(id: string): Promise<Result<Event, EventError>> {
    const result = await this.eventRepo.findById(id);
    if (result.ok === false) {
      return Err(EventNotFoundError(result.value.message));
    }
    return Ok(result.value);
  }

  async createEvent(input: CreateEventInput): Promise<Result<Event, EventError>> {
    if (input.organizerRole !== "staff" && input.organizerRole !== "admin") {
      return Err(UnauthorizedError("Only organizers and admins can create events."));
    }

    const err = validateFields(
      {
        title: input.title,
        description: input.description,
        location: input.location,
        category: input.category,
        capacity: input.capacity,
        startDatetime: input.startDatetime,
        endDatetime: input.endDatetime,
      },
      true,
    );
    if (err) return Err(err);

    if (input.startDatetime <= new Date()) {
      return Err(InvalidInputError("Start date/time must be in the future."));
    }

    return this.eventRepo.create({
      title: input.title.trim(),
      description: input.description.trim(),
      location: input.location.trim(),
      category: input.category,
      capacity: input.capacity,
      startDatetime: input.startDatetime,
      endDatetime: input.endDatetime,
      organizerId: input.organizerId,
    });
  }

  async editEvent(input: EditEventInput): Promise<Result<Event, EventError>> {
    const findResult = await this.eventRepo.findById(input.eventId);
    if (findResult.ok === false) {
      return Err(EventNotFoundError(findResult.value.message));
    }

    const event = findResult.value;

    if (input.actingUserRole === "user") {
      return Err(UnauthorizedError("Members cannot edit events."));
    }
    if (input.actingUserRole === "staff" && event.organizerId !== input.actingUserId) {
      return Err(UnauthorizedError("You can only edit events you have created."));
    }
    if (event.status === "cancelled" || event.status === "past") {
      return Err(InvalidStateError(`Cannot edit a ${event.status} event.`));
    }

    const candidateStart =
      input.startDatetime !== undefined ? input.startDatetime : event.startDatetime;
    const candidateEnd = input.endDatetime !== undefined ? input.endDatetime : event.endDatetime;

    const err = validateFields(
      {
        title: input.title,
        description: input.description,
        location: input.location,
        category: input.category,
        capacity: input.capacity,
        startDatetime: candidateStart,
        endDatetime: candidateEnd,
      },
      false,
    );
    if (err) return Err(err);

    const changes: Partial<Omit<Event, "id" | "createdAt" | "organizerId">> = {};
    if (input.title !== undefined) changes.title = input.title.trim();
    if (input.description !== undefined) changes.description = input.description.trim();
    if (input.location !== undefined) changes.location = input.location.trim();
    if (input.category !== undefined) changes.category = input.category;
    if (input.capacity !== undefined) changes.capacity = input.capacity ?? undefined;
    if (input.startDatetime !== undefined) changes.startDatetime = input.startDatetime;
    if (input.endDatetime !== undefined) changes.endDatetime = input.endDatetime;


    const updateResult = await this.eventRepo.update(input.eventId, changes);
    if (updateResult.ok === false) {
      return Err(EventNotFoundError(updateResult.value.message));
    }


    return Ok(updateResult.value);
  }

  async publishEvent(input: EventTransitionInput): Promise<Result<Event, EventError>> {
    const eventResult = await this.eventRepo.findById(input.eventId);
    if (!eventResult.ok) return eventResult;

    const event = eventResult.value;
    if (event.organizerId !== input.actingUserId && input.actingUserRole !== "admin") {
      return Err(UnauthorizedError("Only organizers or admins can publish."));
    }
    if (event.status !== "draft") {
      return Err(InvalidTransitionError("Only draft events can be published."));
    }

    return this.eventRepo.update(input.eventId, { status: "published" });
  }

  async cancelEvent(input: EventTransitionInput): Promise<Result<Event, EventError>> {
    const eventResult = await this.eventRepo.findById(input.eventId);
    if (!eventResult.ok) return eventResult;

    const event = eventResult.value;
    if (event.organizerId !== input.actingUserId && input.actingUserRole !== "admin") {
      return Err(UnauthorizedError("Only organizers or admins can cancel."));
    }
    if (event.status === "past" || event.status === "cancelled") {
      return Err(InvalidTransitionError(`Cannot cancel a ${event.status} event.`));
    }

    return this.eventRepo.update(input.eventId, { status: "cancelled" });
  }


  async getOrganizerDashboard(
    actingUserId: string,
    role: UserRole,
  ): Promise<Result<OrganizerDashboardData, EventError>> {
    const filter = role === "admin" ? {} : { organizerId: actingUserId };
    const eventsResult = await this.eventRepo.findAll(filter);

    if (!eventsResult.ok) {

      return Err(InvalidStateError("Failed to fetch events."));

    }

    const eventsWithCounts = await Promise.all(
      eventsResult.value.map(async (event) => {
        const countResult = await this.rsvpRepo.countGoingByEventId(event.id);

        return {
          ...event,
          attendeeCount: countResult.ok ? countResult.value : 0,
        };
      }),
    );

    return Ok({
      published: eventsWithCounts.filter((e) => e.status === "published"),
      draft: eventsWithCounts.filter((e) => e.status === "draft"),
      archived: eventsWithCounts.filter((e) => e.status === "cancelled" || e.status === "past"),
    });
  }

  async searchEvents(input: SearchEventsInput): Promise<Result<Event[], EventError>> {
    const query = input.query.trim();
    const filters: EventFilters = {
      status: "published",
      timeframe: "upcoming",
      ...(query.length > 0 ? { search: query } : {}),
    };
    return this.eventRepo.findAll(filters);
  }
}


export function CreateEventService(
  eventRepo: IEventRepository,
  rsvpRepo: IRsvpRepository,
): IEventService {
  return new EventService(eventRepo, rsvpRepo);
}

export interface FilterEventsInput {
  category?: string;
  timeframe?: "upcoming" | "this_week" | "this_weekend";
}

export interface IEventFilterService {
  filterEvents(input: FilterEventsInput): Promise<Result<Event[], EventError | FilterError>>;
}

export function CreateEventFilterService(repo: IEventRepository): IEventFilterService {
  return {
    async filterEvents(input: FilterEventsInput) {
      const VALID_TIMEFRAMES = ["upcoming", "this_week", "this_weekend"] as const;

      if (input.category !== undefined && !VALID_CATEGORIES.includes(input.category as any)) {
        return Err(InvalidCategoryError('Invalid category "${input.category}". Must be one of: ${VALID_CATEGORIES.join(", ")}.'));
      }

      if (input.timeframe !== undefined && !VALID_TIMEFRAMES.includes(input.timeframe as any)) {
        return Err(InvalidTimeframeError('Invalid timeframe: "${input.timeframe}". Must be one of: ${VALID_TIMEFRAMES.join(", ")}.'));
      }

      return repo.findAll({
        status: "published",
        ...(input.category ? { category: input.category } : {}),
        ...(input.timeframe ? { timeframe: input.timeframe } : {}),
      })
    },
  };
}
