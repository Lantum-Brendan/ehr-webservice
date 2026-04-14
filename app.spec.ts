import { describe, expect, it } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "https://example.com/database";
process.env.JWT_SECRET ??= "test-jwt-secret-123456789012345678";
process.env.REFRESH_SECRET ??= "test-refresh-secret-123456789012345";
process.env.ENCRYPTION_KEY ??=
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.AUDIT_LOG_ENABLED ??= "false";

const { createApp } = await import("./app.js");
const { appointmentRouter } = await import(
  "./domains/appointment/presentation/appointmentRouter.js"
);

describe("createApp", () => {
  it("mounts the appointment router and advertises it in API metadata", async () => {
    const app = createApp();
    const routerStack = (app.router as { stack: any[] }).stack;

    const appointmentLayer = routerStack.find(
      (layer) =>
        layer.handle === appointmentRouter &&
        layer.matchers?.some((matcher: (path: string) => unknown) =>
          Boolean(matcher("/api/v1/appointments")),
        ),
    );

    expect(appointmentLayer).toBeDefined();

    const apiRootLayer = routerStack.find(
      (layer) => layer.route?.path === "/api/v1" && layer.route?.methods?.get,
    );
    const resState = { body: undefined as Record<string, unknown> | undefined };
    const res = {
      json(payload: Record<string, unknown>) {
        resState.body = payload;
        return this;
      },
    };

    await Promise.resolve(
      apiRootLayer.route.stack[0].handle({}, res, () => undefined),
    );

    expect(resState.body?.endpoints).toMatchObject({
      appointments: "/api/v1/appointments",
      patients: "/api/v1/patients",
    });
  });
});
