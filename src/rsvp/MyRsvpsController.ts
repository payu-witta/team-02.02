import type { Request, Response } from "express";
import { getAuthenticatedUser, recordPageView } from "../session/AppSession";
import type { ILoggingService } from "../service/LoggingService";
import type { IMyRsvpsService } from "./MyRsvpsService";

export interface IMyRsvpsController {
  showMyRsvps(req: Request, res: Response): Promise<void>;
}

class MyRsvpsController implements IMyRsvpsController {
  constructor(
    private readonly service: IMyRsvpsService,
    private readonly logger: ILoggingService,
  ) {}

  async showMyRsvps(req: Request, res: Response): Promise<void> {
    const user = getAuthenticatedUser(req.session as never);
    const session = recordPageView(req.session as never);

    if (!user) {
      res.redirect("/login");
      return;
    }
    if (user.role !== "user"){
      res.status(403).send("Bad");
      return;
    }

    const result = await this.service.getMyRsvps({
      userId: user.userId,
      userRole: user.role,
    });

    res.render("rsvp/dashboard", {
      ...result.value,
      session,
      pageError: null,
    });
  }
}

export function CreateMyRsvpsController(
  service: IMyRsvpsService,
  logger: ILoggingService,
): IMyRsvpsController {
  return new MyRsvpsController(service, logger);
}