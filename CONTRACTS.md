# CONTRACTS.md

Interface contracts for all service methods and repositories shared between features.
Every team member must read this before writing any code. Changing a contract after
a teammate has built against it is an **Integration Compromise** (−10 points on your
individual sprint score — see `markdown/GRADING.md`).

Changes to this document must be committed to `dev` and reviewed by at least one
affected team member before any dependent code is written.

---

## Feature Ownership Reference

| Member | Feature A | Feature B |
|--------|-----------|-----------|
| Payu | 4 — RSVP Toggle | 9 — Waitlist Promotion |
| Avin | 1 — Event Creation | 3 — Event Editing |
| Khang | 5 — Publishing & Cancellation | 8 — Organizer Dashboard |
| Maithili | 2 — Event Detail Page | 7 — My RSVPs Dashboard |
| Anna | 6 — Category & Date Filter | 10 — Event Search |

---

## Shared Data Types

These are the canonical shapes for the core domain objects. All features use these
exact fields in their in-memory stores and services. Do not add required fields
without updating this document and coordinating with affected teammates.

### Event

```typescript
interface Event {
  id: string;            // UUID, generated at creation
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
```

### Rsvp

```typescript
interface Rsvp {
  id: string;            // UUID, generated at creation
  eventId: string;
  userId: string;
  status: "going" | "waitlisted" | "cancelled";
  createdAt: Date;       // determines waitlist order (ascending)
}
```

---

## Named Error Types

Service methods return typed errors via the `Result` pattern. These are the shared
error types that cross feature boundaries. Feature-specific errors may be defined
locally in `src/<feature>/errors.ts` but must not reuse these names with different
semantics.

### Event errors — `src/events/errors.ts` (owned by Avin)

```typescript
type EventError =
  | { name: "EventNotFoundError";    message: string }  // no event with the given ID
  | { name: "InvalidInputError";     message: string }  // missing/malformed field
  | { name: "UnauthorizedError";     message: string }  // user lacks required role or ownership
  | { name: "InvalidStateError";     message: string }  // event is in a state that disallows the action
  | { name: "InvalidTransitionError"; message: string }; // status change is not allowed
```

### RSVP errors — `src/rsvp/errors.ts` (owned by Payu)

```typescript
type RsvpError =
  | { name: "EventNotFoundError";    message: string }  // event does not exist
  | { name: "InvalidStateError";     message: string }  // event is cancelled or past
  | { name: "UnauthorizedError";     message: string }  // organizer or admin attempting to RSVP
```

---

## Contract 1 — EventRepository Interface

**Owner:** Avin (Feature 1 — Event Creation)  
**Consumers:** Features 2, 3, 5, 6, 7, 8, 10 (all features that read or write events)

The in-memory implementation lives at `src/events/InMemoryEventRepository.ts`.
The Prisma implementation (Sprint 3) lives at `src/events/PrismaEventRepository.ts`.
All other features depend on `IEventRepository` — never on the concrete implementation.

```typescript
interface EventFilters {
  organizerId?: string;                           // Feature 8: filter to organizer's own events
  status?: Event["status"] | Event["status"][];   // filter by one or more statuses
  category?: string;                              // Feature 6: filter by category
  search?: string;                                // Feature 10: match title, description, location
  timeframe?: "upcoming" | "this_week" | "this_weekend"; // Feature 6: date-range filter
}

interface CreateEventData {
  title: string;
  description: string;
  location: string;
  category: string;
  capacity?: number;
  startDatetime: Date;
  endDatetime: Date;
  organizerId: string;
}

interface IEventRepository {
  findById(id: string): Promise<Result<Event, { name: "EventNotFoundError"; message: string }>>;
  findAll(filters?: EventFilters): Promise<Result<Event[], never>>;
  create(data: CreateEventData): Promise<Result<Event, never>>;
  update(
    id: string,
    changes: Partial<Omit<Event, "id" | "createdAt" | "organizerId">>
  ): Promise<Result<Event, { name: "EventNotFoundError"; message: string }>>;
}
```

