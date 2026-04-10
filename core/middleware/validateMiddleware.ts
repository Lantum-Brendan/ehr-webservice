import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

interface ValidationOptions {
  body?: ZodSchema<any>;
  query?: ZodSchema<any>;
  params?: ZodSchema<any>;
}

/**
 * Validation middleware using Zod schemas
 * Validates request body, query parameters, and/or route parameters
 */
export const validate = (options: ValidationOptions) => {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (options.body && req.body) {
        req.body = await options.body.parseAsync(req.body);
      }
      if (options.query && req.query) {
        req.query = await options.query.parseAsync(req.query);
      }
      if (options.params && req.params) {
        req.params = await options.params.parseAsync(req.params);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(error);
        return;
      }
      next(error);
    }
  };
};
