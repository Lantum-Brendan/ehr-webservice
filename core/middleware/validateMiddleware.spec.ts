import { describe, it, expect, vi } from "vitest";
import { z, ZodError } from "zod";
import { validate } from "./validateMiddleware.js";

describe("validate middleware", () => {
  it("calls next() with no error for valid body", async () => {
    const schema = z.object({ name: z.string() });
    const middleware = validate({ body: schema });
    const req = { body: { name: "Alice" } } as any;
    const next = vi.fn();

    await middleware(req, {} as any, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ name: "Alice" });
  });

  it("calls next(ZodError) when body is invalid", async () => {
    const schema = z.object({ name: z.string() });
    const middleware = validate({ body: schema });
    const req = { body: { name: 123 } } as any;
    const next = vi.fn();

    await middleware(req, {} as any, next);
    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0][0]).toBeInstanceOf(ZodError);
  });

  it("validates params schema", async () => {
    const schema = z.object({ id: z.string().uuid() });
    const middleware = validate({ params: schema });
    const req = { params: { id: "not-a-uuid" } } as any;
    const next = vi.fn();

    await middleware(req, {} as any, next);
    expect(next.mock.calls[0][0]).toBeInstanceOf(ZodError);
  });

  it("validates query schema", async () => {
    const schema = z.object({ page: z.coerce.number().min(1) });
    const middleware = validate({ query: schema });
    const req = { query: { page: "-1" } } as any;
    const next = vi.fn();

    await middleware(req, {} as any, next);
    expect(next.mock.calls[0][0]).toBeInstanceOf(ZodError);
  });

  it("calls next() with valid query params", async () => {
    const schema = z.object({ page: z.coerce.number().min(1) });
    const middleware = validate({ query: schema });
    const req = { query: { page: "5" } } as any;
    const next = vi.fn();

    await middleware(req, {} as any, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.query).toEqual({ page: 5 });
  });

  it("calls next() with valid params", async () => {
    const schema = z.object({ id: z.string().uuid() });
    const middleware = validate({ params: schema });
    const req = {
      params: { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11" },
    } as any;
    const next = vi.fn();

    await middleware(req, {} as any, next);
    expect(next).toHaveBeenCalledWith();
  });
});
