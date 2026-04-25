import type { Result } from "../lib/result";

export interface Rsvp {
  id: string;
  eventId: string;
  userId: string;
  status: "going" | "waitlisted" | "cancelled";
  createdAt: Date;
}

export interface UpsertRsvpData {
  eventId: string;
  userId: string;
  status: Rsvp["status"];
}

export interface IRsvpRepository {
  /**
   * All RSVPs for a given event, sorted by createdAt ascending (waitlist order).
   * Consumed by: Feature 9 (waitlist promotion)
   */
  findByEventId(eventId: string): Promise<Result<Rsvp[], never>>;

  /**
   * All RSVPs for a given user across all events, sorted by createdAt descending.
   * Consumed by: Feature 7 (Maithili — My RSVPs dashboard)
   */
  findByUserId(userId: string): Promise<Result<Rsvp[], never>>;

  /**
   * The single RSVP record for a (event, user) pair, or null if none exists.
   * Consumed by: Feature 2 (Maithili — render RSVP button state), Feature 4 (toggle logic)
   */
  findByEventAndUser(eventId: string, userId: string): Promise<Result<Rsvp | null, never>>;

  /**
   * Count of RSVPs with status "going" for a given event.
   * Consumed by: Feature 8 (Khang — attendee count on organizer dashboard), Feature 4 (capacity check)
   */
  countGoingByEventId(eventId: string): Promise<Result<number, never>>;

  /**
   * Create a new RSVP or update the status of an existing one for the same (event, user) pair.
   * Consumed by: Features 4, 9 (same owner)
   */
  upsert(data: UpsertRsvpData): Promise<Result<Rsvp, never>>;

  /**
   * Atomically cancel one going RSVP and promote one waitlisted RSVP to going.
   * Optional: in-memory repos omit this and the service falls back to a manual rollback.
   * Prisma repo implements this with $transaction to satisfy the Sprint 3 atomicity requirement.
   * Returns the cancelled RSVP.
   */
  atomicCancelAndPromote?(
    eventId: string,
    cancelUserId: string,
    promoteUserId: string,
  ): Promise<Result<Rsvp, never>>;
}
