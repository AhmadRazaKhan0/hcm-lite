// Small helper so services can throw errors with an HTTP status and field details.
export class HttpError extends Error {
  constructor(status, message, errors = undefined) {
    super(message);
    this.status = status;
    this.errors = errors; // optional: [{ field, reason }]
  }
}

// Express 4 does not catch rejected promises, so wrap async handlers.
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);