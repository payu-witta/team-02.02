import { CreateAdminUserService } from "./auth/AdminUserService";
import { CreateAuthController } from "./auth/AuthController";
import { CreateAuthService } from "./auth/AuthService";
import { CreateInMemoryUserRepository } from "./auth/InMemoryUserRepository";
import { CreatePasswordHasher } from "./auth/PasswordHasher";
import { CreateApp } from "./app";
import type { IApp } from "./contracts";
import { CreateInMemoryEventRepository } from "./events/InMemoryEventRepository";
import { CreateEventService } from "./events/EventService";
import { CreateEventFilterService } from "./events/EventService";
import { CreateEventController } from "./events/EventController";
import { CreateInMemoryRsvpRepository } from "./rsvp/InMemoryRsvpRepository";
import { CreateRsvpService } from "./rsvp/RsvpService";
import { CreateRsvpController } from "./rsvp/RsvpController";
import { CreateLoggingService } from "./service/LoggingService";
import type { ILoggingService } from "./service/LoggingService";
import { CreateEventDetailService } from "./events/EventDetailService";
import { CreateEventDetailController } from "./events/EventDetailController";
import { CreateMyRsvpsService } from "./rsvp/MyRsvpsService";
import { CreateMyRsvpsController } from "./rsvp/MyRsvpsController";

export function createComposedApp(logger?: ILoggingService): IApp {
  const resolvedLogger = logger ?? CreateLoggingService();

  // Authentication & authorization wiring
  const authUsers = CreateInMemoryUserRepository();
  const passwordHasher = CreatePasswordHasher();
  const authService = CreateAuthService(authUsers, passwordHasher);
  const adminUserService = CreateAdminUserService(authUsers, passwordHasher);
  const authController = CreateAuthController(authService, adminUserService, resolvedLogger);

  // Shared event repository
  const eventRepo = CreateInMemoryEventRepository();
  const rsvpRepo = CreateInMemoryRsvpRepository();

  // Event wiring (Features 1 & 3)

  const eventService = CreateEventService(eventRepo, rsvpRepo);
  const eventController = CreateEventController(eventService, resolvedLogger);

  const eventFilterService = CreateEventFilterService(eventRepo);
  // RSVP wiring (Features 4 & 9)
  const rsvpService = CreateRsvpService(rsvpRepo, eventRepo, resolvedLogger);
  const rsvpController = CreateRsvpController(rsvpService, resolvedLogger);
  const eventDetailService = CreateEventDetailService(eventRepo, rsvpRepo);
  const eventDetailController = CreateEventDetailController(eventDetailService, resolvedLogger);
  const myRsvpsService = CreateMyRsvpsService(rsvpRepo, eventRepo);
  const myRsvpsController = CreateMyRsvpsController(myRsvpsService, resolvedLogger);

  return CreateApp(authController, rsvpController, eventController, eventFilterService,eventDetailController, myRsvpsController, resolvedLogger);

}

