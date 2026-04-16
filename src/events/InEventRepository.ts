// Owned by Avin (Feature 1 — Event Creation). Scaffolded here as a compile-time
// dependency for the RSVP service. Avin provides the in-memory and Prisma implementations.
// Interface shape is locked per CONTRACTS.md — do not modify without team sign-off.

import type { Result } from "../lib/result";
import type { EventError } from "./errors";

export interface Event {
  id: string;
  title: string;
  description: string;
  location: string;
  category: string;      // "social" | "educational" | "volunteer" | "sports" | "arts"
  status: "draft" | "published" | "cancelled" | "past";
  capacity?: number;     // undefined = no capacity limit
  startDatetime: Date;
  endDatetime: Date;
  organizerId: string;   // userId from session
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
  findById(id: string): Promise<Result<Event, EventError>>;
  findAll(filters?: EventFilters): Promise<Result<Event[], never>>;
  create(data: CreateEventData): Promise<Result<Event, never>>;
  update(
    id: string,
    changes: Partial<Omit<Event, "id" | "createdAt" | "organizerId">>,
  ): Promise<Result<Event, EventError>>;
}
