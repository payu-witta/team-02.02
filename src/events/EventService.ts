import { Result, Ok, Err } from "../lib/result";
import type { IEventRepository, Event, CreateEventData, EventFilters } from "./InEventRepository";
import type { IEventService, CreateEventInput, EditEventInput, SearchEventsInput } from "./IEventService";
import type { EventError } from "./errors";
import {
  EventNotFoundError,
  InvalidInputError,
  UnauthorizedError,
  InvalidStateError,
  InvalidTransitionError,
} from "./errors";
import type { IRsvpRepository } from "../rsvp/InRsvpRepository";

const VALID_CATEGORIES = [
  "social",
  "educational",
  "volunteer",
  "sports",
  "arts",
] as const;

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
    if (
      !fields.category ||
      !(VALID_CATEGORIES as readonly string[]).includes(fields.category)
    ) {
      return InvalidInputError(
        `Category must be one of: ${VALID_CATEGORIES.join(", ")}.`,
      );
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

  if (start && end && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
    if (end <= start) {
      return InvalidInputError("End date/time must be after start date/time.");
    }
  }

  return null;
}

export { validateFields };

export function CreateEventService(repo: IEventRepository): IEventService {
  return {
    async getEventById(id: string) {
      const result = await repo.findById(id);
      if (result.ok === false) {
        return Err(EventNotFoundError(result.value.message));
      }
      return Ok(result.value);
    },

    async createEvent(input: CreateEventInput) {
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

      const data: CreateEventData = {
        title: input.title.trim(),
        description: input.description.trim(),
        location: input.location.trim(),
        category: input.category,
        capacity: input.capacity,
        startDatetime: input.startDatetime,
        endDatetime: input.endDatetime,
        organizerId: input.organizerId,
      };

      return repo.create(data);
    },

    async editEvent(input: EditEventInput) {
      const findResult = await repo.findById(input.eventId);
      if (findResult.ok === false) {
        return Err(EventNotFoundError(findResult.value.message));
      }

      const event = findResult.value;

      if (input.actingUserRole === "user") {
        return Err(UnauthorizedError("Members cannot edit events."));
      }
      if (
        input.actingUserRole === "staff" &&
        event.organizerId !== input.actingUserId
      ) {
        return Err(UnauthorizedError("You can only edit events you have created."));
      }

      if (event.status === "cancelled" || event.status === "past") {
        return Err(InvalidStateError(`Cannot edit a ${event.status} event.`));
      }

      const candidateStart =
        input.startDatetime !== undefined ? input.startDatetime : event.startDatetime;
      const candidateEnd =
        input.endDatetime !== undefined ? input.endDatetime : event.endDatetime;

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

      const updateResult = await repo.update(input.eventId, changes);
      if (updateResult.ok === false) {
        return Err(EventNotFoundError(updateResult.value.message));
      }

      return Ok(updateResult.value);
    },

    // Feature 10 - Event Search (Sprint 1)
    async searchEvents(input: SearchEventsInput) {
      const query = input.query.trim();
      const filters = {
        status: "published" as const,
        timeframe: "upcoming" as const,
        ...(query.length > 0 ? { search: query } : {}),
      };
      return repo.findAll(filters);
    },
  };
}


export interface EventTransitionInput {
  eventId: string;
  actingUserId: string;
  actingUserRole: string;
}

export class EventService {
  constructor(
    private eventRepo: IEventRepository,
    private rsvpRepo: IRsvpRepository,
  ) {}

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

  // Feature 8
  async getOrganizerDashboard(actingUserId: string, role: string) {
    const filter = role === "admin" ? {} : { organizerId: actingUserId };
    const eventsResult = await this.eventRepo.findAll(filter);
    
    if (!eventsResult.ok) return eventsResult;

    const eventsWithCounts = await Promise.all(
      eventsResult.value.map(async (event) => {
        const countResult = await this.rsvpRepo.countGoingByEventId(event.id);
        return {
          ...event,
          attendeeCount: countResult.ok ? countResult.value : 0
        };
      })
    );

    return Ok({
      published: eventsWithCounts.filter(e => e.status === "published"),
      draft: eventsWithCounts.filter(e => e.status === "draft"),
      archived: eventsWithCounts.filter(e => e.status === "cancelled" || e.status === "past")
    }); 
  }
}

export interface FilterEventsInput {
  category?: string;
  timeframe?: "upcoming" | "this_week" |"this_weekend";
}

export interface IEventFilterService {
  filterEvents(input: FilterEventsInput): Promise<Result<Event[], EventError>>;
}

export function CreateEventFilterService(repo: IEventRepository): IEventFilterService {
  return {
    async filterEvents(input: FilterEventsInput) {
      const filters: EventFilters = {
        status: "published" as const,
        ...(input.category ? { category: input.category } : {}),
        ...(input.timeframe ? { timeframe: input.timeframe } : {}),
      };
      return repo.findAll(filters);
    },
  };
}

