import { Router } from "express";
import { z } from "zod";
import { requireRole } from "@core/guards/roleGuard.js";
import { ForbiddenError, ConflictError } from "@core/errors/appError.js";
import {
  CreateScheduleUseCase,
  UpdateScheduleUseCase,
  DeleteScheduleUseCase,
  GetSchedulesForProviderUseCase,
} from "./application/scheduleUseCases.js";
import { CopyWeekScheduleUseCase } from "./application/copyWeekScheduleUseCase.js";
import {
  CreateBlockUseCase,
  UpdateBlockUseCase,
  DeleteBlockUseCase,
  GetBlocksForProviderUseCase,
  ClearRangeUseCase,
} from "./application/scheduleBlockUseCases.js";
import { PrismaProviderScheduleRepository } from "./infrastructure/prismaProviderScheduleRepository.js";
import { PrismaScheduleBlockRepository } from "./infrastructure/prismaScheduleBlockRepository.js";
import { logger } from "@shared/logger/index.js";

const idSchema = z.string().trim().min(1);

const createScheduleSchema = z.object({
  providerId: idSchema,
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string(),
  endTime: z.string(),
  isActive: z.boolean().optional(),
});

const updateScheduleSchema = z.object({
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  isActive: z.boolean().optional(),
});

const copyWeekSchema = z.object({
  sourceProviderId: idSchema,
  targetProviderId: idSchema,
  copyActiveOnly: z.boolean().optional(),
});

const createBlockSchema = z.object({
  providerId: idSchema,
  startDateTime: z.string().datetime(),
  endDateTime: z.string().datetime(),
  reason: z.string().min(1),
});

const updateBlockSchema = z.object({
  startDateTime: z.string().datetime().optional(),
  endDateTime: z.string().datetime().optional(),
  reason: z.string().min(1).optional(),
});

