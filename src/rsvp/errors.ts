export type RsvpError =
  | { name: "EventNotFoundError"; message: string }
  | { name: "InvalidStateError"; message: string }
  | { name: "UnauthorizedError"; message: string };

export const EventNotFoundError = (message: string): RsvpError => ({
  name: "EventNotFoundError",
  message,
});

export const InvalidStateError = (message: string): RsvpError => ({
  name: "InvalidStateError",
  message,
});

export const UnauthorizedError = (message: string): RsvpError => ({
  name: "UnauthorizedError",
  message,
});
