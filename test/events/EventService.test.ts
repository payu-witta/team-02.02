import { EventService } from "../../src/events/EventService";
import {EventTransitionInput} from "../../src/events/IEventService";
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
      findAll: jest.fn(),
    } as any;

    mockRsvpRepo = {
      countGoingByEventId: jest.fn(),
    } as any;

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
      const adminInput: EventTransitionInput = { eventId: "evt-123", actingUserId: "admin-1", actingUserRole: "admin" };
      
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
      } as EventTransitionInput);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.name).toBe("InvalidTransitionError");
      }
    });
  });

  describe("cancelEvent Transitions", () => {
    it("should return UnauthorizedError if a non-owner Staff tries to cancel", async () => {
      mockEventRepo.findById.mockResolvedValue(Ok({
        id: "evt-123",
        organizerId: "owner-id",
        status: "published",
      } as any));

      const result = await service.cancelEvent({
        eventId: "evt-123",
        actingUserId: "not-the-owner",
        actingUserRole: "staff"
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.name).toBe("UnauthorizedError");
      }
    });

    // Add this to satisfy "Once cancelled, an event cannot be restored"
    it("should fail if trying to cancel an already 'cancelled' event", async () => {
      mockEventRepo.findById.mockResolvedValue(Ok({
        id: "evt-123",
        organizerId: "user-1",
        status: "cancelled",
      } as any));

      const result = await service.cancelEvent({
        eventId: "evt-123",
        actingUserId: "user-1",
        actingUserRole: "staff"
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.value.name).toBe("InvalidTransitionError");
      }
    });
  });

  describe("getOrganizerDashboard", () => {
    const mockEvents = [
      { id: "e1", status: "published", organizerId: "user-1" },
      { id: "e2", status: "draft", organizerId: "user-1" },
      { id: "e3", status: "past", organizerId: "user-1" },
      { id: "e4", status: "cancelled", organizerId: "user-1" },
    ];

    it("should fetch all events for admins and group them correctly", async () => {
      mockEventRepo.findAll.mockResolvedValue(Ok(mockEvents as any));
      mockRsvpRepo.countGoingByEventId.mockResolvedValue(Ok(5));

      const result = await service.getOrganizerDashboard("admin-1", "admin");

      if (!result.ok) throw new Error("Expected Ok result");

      expect(mockEventRepo.findAll).toHaveBeenCalledWith({});
      
      expect(mockRsvpRepo.countGoingByEventId).toHaveBeenCalledTimes(4);

      expect(result.value.published).toHaveLength(1);
      expect(result.value.draft).toHaveLength(1);
      expect(result.value.archived).toHaveLength(2);
      
      expect(result.value.published[0].attendeeCount).toBe(5);
    });

    it("should apply an organizerId filter for regular users", async () => {
      mockEventRepo.findAll.mockResolvedValue(Ok([]));
      
      await service.getOrganizerDashboard("user-1", "staff");

      expect(mockEventRepo.findAll).toHaveBeenCalledWith({ organizerId: "user-1" });
    });

    it("should default attendeeCount to 0 if rsvp repo fails", async () => {
      mockEventRepo.findAll.mockResolvedValue(Ok([
        { id: "e1", status: "published", organizerId: "user-1" }
      ] as any));
    
      mockRsvpRepo.countGoingByEventId.mockResolvedValue(Err({ name: "RsvpError", message: "DB down" }) as any);

      const result = await service.getOrganizerDashboard("user-1", "staff");

      if (!result.ok) throw new Error("Expected Ok result");

      expect(result.value.published[0].attendeeCount).toBe(0);
    });

    it("should return an error if fetching events fails", async () => {
  mockEventRepo.findAll.mockResolvedValue(Err({ 
    name: "RepositoryError", 
    message: "Connection failed" 
  }) as any);

  const result = await service.getOrganizerDashboard("user-1", "staff");

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.value.name).toBe("InvalidStateError");
    expect(result.value.message).toContain("Failed to fetch events");
  }
});
  });
});
