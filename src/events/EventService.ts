import type { Result } from "../lib/result";
import { Ok } from "../lib/result";
import type { Event, EventFilters, IEventRepository } from "./types";

export interface IEventService {
  /**
   * Feature 6: published upcoming events, optionally narrowed by category and timeframe.
   */
  listPublishedUpcoming(filters?: Pick<EventFilters, "category" | "timeframe">): Promise<
    Result<Event[], never>
  >;
}

export class EventService implements IEventService {
  constructor(private readonly events: IEventRepository) {}

  async listPublishedUpcoming(
    filters: Pick<EventFilters, "category" | "timeframe"> = {},
  ): Promise<Result<Event[], never>> {
    // Published + upcoming baseline; category/timeframe narrow further (Feature 6).
    const repoResult = await this.events.findAll({
      status: "published",
      timeframe: "upcoming",
      ...filters,
    });
    if (!repoResult.ok) {
      // findAll has no errors by contract, but keep Result shape consistent.
      return Ok([]);
    }
    return repoResult;
  }
}

export function CreateEventService(events: IEventRepository): IEventService {
  return new EventService(events);
}

