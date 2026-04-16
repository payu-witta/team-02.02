import type { Result } from "../lib/result";

export interface Event {
  id: string;
  title: string;
  description: string;
  location: string;
  category: string;
  status: "draft" | "published" | "cancelled" | "past";
  capacity?: number;
  startDatetime: Date;
  endDatetime: Date;
  organizerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventFilters {
  organizerId?: string;
  status?: Event["status"] | Event["status"][];
  category?: string;
  search?: string;
  timeframe?: "upcoming" | "this_week" | "this_weekend";
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
