import { CreateEventService } from "../../src/events/EventService";
import type { IEventRepository } from "../../src/events/InEventRepository";
import { Ok } from "../../src/lib/result";

describe("CreateEventService - searchEvents", () => {
  let mockRepo: jest.Mocked<IEventRepository>;
  let service: ReturnType<typeof CreateEventService>;

  beforeEach(() => {
    mockRepo = {
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
  
    const mockRsvpRepo = {
      countGoingByEventId: jest.fn(),
    } as any;
  
    mockRepo.findAll.mockResolvedValue(Ok([]));
    service = CreateEventService(mockRepo, mockRsvpRepo);
  });

  it("returns all published upcoming events for an empty query", async () => {
    await service.searchEvents({ query: "" });
    expect(mockRepo.findAll).toHaveBeenCalledWith({ status: "published", timeframe: "upcoming" });
  });

  it("treats a whitespace-only query as empty", async () => {
    await service.searchEvents({ query: "   " });
    expect(mockRepo.findAll).toHaveBeenCalledWith({ status: "published", timeframe: "upcoming" });
  });

  it("passes the trimmed query to findAll", async () => {
    await service.searchEvents({ query: "park" });
    expect(mockRepo.findAll).toHaveBeenCalledWith({
      status: "published",
      timeframe: "upcoming",
      search: "park",
    });
  });

  it("returns Ok with an empty array when there are no matches", async () => {
    mockRepo.findAll.mockResolvedValue(Ok([]));
    const result = await service.searchEvents({ query: "zzznomatch" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(0);
  });

  it("returns InvalidSearchError when query exceeds 200 characters", async () => {
    const result = await service.searchEvents({ query: "a".repeat(201) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.value.name).toBe("InvalidSearchError");
  });
});