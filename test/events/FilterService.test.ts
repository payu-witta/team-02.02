import { CreateEventFilterService } from "../../src/events/EventService";
import type { IEventRepository } from "../../src/events/InEventRepository";
import { Ok } from "../../src/lib/result";

describe("CreateEventFilterService - filterEvents", () => {
    let mockRepo: jest.Mocked<IEventRepository>;
    let service: ReturnType<typeof CreateEventFilterService>;

    beforeEach(() => {
        mockRepo = {
            findById: jest.fn(),
            findAll: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        };
        mockRepo.findAll.mockResolvedValue(Ok([]));
        service = CreateEventFilterService(mockRepo);
    });

    it("returns all published events when no filters are given", async () => {
        await service.filterEvents({});
        expect(mockRepo.findAll).toHaveBeenCalledWith({ status: "published" });
    });

    it("filters by a valid category", async ()=> {
        await service.filterEvents({ category: "social" });
        expect(mockRepo.findAll).toHaveBeenCalledWith({ status: "published", category: "social" });
    });

    it("filters by a valid timeframe", async () => {
        await service.filterEvents({ timeframe: "this_week" });
        expect(mockRepo.findAll).toHaveBeenCalledWith({ status: "published", timeframe: "this_week" });
    });

    it("filters both category and timeframe together", async ()=> {
        await service.filterEvents({ category: "volunteer", timeframe: "this_weekend"});
        expect(mockRepo.findAll).toHaveBeenCalledWith({ status: "published", category: "volunteer", timeframe: "this_weekend"});
    });

    it("returns InvalidCategoryError for an unrecognized cateogry", async ()=> {
        const result = await service.filterEvents({ category: "invalid-cat" });
        expect(result.ok).toBe(false);
        if(!result.ok) expect(result.value.name).toBe("InvalidCategoryError");
    });

    it("returns InvalidTimeframeError for an unrecognized timeframe", async ()=> {
        const result = await service.filterEvents({ timeframe: "next-month" as any });
        expect(result.ok).toBe(false);
        if(!result.ok) expect(result.value.name).toBe("InvalidTimeframeError");
    });

})