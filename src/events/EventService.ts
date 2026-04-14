import { Ok, Err } from "../lib/result";
import type { IEventRepository, Event, CreateEventData } from "./IEventRepository";
import type { IEventService, CreateEventInput, EditEventInput } from "./IEventService";
import type { EventError } from "./errors";
import {
  EventNotFoundError,
  InvalidInputError,
  UnauthorizedError,
  InvalidStateError,
} from "./errors";

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
  }
  if (requireAll || fields.description !== undefined) {
    if (!fields.description || fields.description.trim().length === 0) {
      return InvalidInputError("Description is required.");
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
      if (!result.ok) {
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
      if (!findResult.ok) {
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

      // Merge candidate values so cross-field validation uses the full picture.
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
      if (!updateResult.ok) {
        return Err(EventNotFoundError(updateResult.value.message));
      }

      return Ok(updateResult.value);
    },
  };
}
