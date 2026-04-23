// Owned by Avin (Feature 1 — Event Creation). Scaffolded here as a compile-time
// dependency for the RSVP service. Do not change error names without updating CONTRACTS.md.

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

// Feature 6 - Category and Date Filter Errors

export type FilterError = 
  | {name: "InvalidCategoryError"; message:string }
  | {name: "InvalidTimeframeError"; message:string };

export const InvalidCategoryError = (message: string): FilterError => ({
  name: "InvalidCategoryError",
  message,
});

export const InvalidTimeframeError = (message: string): FilterError => ({
  name: "InvalidTimeframeError",
  message,
});

// Feautre 10 - Event Search Errors

export type SearchError = { name: "InvalidSearchError"; message: string };

export const InvalidSearchError = (message: string): SearchError => ({
  name: "InvalidSearchError",
  message,
});