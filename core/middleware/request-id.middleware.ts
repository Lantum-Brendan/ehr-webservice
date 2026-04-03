import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

/**
 * Middleware that generates a unique request ID for each incoming request
 * and attaches it to the request object. Used for distributed tracing.
 */
export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Use existing request-id from header if present (from load balancer/proxy)
  const requestId =
    req.headers["x-request-id"]?.toString() || uuidv4().slice(0, 8);

  req.id = requestId;

  // Add request-id to response headers for client tracking
  res.setHeader("X-Request-Id", requestId);

  next();
};
