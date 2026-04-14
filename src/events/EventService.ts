import { Result, Ok, Err } from "../lib/result";
import { IEventRepository, Event } from "./InEventRepository";
import { IRsvpRepository } from "../rsvp/InRsvpRepository"; 
import { EventError } from "./errors";


export interface EventTransitionInput {
  eventId: string;
  actingUserId: string;
  actingUserRole: string; 
}

export class EventService {
  constructor(
    private eventRepo: IEventRepository,
    private rsvpRepo: IRsvpRepository
  ) {}

  // Feature 5
  async publishEvent(input: EventTransitionInput): Promise<Result<Event, EventError>> {
    const eventResult = await this.eventRepo.findById(input.eventId);
    if (!eventResult.ok) return eventResult;

    const event = eventResult.value;

    if (event.organizerId !== input.actingUserId && input.actingUserRole !== "admin") {
      return Err<EventError>({ name: "UnauthorizedError", message: "Only organizers or admins can publish." });
    }

    if (event.status !== "draft") {
      return Err<EventError>({ name: "InvalidTransitionError", message: "Only draft events can be published." });
    }

    return await this.eventRepo.update(input.eventId, { status: "published" });
  }

  async cancelEvent(input: EventTransitionInput): Promise<Result<Event, EventError>> {
    const eventResult = await this.eventRepo.findById(input.eventId);
    if (!eventResult.ok) return eventResult;

    const event = eventResult.value;

    if (event.organizerId !== input.actingUserId && input.actingUserRole !== "admin") {
      return Err<EventError>({ name: "UnauthorizedError", message: "Only organizers or admins can cancel." });
    }

    if (event.status === "past" || event.status === "cancelled") {
      return Err<EventError>({ name: "InvalidTransitionError", message: `Cannot cancel a ${event.status} event.` });
    }

    return await this.eventRepo.update(input.eventId, { status: "cancelled" });
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