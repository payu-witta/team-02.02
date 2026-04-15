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
  ): Promise<void>;
  searchEvents(
    res: Response,
    query: string,
    session: IAppBrowserSession,
  ): Promise<void>;
}
