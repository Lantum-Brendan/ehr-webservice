/**
 * Base application error class for all custom errors in the EHR system.
 * All operational errors should extend this class.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational: boolean = true,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where our error was thrown (only on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * 400 Bad Request error
 */
export class BadRequestError extends AppError {
  constructor(message: string = "Bad request") {
    super(message, 400, "BAD_REQUEST");
  }
}

/**
 * 401 Unauthorized error
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}

/**
 * 403 Forbidden error
 */
export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(message, 403, "FORBIDDEN");
  }
}

/**
 * 404 Not Found error
 */
export class NotFoundError extends AppError {
  constructor(message: string = "Not found") {
    super(message, 404, "NOT_FOUND");
  }
}

/**
 * 409 Conflict error
 */
export class ConflictError extends AppError {
  constructor(message: string = "Conflict") {
    super(message, 409, "CONFLICT");
  }
}

/**
 * 422 Unprocessable Entity error
 */
export class UnprocessableEntityError extends AppError {
  constructor(message: string = "Unprocessable entity") {
    super(message, 422, "UNPROCESSABLE_ENTITY");
  }
}

/**
 * 500 Internal Server error
 */
export class InternalServerError extends AppError {
  constructor(message: string = "Internal server error") {
    super(message, 500, "INTERNAL_SERVER_ERROR");
  }
}

/**
 * 503 Service Unavailable error
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string = "Service unavailable") {
    super(message, 503, "SERVICE_UNAVAILABLE");
  }
}
