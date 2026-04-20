import type { UserRole } from "../auth/User";
//import type { Event } from "./Event";
//import type { Rsvp } from "../rsvp/Rsvp";
import type { Event, IEventRepository } from "./InEventRepository";
import type { Rsvp, IRsvpRepository } from "../rsvp/InRsvpRepository";
import { Err, Ok, type Result } from "../lib/result";

type EventNotFoundError = {
  name: "EventNotFoundError";
  message: string;
};

export type EventDetailView = {
  event: Event;
  attendeeCount: number;
  currentUserRsvp: Rsvp | null;
  canEdit: boolean;
  canCancel: boolean;
  showRsvpButton: boolean;
};

export interface IEventDetailService {
  getEventDetail(input: {
    eventId: string;
    actingUserId: string;
    actingUserRole: UserRole;
  }): Promise<Result<EventDetailView, EventNotFoundError>>;
}

class EventDetailService implements IEventDetailService {
  constructor(
    private readonly eventRepository: IEventRepository,
    private readonly rsvpRepository: IRsvpRepository,
  ) {}

  async getEventDetail(input: {
    eventId: string;
    actingUserId: string;
    actingUserRole: UserRole;
  }): Promise<Result<EventDetailView, EventNotFoundError>> {
    const eventResult = await this.eventRepository.findById(input.eventId);

    if (!eventResult.ok) {
        const notFoundError: EventNotFoundError = {
            name: "EventNotFoundError",
            message: "Event not found",
        };
        return Err(notFoundError);
    }

    const event = eventResult.value;
    const isOwner = event.organizerId === input.actingUserId;
    const isAdmin = input.actingUserRole === "admin";

    if (event.status === "draft" && !isOwner && !isAdmin) {
      return Err<EventNotFoundError>({
        name: "EventNotFoundError",
        message: "Event not found",
      });
    }

    const rsvpResult = await this.rsvpRepository.findByEventAndUser(
      input.eventId,
      input.actingUserId,
    );
    const attendeeCountResult = await this.rsvpRepository.countGoingByEventId(input.eventId);

    const currentUserRsvp = rsvpResult.ok ? rsvpResult.value : null;
    const attendeeCount = attendeeCountResult.ok ? attendeeCountResult.value : 0;

    return Ok({
      event,
      attendeeCount,
      currentUserRsvp,
      canEdit: isOwner || isAdmin,
      canCancel: isOwner || isAdmin,
      showRsvpButton: input.actingUserRole === "user",
    });
  }
}

export function CreateEventDetailService(
  eventRepository: IEventRepository,
  rsvpRepository: IRsvpRepository,
): IEventDetailService {
  return new EventDetailService(eventRepository, rsvpRepository);
}