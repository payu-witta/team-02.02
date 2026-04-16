import type { Result } from "../lib/result";

export type EventStatus = "draft" | "published" | "cancelled" | "past";

export interface Event {
  id: string; // UUID, generated at creation
  title: string;
  description: string;
  location: string;
  category: string; // "social" | "educational" | "volunteer" | "sports" | "arts"
  status: EventStatus;
  capacity?: number; // undefined = no capacity limit
  startDatetime: Date;
  endDatetime: Date;
  organizerId: string; // userId from session
  createdAt: Date;
  updatedAt: Date;
}

export interface EventFilters {
  organizerId?: string; // Feature 8
  status?: Event["status"] | Event["status"][]; // filter by one or more statuses
  category?: string; // Feature 6
  search?: string; // Feature 10
  timeframe?: "upcoming" | "this_week" | "this_weekend"; // Feature 6
}

export interface CreateEventData {
  title: string;
  description: string;
  location: string;
  category: string;
  capacity?: number;
  startDatetime: Date;
  endDatetime: Date;
  organizerId: string;
}

export interface IEventRepository {
  findById(
    id: string,
  ): Promise<Result<Event, { name: "EventNotFoundError"; message: string }>>;
  findAll(filters?: EventFilters): Promise<Result<Event[], never>>;
  create(data: CreateEventData): Promise<Result<Event, never>>;
  update(
    id: string,
    changes: Partial<Omit<Event, "id" | "createdAt" | "organizerId">>,
  ): Promise<Result<Event, { name: "EventNotFoundError"; message: string }>>;
}

