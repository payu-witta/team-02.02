import type { Result } from "../lib/result";
import type { UserRole } from "../auth/User";
import type { Event } from "./InEventRepository";
import type { EventError } from "./errors";

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

export interface IEventService {
  getEventById(id: string): Promise<Result<Event, EventError>>;
  createEvent(input: CreateEventInput): Promise<Result<Event, EventError>>;
  editEvent(input: EditEventInput): Promise<Result<Event, EventError>>;
}

export interface EventTransitionInput {
  eventId: string;
  actingUserId: string;
  actingUserRole: string;
}