### `findById(id)`

| | |
|---|---|
| **Parameters** | `id: string` |
| **Success** | `Ok(event: Event)` — the full Event object |
| **Error** | `Err({ name: "EventNotFoundError", message })` — no event with that ID exists |
| **Consumed by** | Features 2, 3, 5, 8, 9 |

### `findAll(filters?)`

| | |
|---|---|
| **Parameters** | `filters?: EventFilters` (all fields optional; omitting returns all events) |
| **Success** | `Ok(events: Event[])` — matching events sorted by `startDatetime` ascending; empty array when no matches |
| **Errors** | none |
| **Consumed by** | Features 6, 7 (via join with RSVPs), 8, 10 |

### `create(data)`

| | |
|---|---|
| **Parameters** | `data: CreateEventData` |
| **Success** | `Ok(event: Event)` — the newly created Event with generated `id`, `status: "draft"`, and `createdAt`/`updatedAt` set to now |
| **Errors** | none (validation is the Service layer's responsibility) |
| **Consumed by** | Feature 1 only |

### `update(id, changes)`

| | |
|---|---|
| **Parameters** | `id: string`, `changes: Partial<Omit<Event, "id" \| "createdAt" \| "organizerId">>` |
| **Success** | `Ok(event: Event)` — the updated Event with `updatedAt` refreshed to now |
| **Error** | `Err({ name: "EventNotFoundError", message })` |
| **Consumed by** | Features 3, 5 |

---

## Contract 2 — RsvpRepository Interface

**Owner:** Payu (Feature 4 — RSVP Toggle)  
**Consumers:** Features 2, 7, 8 (cross-member); Feature 9 (same owner as Payu)

The in-memory implementation lives at `src/rsvp/InMemoryRsvpRepository.ts`.
The Prisma implementation (Sprint 3) lives at `src/rsvp/PrismaRsvpRepository.ts`.

```typescript
interface UpsertRsvpData {
  eventId: string;
  userId: string;
  status: Rsvp["status"];
}

interface IRsvpRepository {
  findByEventId(eventId: string): Promise<Result<Rsvp[], never>>;
  findByUserId(userId: string): Promise<Result<Rsvp[], never>>;
  findByEventAndUser(eventId: string, userId: string): Promise<Result<Rsvp | null, never>>;
  countGoingByEventId(eventId: string): Promise<Result<number, never>>;
  upsert(data: UpsertRsvpData): Promise<Result<Rsvp, never>>;
}
```

### `findByEventId(eventId)`

| | |
|---|---|
| **Parameters** | `eventId: string` |
| **Success** | `Ok(rsvps: Rsvp[])` — all RSVPs for the event sorted by `createdAt` ascending (waitlist order) |
| **Errors** | none |
| **Consumed by** | Feature 9 (waitlist promotion — same owner) |

### `findByUserId(userId)`

| | |
|---|---|
| **Parameters** | `userId: string` |
| **Success** | `Ok(rsvps: Rsvp[])` — all RSVPs for the user across all events, sorted by `createdAt` descending |
| **Errors** | none |
| **Consumed by** | Feature 7 — Maithili |

### `findByEventAndUser(eventId, userId)`

| | |
|---|---|
| **Parameters** | `eventId: string`, `userId: string` |
| **Success** | `Ok(rsvp: Rsvp)` — the existing RSVP record, or `Ok(null)` if the user has no RSVP for this event |
| **Errors** | none |
| **Consumed by** | Feature 2 (render RSVP button state) — Maithili; Feature 4 (toggle logic — same owner) |

### `countGoingByEventId(eventId)`

| | |
|---|---|
| **Parameters** | `eventId: string` |
| **Success** | `Ok(count: number)` — count of RSVPs with `status: "going"` for this event |
| **Errors** | none |
| **Consumed by** | Feature 8 (attendee count per event on dashboard) — Khang; Feature 4 (capacity check — same owner) |

### `upsert(data)`

| | |
|---|---|
| **Parameters** | `data: UpsertRsvpData` |
| **Success** | `Ok(rsvp: Rsvp)` — the created or updated RSVP record |
| **Errors** | none (validation is the Service layer's responsibility) |
| **Consumed by** | Features 4, 9 (same owner) |

---

## Contract 3 — RsvpService.toggleRsvp

**Owner:** Payu (Feature 4)  
**Consumers:** Maithili (Feature 7 — the dashboard cancel button reuses this route via HTMX)

```typescript
interface ToggleRsvpInput {
  eventId: string;
  userId: string;
  userRole: UserRole;  // "admin" | "staff" | "user"
}

toggleRsvp(input: ToggleRsvpInput): Promise<Result<Rsvp, RsvpError>>
```

| | |
|---|---|
| **Success** | `Ok(rsvp: Rsvp)` — the resulting RSVP after the toggle |
| **Error** | `Err({ name: "EventNotFoundError" })` — event does not exist |
| **Error** | `Err({ name: "InvalidStateError" })` — event is `cancelled` or `past` |
| **Error** | `Err({ name: "UnauthorizedError" })` — user role is `staff` or `admin` (only `user` may RSVP) |

**HTTP route:**

```
POST /events/:eventId/rsvp
```

- Returns a partial HTML fragment (HTMX) — `layout: false`
- The response fragment must be usable in two contexts:
  1. Feature 4: the RSVP button on the event detail page
  2. Feature 7: the RSVP row on the My RSVPs dashboard
- **Payu and Maithili must agree on the `hx-target` and `hx-swap` values before Feature 7's Sprint 2 HTMX work begins.** This is the highest coordination risk in the project.

---

## Contract 4 — EventService.publishEvent / EventService.cancelEvent

**Owner:** Khang (Feature 5)  
**Consumers:** Khang (Feature 8 — quick-action controls on the organizer dashboard, same owner)

Documented here because Feature 8 reuses Feature 5's HTTP routes via HTMX. Both
features belong to Khang, so there is no cross-member coordination risk — this
contract is recorded for completeness and to protect against future confusion.

```typescript
interface EventTransitionInput {
  eventId: string;
  actingUserId: string;
  actingUserRole: UserRole;
}

publishEvent(input: EventTransitionInput): Promise<Result<Event, EventError>>
cancelEvent(input: EventTransitionInput): Promise<Result<Event, EventError>>
```

| | |
|---|---|
| **Success** | `Ok(event: Event)` — the Event with the updated status |
| **Error** | `Err({ name: "EventNotFoundError" })` — event does not exist |
| **Error** | `Err({ name: "UnauthorizedError" })` — acting user is not the event's organizer and is not an admin |
| **Error** | `Err({ name: "InvalidTransitionError" })` — the event is not in a valid state for this transition (e.g., `publishEvent` on an already-published event; `cancelEvent` on a `past` event) |

**HTTP routes (reused by Feature 8 quick-actions):**

```
POST /events/:eventId/publish
POST /events/:eventId/cancel
```

---

## Dependency Map Summary

| Who needs it | What they need | From whom |
|---|---|---|
| Khang (Feature 8) | `EventRepository.findAll({ organizerId })` | Avin |
| Khang (Feature 8) | `RsvpRepository.countGoingByEventId` | Payu |
| Maithili (Feature 2) | `EventRepository.findById` | Avin |
| Maithili (Feature 2) | `RsvpRepository.findByEventAndUser` | Payu |
| Maithili (Feature 7) | `RsvpRepository.findByUserId` | Payu |
| Maithili (Feature 7) | `EventRepository.findById` (to join event details) | Avin |
| Maithili (Feature 7) | `POST /events/:eventId/rsvp` route (Sprint 2) | Payu |
| Anna (Feature 6) | `EventRepository.findAll({ category, timeframe })` | Avin |
| Anna (Feature 10) | `EventRepository.findAll({ search })` | Avin |
