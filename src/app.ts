import path from "node:path";
import express, { Request, RequestHandler, Response } from "express";
import session from "express-session";
import Layouts from "express-ejs-layouts";
import { IAuthController } from "./auth/AuthController";
import { IRsvpController } from "./rsvp/RsvpController";
import { IMyRsvpsController } from "./rsvp/MyRsvpsController";
import {
  AuthenticationRequired,
  AuthorizationRequired,
} from "./auth/errors";
import type { UserRole } from "./auth/User";
import { IApp } from "./contracts";
import {
  getAuthenticatedUser,
  isAuthenticatedSession,
  AppSessionStore,
  recordPageView,
  touchAppSession,
} from "./session/AppSession";
import { ILoggingService } from "./service/LoggingService";
import { IEventDetailController } from "./events/EventDetailController";
import type { IEventController } from "./events/IEventController";
import type { IEventFilterService } from "./events/EventService";
type AsyncRequestHandler = RequestHandler;

function asyncHandler(fn: AsyncRequestHandler) {
  return function wrapped(req: Request, res: Response, next: (value?: unknown) => void) {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function sessionStore(req: Request): AppSessionStore {
  return req.session as AppSessionStore;
}

class ExpressApp implements IApp {
  private readonly app: express.Express;

  constructor(
private readonly authController: IAuthController,
    private readonly rsvpController: IRsvpController,
    private readonly eventController: IEventController,
    private readonly eventFilterService: IEventFilterService,
    private readonly eventDetailController: IEventDetailController,
    private readonly myRsvpsController: IMyRsvpsController,
    private readonly logger: ILoggingService,
  ) {
    this.app = express();
    this.registerMiddleware();
    this.registerTemplating();
    this.registerRoutes();
  }

  private registerMiddleware(): void {
    // Serve static files from src/static (create this directory to add your own assets)
    this.app.use(express.static(path.join(process.cwd(), "src/static")));
    this.app.use(express.json());
    this.app.use(
      session({
        name: "app.sid",
        secret: process.env.SESSION_SECRET ?? "project-starter-demo-secret",
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          sameSite: "lax",
        },
      }),
    );
    this.app.use(Layouts);
    this.app.use(express.urlencoded({ extended: true }));
  }

  private registerTemplating(): void {
    this.app.set("view engine", "ejs");
    this.app.set("views", path.join(process.cwd(), "src/views"));
    this.app.set("layout", "layouts/base");
  }

  private isHtmxRequest(req: Request): boolean {
    return req.get("HX-Request") === "true";
  }

  /**
   * Middleware helper: returns true if the request is from an authenticated user.
   * If the user is not authenticated, it handles the response (redirect or 401).
   */
  private requireAuthenticated(req: Request, res: Response): boolean {
    const store = sessionStore(req);
    touchAppSession(store);

    if (getAuthenticatedUser(store)) {
      return true;
    }

    this.logger.warn("Blocked unauthenticated request to a protected route");
    if (this.isHtmxRequest(req) || req.method !== "GET") {
      res.status(401).render("partials/error", {
        message: AuthenticationRequired("Please log in to continue.").message,
        layout: false,
      });
      return false;
    }

    res.redirect("/login");
    return false;
  }

  /**
   * Middleware helper: returns true if the authenticated user has one of the
   * allowed roles. Calls requireAuthenticated first, so unauthenticated
   * requests are handled automatically.
   */
  private requireRole(
    req: Request,
    res: Response,
    allowedRoles: UserRole[],
    message: string,
  ): boolean {
    if (!this.requireAuthenticated(req, res)) {
      return false;
    }

    const currentUser = getAuthenticatedUser(sessionStore(req));
    if (currentUser && allowedRoles.includes(currentUser.role)) {
      return true;
    }

    this.logger.warn(
      `Blocked unauthorized request for role ${currentUser?.role ?? "unknown"}`,
    );
    res.status(403).render("partials/error", {
      message: AuthorizationRequired(message).message,
      layout: false,
    });
    return false;
  }

  private registerRoutes(): void {
    // ── Public routes ────────────────────────────────────────────────

    this.app.get(
      "/",
      asyncHandler(async (req, res) => {
        this.logger.info("GET /");
        const store = sessionStore(req);
        res.redirect(isAuthenticatedSession(store) ? "/home" : "/login");
      }),
    );
    this.app.get(
      "/my-rsvps",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) return;
        await this.myRsvpsController.showMyRsvps(req, res);
      }),
    );

    this.app.get(
      "/login",
      asyncHandler(async (req, res) => {
        const store = sessionStore(req);
        const browserSession = recordPageView(store);

        if (getAuthenticatedUser(store)) {
          res.redirect("/home");
          return;
        }

        await this.authController.showLogin(res, browserSession);
      }),
    );

    this.app.post(
      "/login",
      asyncHandler(async (req, res) => {
        const email = typeof req.body.email === "string" ? req.body.email : "";
        const password = typeof req.body.password === "string" ? req.body.password : "";
        await this.authController.loginFromForm(res, email, password, sessionStore(req));
      }),
    );

    this.app.post(
      "/logout",
      asyncHandler(async (req, res) => {
        await this.authController.logoutFromForm(res, sessionStore(req));
      }),
    );

    // ── Admin routes ─────────────────────────────────────────────────

    this.app.get(
      "/admin/users",
      asyncHandler(async (req, res) => {
        if (!this.requireRole(req, res, ["admin"], "Only Admin can manage users.")) {
          return;
        }

        const browserSession = recordPageView(sessionStore(req));
        await this.authController.showAdminUsers(res, browserSession);
      }),
    );

    this.app.post(
      "/admin/users",
      asyncHandler(async (req, res) => {
        if (!this.requireRole(req, res, ["admin"], "Only Admin can manage users.")) {
          return;
        }

        const roleValue = typeof req.body.role === "string" ? req.body.role : "user";
        const role: UserRole =
          roleValue === "admin" || roleValue === "staff" || roleValue === "user"
            ? roleValue
            : "user";

        await this.authController.createUserFromForm(
          res,
          {
            email: typeof req.body.email === "string" ? req.body.email : "",
            displayName:
              typeof req.body.displayName === "string" ? req.body.displayName : "",
            password: typeof req.body.password === "string" ? req.body.password : "",
            role,
          },
          touchAppSession(sessionStore(req)),
        );
      }),
    );

    this.app.post(
      "/admin/users/:id/delete",
      asyncHandler(async (req, res) => {
        if (!this.requireRole(req, res, ["admin"], "Only Admin can manage users.")) {
          return;
        }

        const session = touchAppSession(sessionStore(req));
        const currentUser = getAuthenticatedUser(sessionStore(req));
        if (!currentUser) {
          res.status(401).render("partials/error", {
            message: AuthenticationRequired("Please log in to continue.").message,
            layout: false,
          });
          return;
        }

        await this.authController.deleteUserFromForm(
          res,
          typeof req.params.id === "string" ? req.params.id : "",
          currentUser.userId,
          session,
        );
      }),
    );

    // ── RSVP routes ─────────────────────────────────────────────────

    this.app.get(
      "/events/:eventId/rsvp",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) return;
        await this.rsvpController.handleGetStatus(req, res);
      }),
    );

    this.app.post(
      "/events/:eventId/rsvp",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) return;
        await this.rsvpController.handleToggle(req, res);
      }),
    );

    // ── Event routes (Features 1 & 3) ───────────────────────────────

    this.app.get(
      "/events/new",
      asyncHandler(async (req, res) => {
        if (!this.requireRole(req, res, ["staff", "admin"], "Only organizers and admins can create events.")) {
          return;
        }
        const session = recordPageView(sessionStore(req));
        await this.eventController.showCreateForm(res, session);
      }),
    );

    this.app.post(
      "/events",
      asyncHandler(async (req, res) => {
        if (!this.requireRole(req, res, ["staff", "admin"], "Only organizers and admins can create events.")) {
          return;
        }
        const session = touchAppSession(sessionStore(req));
        const currentUser = getAuthenticatedUser(sessionStore(req))!;
        await this.eventController.createFromForm(res, req.body as Record<string, unknown>, currentUser, session, this.isHtmxRequest(req));
      }),
    );

    //Feature 10 - Event Search (Sprint 1)
    this.app.get(
      "/events/search",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) return;
        const session = recordPageView(sessionStore(req));
        const query = typeof req.query.query === "string" ? req.query.query : "";
        this.logger.info(`GET /events/search?q=${JSON.stringify(query)}`);
        await this.eventController.searchEvents(res, query, session);
      }),
    );

    this.app.get(
      "/events/:id/edit",
      asyncHandler(async (req, res) => {
        if (!this.requireRole(req, res, ["staff", "admin"], "Only organizers and admins can edit events.")) {
          return;
        }
        const session = recordPageView(sessionStore(req));
        const currentUser = getAuthenticatedUser(sessionStore(req))!;
        await this.eventController.showEditForm(res, String(req.params.id), currentUser, session);
      }),
    );

    this.app.post(
      "/events/:id/edit",
      asyncHandler(async (req, res) => {
        if (!this.requireRole(req, res, ["staff", "admin"], "Only organizers and admins can edit events.")) {
          return;
        }
        const session = touchAppSession(sessionStore(req));
        const currentUser = getAuthenticatedUser(sessionStore(req))!;
        await this.eventController.editFromForm(res, String(req.params.id), req.body as Record<string, unknown>, currentUser, session, this.isHtmxRequest(req));
      }),
    );

    // ── Event lifecycle transitions (Features 5 & 8) ───────────────────────
    this.app.post(
      "/events/:id/publish",
      asyncHandler(async (req, res) => {
        if (!this.requireRole(req, res, ["staff", "admin"], "Only organizers and admins can publish events.")) {
          return;
        }

        const store = sessionStore(req);
        const session = touchAppSession(store);
        const currentUser = getAuthenticatedUser(store)!;

        await this.eventController.publishEvent(res, String(req.params.id), currentUser, session);
      }),
    );

    this.app.post(
      "/events/:id/cancel",
      asyncHandler(async (req, res) => {
        if (!this.requireRole(req, res, ["staff", "admin"], "Only organizers and admins can cancel events.")) {
          return;
        }

        const store = sessionStore(req);
        const session = touchAppSession(store);
        const currentUser = getAuthenticatedUser(store)!;


      await this.eventController.cancelEvent(res, String(req.params.id), currentUser, session);
      }),
    );

    this.app.get(
      "/dashboard",
      asyncHandler(async (req, res) => {
        if (!this.requireRole(req, res, ["staff", "admin"], "Members cannot access the organizer dashboard.")) {
          return;
        }

        const store = sessionStore(req);
        const session = recordPageView(store);
        const currentUser = getAuthenticatedUser(store)!;

        await this.eventController.showDashboard(res, currentUser, session);
      }),
    );


    // ── Authenticated home page ──────────────────────────────────────
    // TODO: Replace this placeholder with your project's main page.
    this.app.get(
      "/events/:eventId",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) return;
        await this.eventDetailController.showEventDetail(req, res);
      }),
    );

    this.app.get(
      "/home",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) {
          return;
        }

        const browserSession = recordPageView(sessionStore(req));
        this.logger.info(`GET /home for ${browserSession.browserLabel}`);
        res.render("home", { session: browserSession, pageError: null });
      }),
    );

    // ── Feature 6: event list filters (category + timeframe) ───────

    this.app.get(
      "/events",
      asyncHandler(async (req, res) => {
        if (!this.requireAuthenticated(req, res)) return;
        const session = recordPageView(sessionStore(req));
        const category = typeof req.query.category === "string" ? req.query.category : undefined;
        const timeframe = typeof req.query.timeframe === "string" ? req.query.timeframe : undefined;
        this.logger.info(`GET /events?category=${category}&timeframe=${timeframe}`);
        await this.eventController.filterEvents(res, category, timeframe, session);
      }),
    );

    // ── Error handler ────────────────────────────────────────────────

    this.app.use((err: unknown, _req: Request, res: Response, _next: (value?: unknown) => void) => {
      const message = err instanceof Error ? err.message : "Unexpected server error.";
      this.logger.error(message);
      res.status(500).render("partials/error", {
        message: "Unexpected server error.",
        layout: false,
      });
    });
  }

  getExpressApp(): express.Express {
    return this.app;
  }
}

export function CreateApp(
  authController: IAuthController,
  rsvpController: IRsvpController,
  eventController: IEventController,
  eventFilterService: IEventFilterService,
  eventDetailController: IEventDetailController,
  myRsvpsController: IMyRsvpsController,
  logger: ILoggingService,
): IApp {
  return new ExpressApp(
    authController,
    rsvpController,
    eventController,
    eventFilterService,
    eventDetailController,
    myRsvpsController,
    logger,
  );
}

