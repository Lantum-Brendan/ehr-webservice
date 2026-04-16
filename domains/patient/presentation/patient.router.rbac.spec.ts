import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { createTestApp } from "../../../tests/helpers/createTestApp.js";

vi.mock("@infrastructure/database/prisma.client.js", () => ({
  prisma: {
    patient: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

vi.mock("@shared/logger/index.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(function () {
      return this;
    }),
  },
}));

const { patientRouter } = await import("./patientRouter.js");

describe("Patient Router — RBAC", () => {
  describe("POST /api/v1/patients", () => {
    it("returns 403 when user has no role (unauthenticated)", async () => {
      const app = createTestApp(patientRouter, "/api/v1/patients");
      await request(app)
        .post("/api/v1/patients")
        .send({
          mrn: "ABC123",
          firstName: "Alice",
          lastName: "Smith",
          dateOfBirth: "1990-01-01",
        })
        .expect(403);
    });

    it('returns 403 when user has "patient" role (insufficient)', async () => {
      const app = createTestApp(patientRouter, "/api/v1/patients", {
        id: "u1",
        roles: ["patient"],
      });
      await request(app)
        .post("/api/v1/patients")
        .send({
          mrn: "ABC123",
          firstName: "Alice",
          lastName: "Smith",
          dateOfBirth: "1990-01-01",
        })
        .expect(403);
    });

    it("proceeds with 201 when user is a clinician", async () => {
      const { prisma } =
        await import("@infrastructure/database/prisma.client.js");
      (prisma.patient.findFirst as any).mockResolvedValue(null);
      (prisma.patient.upsert as any).mockResolvedValue(undefined);

      const app = createTestApp(patientRouter, "/api/v1/patients", {
        id: "u1",
        roles: ["clinician"],
      });
      const res = await request(app).post("/api/v1/patients").send({
        mrn: "MRN001",
        firstName: "Alice",
        lastName: "Smith",
        dateOfBirth: "1990-01-01",
      });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ mrn: "MRN001", firstName: "Alice" });
    });
  });

  describe("GET /api/v1/patients", () => {
    it("allows billing role to list patients", async () => {
      const app = createTestApp(patientRouter, "/api/v1/patients", {
        id: "u1",
        roles: ["billing"],
      });
      const res = await request(app).get("/api/v1/patients");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("patients");
    });

    it("returns 403 for researcher role (not in allowed list)", async () => {
      const app = createTestApp(patientRouter, "/api/v1/patients", {
        id: "u1",
        roles: ["researcher"],
      });
      await request(app).get("/api/v1/patients").expect(403);
    });
  });

  describe("Validation", () => {
    it("returns error when MRN is too short", async () => {
      const app = createTestApp(patientRouter, "/api/v1/patients", {
        id: "u1",
        roles: ["admin"],
      });
      const res = await request(app).post("/api/v1/patients").send({
        mrn: "AB",
        firstName: "Alice",
        lastName: "Smith",
        dateOfBirth: "1990-01-01",
      });
      expect([400, 422, 500]).toContain(res.status);
    });

    it("returns error when dateOfBirth is in the future", async () => {
      const app = createTestApp(patientRouter, "/api/v1/patients", {
        id: "u1",
        roles: ["admin"],
      });
      const res = await request(app).post("/api/v1/patients").send({
        mrn: "ABC123",
        firstName: "Alice",
        lastName: "Smith",
        dateOfBirth: "2099-01-01",
      });
      expect([400, 422, 500]).toContain(res.status);
    });
  });
});
