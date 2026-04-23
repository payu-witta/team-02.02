import type { Response } from "express";
import type { IAppBrowserSession } from "../session/AppSession";
import type { IAuthenticatedUserSession } from "../session/AppSession";

export interface IEventController {
  showDetail(
    res: Response,
    eventId: string,
    session: IAppBrowserSession,
  ): Promise<void>;
  showCreateForm(res: Response, session: IAppBrowserSession): Promise<void>;
  createFromForm(
    res: Response,
    body: Record<string, unknown>,
    currentUser: IAuthenticatedUserSession,
    session: IAppBrowserSession,
    isHtmx: boolean,
  ): Promise<void>;
  showEditForm(
    res: Response,
    eventId: string,
    currentUser: IAuthenticatedUserSession,
    session: IAppBrowserSession,
  ): Promise<void>;
  editFromForm(
    res: Response,
    eventId: string,
    body: Record<string, unknown>,
    currentUser: IAuthenticatedUserSession,
    session: IAppBrowserSession,
    isHtmx: boolean,
  ): Promise<void>;

  publishEvent(
    res: Response,
    eventId: string,
    currentUser: IAuthenticatedUserSession,
    session: IAppBrowserSession,
  ): Promise<void>;

  cancelEvent(
    res: Response,
    eventId: string,
    currentUser: IAuthenticatedUserSession,
    session: IAppBrowserSession,
  ): Promise<void>;

  showDashboard(
    res: Response,
    currentUser: IAuthenticatedUserSession,
    session: IAppBrowserSession,
  ): Promise<void>;

  searchEvents(
    res: Response,
    query: string,
    session: IAppBrowserSession,
  ): Promise<void>;

  filterEvents(
    res: Response,
    category: string | undefined,
    timeframe: string | undefined,
    session: IAppBrowserSession,
  ): Promise<void>;
}