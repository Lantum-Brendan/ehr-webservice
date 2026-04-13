import { Request, Response, NextFunction } from "express";
import { AppError } from "./appError.js";
import { logger } from "../../shared/logger/index.js";

/**
 * Global error handler middleware
 * Must be the last middleware in the chain
 */
export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // Operational errors that we throw intentionally
  if (err instanceof AppError) {
    if (err.isOperational) {
      logger.warn(
        {
          statusCode: err.statusCode,
          code: err.code,
          message: err.message,
          path: req.path,
          method: req.method,
          requestId: req.id,
        },
        "Operational error",
      );

      res.status(err.statusCode).json({
        error: {
          code: err.code,
          message: err.message,
          requestId: req.id,
        },
      });
      return;
    }
    // Programmer errors - should not happen in production
    logger.error(
      { err, path: req.path, requestId: req.id },
      "Unhandled AppError",
    );
    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong",
        requestId: req.id,
      },
    });
    return;
  }

  // Zod validation errors
  if (err && typeof err === "object" && "errors" in err && "issue" in err) {
    logger.warn(
      {
        validationErrors: err,
        path: req.path,
        requestId: req.id,
      },
      "Validation error",
    );

    res.status(422).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details: err,
        requestId: req.id,
      },
    });
    return;
  }

  // Unknown errors - log full details, return generic message
  logger.error(
    { err, path: req.path, method: req.method, requestId: req.id },
    "Unhandled error",
  );

  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Something went wrong",
      requestId: req.id,
    },
  });
};
