export type EventError =
  | { name: "EventNotFoundError"; message: string }
  | { name: "InvalidInputError"; message: string }
  | { name: "UnauthorizedError"; message: string }
  | { name: "InvalidStateError"; message: string }
  | { name: "InvalidTransitionError"; message: string };

export const EventNotFoundError = (message: string): EventError => ({
  name: "EventNotFoundError",
  message,
});

export const InvalidInputError = (message: string): EventError => ({
  name: "InvalidInputError",
  message,
});

export const UnauthorizedError = (message: string): EventError => ({
  name: "UnauthorizedError",
  message,
});

export const InvalidStateError = (message: string): EventError => ({
  name: "InvalidStateError",
  message,
});

export const InvalidTransitionError = (message: string): EventError => ({
  name: "InvalidTransitionError",
  message,
});