const clearRangeSchema = z.object({
  providerId: idSchema,
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

const scheduleRepo = new PrismaProviderScheduleRepository();
const blockRepo = new PrismaScheduleBlockRepository();

const createScheduleUseCase = new CreateScheduleUseCase(scheduleRepo, logger);
const updateScheduleUseCase = new UpdateScheduleUseCase(scheduleRepo, logger);
const deleteScheduleUseCase = new DeleteScheduleUseCase(scheduleRepo, logger);
const getSchedulesForProviderUseCase = new GetSchedulesForProviderUseCase(
  scheduleRepo,
);
const copyWeekScheduleUseCase = new CopyWeekScheduleUseCase(
  scheduleRepo,
  blockRepo,
  logger,
);

const createBlockUseCase = new CreateBlockUseCase(
  blockRepo,
  scheduleRepo,
  logger,
);
const updateBlockUseCase = new UpdateBlockUseCase(blockRepo, logger);
const deleteBlockUseCase = new DeleteBlockUseCase(blockRepo, logger);
const getBlocksForProviderUseCase = new GetBlocksForProviderUseCase(blockRepo);
const clearRangeUseCase = new ClearRangeUseCase(
  scheduleRepo,
  blockRepo,
  logger,
);

export const scheduleRouter = Router();

function assertProviderOwnsData(
  providerId: string,
  userId: string,
  roles: string[],
): void {
  const isAdmin = roles.includes("admin");
  const isReception = roles.includes("reception");
  const isOwnData = providerId === userId;

  if (!isAdmin && !isReception && !isOwnData) {
    throw new ForbiddenError("You can only manage your own schedule");
  }
}

scheduleRouter.get(
  "/provider/:providerId",
  requireRole("admin", "reception", "clinician"),
  async (req, res, next) => {
    try {
      assertProviderOwnsData(
        req.params.providerId,
        req.user?.id ?? "",
        req.user?.roles ?? [],
      );

      const schedules = await getSchedulesForProviderUseCase.execute(
        req.params.providerId,
      );

      res.json(
        schedules.map((s) => ({
          id: s.id,
          providerId: s.providerId,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          isActive: s.isActive,
        })),
      );
    } catch (error) {
      next(error);
    }
  },
);

scheduleRouter.post(
  "/",
  requireRole("admin", "reception"),
  async (req, res, next) => {
    try {
      const input = createScheduleSchema.parse(req.body);

      const schedule = await createScheduleUseCase.execute(
        input,
        req.user?.id ?? "",
        req.user?.roles ?? [],
      );

      res.status(201).json({
        id: schedule.id,
        providerId: schedule.providerId,
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        isActive: schedule.isActive,
      });
    } catch (error) {
      next(error);
    }
  },
);

scheduleRouter.put(
  "/:id",
  requireRole("admin", "reception", "clinician"),
  async (req, res, next) => {
    try {
      const input = updateScheduleSchema.parse(req.body);

      const schedule = await updateScheduleUseCase.execute(
        req.params.id,
        input,
        req.user?.id ?? "",
        req.user?.roles ?? [],
      );

      res.json({
        id: schedule.id,
        providerId: schedule.providerId,
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        isActive: schedule.isActive,
      });
    } catch (error) {
      next(error);
    }
  },
);

scheduleRouter.delete(
  "/:id",
  requireRole("admin", "reception"),
  async (req, res, next) => {
    try {
      await deleteScheduleUseCase.execute(
        req.params.id,
        req.user?.id ?? "",
        req.user?.roles ?? [],
      );
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

scheduleRouter.post(
  "/copy-week",
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const input = copyWeekSchema.parse(req.body);

      const result = await copyWeekScheduleUseCase.execute(
        input,
        req.user?.id ?? "",
        req.user?.roles ?? [],
      );

      res.status(201).json({
        schedules: result.schedules.map((s) => ({
          id: s.id,
          providerId: s.providerId,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          isActive: s.isActive,
        })),
        warnings: result.warnings,
      });
    } catch (error) {
      next(error);
    }
  },
);

scheduleRouter.get(
  "/blocks/provider/:providerId",
  requireRole("admin", "reception", "clinician"),
  async (req, res, next) => {
    try {
      assertProviderOwnsData(
        req.params.providerId,
        req.user?.id ?? "",
        req.user?.roles ?? [],
      );

      const blocks = await getBlocksForProviderUseCase.execute(
        req.params.providerId,
      );

      res.json(
        blocks.map((b) => ({
          id: b.id,
          providerId: b.providerId,
          startDateTime: b.startDateTime.toISOString(),
          endDateTime: b.endDateTime.toISOString(),
          reason: b.reason,
        })),
      );
    } catch (error) {
      next(error);
    }
  },
);

scheduleRouter.post(
  "/blocks",
  requireRole("admin", "reception"),
  async (req, res, next) => {
    try {
      const input = createBlockSchema.parse(req.body);

      const result = await createBlockUseCase.execute(
        input,
        req.user?.id ?? "",
        req.user?.roles ?? [],
      );

      res.status(201).json({
        id: result.block.id,
        providerId: result.block.providerId,
        startDateTime: result.block.startDateTime.toISOString(),
        endDateTime: result.block.endDateTime.toISOString(),
        reason: result.block.reason,
        warnings: result.warnings,
      });
    } catch (error) {
      next(error);
    }
  },
);

scheduleRouter.put(
  "/blocks/:id",
  requireRole("admin", "reception"),
  async (req, res, next) => {
    try {
      const input = updateBlockSchema.parse(req.body);

      const block = await updateBlockUseCase.execute(
        req.params.id,
        input,
        req.user?.id ?? "",
        req.user?.roles ?? [],
      );

      res.json({
        id: block.id,
        providerId: block.providerId,
        startDateTime: block.startDateTime.toISOString(),
        endDateTime: block.endDateTime.toISOString(),
        reason: block.reason,
      });
    } catch (error) {
      next(error);
    }
  },
);

scheduleRouter.delete(
  "/blocks/:id",
  requireRole("admin", "reception"),
  async (req, res, next) => {
    try {
      await deleteBlockUseCase.execute(
        req.params.id,
        req.user?.id ?? "",
        req.user?.roles ?? [],
      );
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

scheduleRouter.post(
  "/blocks/clear-range",
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const input = clearRangeSchema.parse(req.body);

      const result = await clearRangeUseCase.execute(
        input.providerId,
        new Date(input.startDate),
        new Date(input.endDate),
        req.user?.id ?? "",
        req.user?.roles ?? [],
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);
