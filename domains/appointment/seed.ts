import { prisma } from "@infrastructure/database/prisma.client.js";
import { logger } from "@shared/logger/index.js";

async function seed() {
  logger.info("Seeding appointment module data...");

  const providers = await prisma.provider.findMany();
  if (providers.length > 0) {
    logger.info("Providers already seeded, skipping...");
  } else {
    await prisma.provider.createMany({
      data: [
        {
          id: "provider-gp-001",
          name: "Dr. Sarah Johnson",
          specialization: "General Practice",
          isActive: true,
        },
        {
          id: "provider-cardio-001",
          name: "Dr. Michael Chen",
          specialization: "Cardiology",
          isActive: true,
        },
        {
          id: "provider-peds-001",
          name: "Dr. Emily Williams",
          specialization: "Pediatrics",
          isActive: true,
        },
      ],
    });
    logger.info("Created 3 providers");
  }

  const appointmentTypes = await prisma.appointmentType.findMany();
  if (appointmentTypes.length > 0) {
    logger.info("Appointment types already seeded, skipping...");
  } else {
    await prisma.appointmentType.createMany({
      data: [
        {
          id: "type-checkup-001",
          name: "Routine Checkup",
          defaultDurationMinutes: 15,
          color: "#4CAF50",
          isActive: true,
        },
        {
          id: "type-followup-001",
          name: "Follow-up",
          defaultDurationMinutes: 30,
          color: "#2196F3",
          isActive: true,
        },
        {
          id: "type-procedure-001",
          name: "Procedure",
          defaultDurationMinutes: 60,
          color: "#FF9800",
          isActive: true,
        },
      ],
    });
    logger.info("Created 3 appointment types");
  }

  const locations = await prisma.location.findMany();
  if (locations.length > 0) {
    logger.info("Locations already seeded, skipping...");
  } else {
    await prisma.location.createMany({
      data: [
        {
          id: "location-waiting-001",
          name: "Main Waiting Room",
          type: "waiting",
          isActive: true,
        },
        {
          id: "location-exam-001",
          name: "Exam Room 1",
          type: "exam_room",
          isActive: true,
        },
        {
          id: "location-exam-002",
          name: "Exam Room 2",
          type: "exam_room",
          isActive: true,
        },
        {
          id: "location-consult-001",
          name: "Consultation A",
          type: "consultation",
          isActive: true,
        },
      ],
    });
    logger.info("Created 4 locations");
  }

  const settings = await prisma.clinicSettings.findFirst();
  if (settings) {
    logger.info("Clinic settings already seeded, skipping...");
  } else {
    await prisma.clinicSettings.create({
      data: {
        id: "settings-default-001",
        cancellationCutoffHours: 24,
        appointmentBufferMinutes: 0,
      },
    });
    logger.info("Created clinic settings");
  }

  logger.info("Seeding complete!");
}

seed()
  .catch((e) => {
    logger.error(e, "Seeding failed");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
