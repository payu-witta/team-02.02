import { EventService, EventTransitionInput } from "../../src/events/EventService"; // adjust path
import { IEventRepository } from "../../src/events/InEventRepository";
import { IRsvpRepository } from "../../src/rsvp/InRsvpRepository";
import { Ok, Err } from "../../src/lib/result";

describe("EventService - Transitions", () => {
  let service: EventService;
  let mockEventRepo: jest.Mocked<IEventRepository>;
  let mockRsvpRepo: jest.Mocked<IRsvpRepository>;

  beforeEach(() => {
    // Create mocked repositories
    mockEventRepo = {
      findById: jest.fn(),
      update: jest.fn(),
    } as any;

    mockRsvpRepo = {} as any;

    service = new EventService(mockEventRepo, mockRsvpRepo);
  });

  describe("publishEvent", () => {
    const input: EventTransitionInput = {
      eventId: "evt-123",
      actingUserId: "user-1",
      actingUserRole: "user",
    };

    it("should return UnauthorizedError if user is not organizer or admin", async () => {
      mockEventRepo.findById.mockResolvedValue(Ok({
        id: "evt-123",
        organizerId: "different-user",
        status: "draft",
      } as any));

      const result = await service.publishEvent(input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.name).toBe("UnauthorizedError");
      }
    });

    it("should return InvalidTransitionError if status is not 'draft'", async () => {
      mockEventRepo.findById.mockResolvedValue(Ok({
        id: "evt-123",
        organizerId: "user-1",
        status: "published",
      } as any));

      const result = await service.publishEvent(input);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.name).toBe("InvalidTransitionError");
      }
    });

    it("should update status to 'published' on success", async () => {
      mockEventRepo.findById.mockResolvedValue(Ok({
        id: "evt-123",
        organizerId: "user-1",
        status: "draft",
      } as any));
      
      mockEventRepo.update.mockResolvedValue(Ok({ id: "evt-123", status: "published" } as any));

      const result = await service.publishEvent(input);

      expect(result.ok).toBe(true);
      expect(mockEventRepo.update).toHaveBeenCalledWith("evt-123", { status: "published" });
    });
  });

  describe("cancelEvent", () => {
    it("should allow an admin to cancel even if they aren't the organizer", async () => {
      const adminInput = { eventId: "evt-123", actingUserId: "admin-1", actingUserRole: "admin" };
      
      mockEventRepo.findById.mockResolvedValue(Ok({
        id: "evt-123",
        organizerId: "someone-else",
        status: "published",
      } as any));

      mockEventRepo.update.mockResolvedValue(Ok({ id: "evt-123", status: "cancelled" } as any));

      const result = await service.cancelEvent(adminInput);

      expect(result.ok).toBe(true);
      expect(mockEventRepo.update).toHaveBeenCalledWith("evt-123", { status: "cancelled" });
    });

    it("should fail if trying to cancel a 'past' event", async () => {
      mockEventRepo.findById.mockResolvedValue(Ok({
        id: "evt-123",
        organizerId: "user-1",
        status: "past",
      } as any));

      const result = await service.cancelEvent({
        eventId: "evt-123",
        actingUserId: "user-1",
        actingUserRole: "user"
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.name).toBe("InvalidTransitionError");
      }
    });
  });
});