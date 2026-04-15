import express, { Express, Request, Response, NextFunction } from "express";
import { errorHandler } from "../../core/errors/error-handler.js";

export interface TestUser {
  id: string;
  roles: string[];
  patientId?: string;
}

export interface TestRequest extends Request {
  user?: TestUser;
}

export function createTestApp(
  router: ReturnType<typeof express.Router>,
  mountPath: string,
  user?: TestUser,
): Express {
  const app = express();
  app.use(express.json());

  if (user) {
    app.use((req: TestRequest, _res: Response, next: NextFunction) => {
      req.user = user;
      next();
    });
  }

  app.use(mountPath, router);
  app.use(errorHandler);
  return app;
}

export function createMockRequest(
  user?: TestUser,
  overrides?: Partial<Request>,
): TestRequest {
  return {
    user,
    params: {},
    query: {},
    body: {},
    ...overrides,
  } as TestRequest;
}

export function createMockResponse(): Response & {
  statusCode: number;
  body: unknown;
  json: ReturnType<typeof jest.fn>;
  status: ReturnType<typeof jest.fn>;
} {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
  };
  return {
    ...res,
    status: (code: number) => {
      res.statusCode = code;
      return res as any;
    },
    json: (body: unknown) => {
      res.body = body;
      return res as any;
    },
  } as any;
}
