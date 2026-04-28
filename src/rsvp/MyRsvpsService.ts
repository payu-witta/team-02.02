import { Ok, type Result } from "../lib/result";
import type { UserRole } from "../auth/User";
import type { Event, IEventRepository } from "../events/InEventRepository";
import type { Rsvp, IRsvpRepository } from "./InRsvpRepository";

export type MyRsvpItem = {
  event: Event;
  rsvp: Rsvp;
};

export type MyRsvpsView = {
  upcoming: MyRsvpItem[];
  history: MyRsvpItem[];
};

export interface IMyRsvpsService {
  getMyRsvps(input: {
    userId: string;
    userRole: UserRole;
  }): Promise<Result<MyRsvpsView, never>>;
}

class MyRsvpsService implements IMyRsvpsService {
  constructor(
    private readonly rsvpRepo: IRsvpRepository,
    private readonly eventRepo: IEventRepository,
  ) {}

  async getMyRsvps(input: {
    userId: string;
    userRole: UserRole;
  }): Promise<Result<MyRsvpsView, never>> {
    const rsvpResult = await this.rsvpRepo.findByUserId(input.userId);
    const rsvps = rsvpResult.ok ? rsvpResult.value : [];

    const upcoming: MyRsvpItem[] = [];
    const history: MyRsvpItem[] = [];

    for (const rsvp of rsvps) {
      const eventResult = await this.eventRepo.findById(rsvp.eventId);
      if (!eventResult.ok) continue;

      const event = eventResult.value;
      const item = { event, rsvp };

      if (rsvp.status === "going" || rsvp.status === "waitlisted") {
        upcoming.push(item);
      } else {
        history.push(item);
      }
    }
    upcoming.sort((a,b) => a.event.startDatetime.getTime() - b.event.startDatetime.getTime());
    history.sort((a,b) => b.event.startDatetime.getTime() - a.event.startDatetime.getTime());
    return Ok({ upcoming, history });
  }
}

export function CreateMyRsvpsService(
  rsvpRepo: IRsvpRepository,
  eventRepo: IEventRepository,
): IMyRsvpsService {
  return new MyRsvpsService(rsvpRepo, eventRepo);
}