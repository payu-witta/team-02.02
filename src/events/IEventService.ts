import type { Result } from "../lib/result";
import type { UserRole } from "../auth/User";
import type { Event } from "./InEventRepository";
import type { EventError, SearchError, FilterError } from "./errors";
import type { FilterEventsInput } from "./EventService";

export interface CreateEventInput {
  title: string;
  description: string;
  location: string;
  category: string;
  capacity?: number;
  startDatetime: Date;
  endDatetime: Date;
  organizerId: string;
  organizerRole: UserRole;
}

// number = set capacity, null = remove limit, undefined = leave unchanged
export interface EditEventInput {
  eventId: string;
  actingUserId: string;
  actingUserRole: UserRole;
  title?: string;
  description?: string;
  location?: string;
  category?: string;
  capacity?: number | null;
  startDatetime?: Date;
  endDatetime?: Date;
}

export interface SearchEventsInput {
  query: string;
}

export interface EventTransitionInput {
  eventId: string;
  actingUserId: string;
  actingUserRole: UserRole;
}

export interface OrganizerDashboardData {
  published: (Event & { attendeeCount: number })[];
  draft: (Event & { attendeeCount: number })[];
  archived: (Event & { attendeeCount: number })[];
}

export interface IEventService {
  getEventById(id: string): Promise<Result<Event, EventError>>;
  createEvent(input: CreateEventInput): Promise<Result<Event, EventError>>;
  editEvent(input: EditEventInput): Promise<Result<Event, EventError>>;

  publishEvent(input: EventTransitionInput): Promise<Result<Event, EventError>>;
  cancelEvent(input: EventTransitionInput): Promise<Result<Event, EventError>>;
  getOrganizerDashboard(
    userId: string,
    role: UserRole,
  ): Promise<Result<OrganizerDashboardData, EventError>>;
  filterEvents(input: FilterEventsInput): Promise<Result<Event[], EventError | FilterError>>;
  searchEvents(input: SearchEventsInput): Promise<Result<Event[], EventError | SearchError>>;
}
