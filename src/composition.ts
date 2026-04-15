import { CreateAdminUserService } from "./auth/AdminUserService";
import { CreateAuthController } from "./auth/AuthController";
import { CreateAuthService } from "./auth/AuthService";
import { CreateInMemoryUserRepository } from "./auth/InMemoryUserRepository";
import { CreatePasswordHasher } from "./auth/PasswordHasher";
import { CreateInMemoryEventRepository } from "./events/InMemoryEventRepository";
import { CreateEventController } from "./events/EventController";
import { CreateEventService } from "./events/EventService";
import { CreateInMemoryRsvpRepository } from "./rsvp/InMemoryRsvpRepository";
import { CreateRsvpController } from "./rsvp/RsvpController";
import { CreateRsvpService } from "./rsvp/RsvpService";
import { CreateApp } from "./app";
import type { IApp } from "./contracts";
import { CreateLoggingService } from "./service/LoggingService";
import type { ILoggingService } from "./service/LoggingService";

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

  // Event wiring (Features 1 & 3)
  const eventService = CreateEventService(eventRepo);
  const eventController = CreateEventController(eventService, resolvedLogger);

  // RSVP wiring (Features 4 & 9)
  const rsvpRepo = CreateInMemoryRsvpRepository();
  const rsvpService = CreateRsvpService(rsvpRepo, eventRepo, resolvedLogger);
  const rsvpController = CreateRsvpController(rsvpService, resolvedLogger);

  return CreateApp(authController, rsvpController, eventController, resolvedLogger);
}
