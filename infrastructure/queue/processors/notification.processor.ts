import { Job } from "bullmq";
import { logger } from "../../../shared/logger/index.js";

/**
 * Processor for notification jobs
 * Sends notifications via email, SMS, or in-app
 */

export interface NotificationJobData {
  recipientId: string;
  type: "email" | "sms" | "in-app";
  subject?: string;
  message: string;
  templateId?: string;
  templateData?: Record<string, any>;
  priority?: "low" | "normal" | "high";
}

export async function processNotification(
  job: Job<NotificationJobData>,
): Promise<void> {
  const { recipientId, type, subject, priority = "normal" } = job.data;
  // message, templateId, templateData will be used when notification logic is implemented

  logger.info(
    {
      jobId: job.id,
      recipientId,
      type,
      subject,
      priority,
    },
    "Processing notification",
  );

  // TODO: Implement actual notification logic
  // 1. Look up recipient contact info
  // 2. Render template if templateId provided
  // 3. Send via email (SendGrid, SES) or SMS (Twilio)
  // 4. Log notification delivery status

  // Simulate processing
  await new Promise((resolve) => setTimeout(resolve, 500));

  logger.info(
    { recipientId, type, jobId: job.id },
    "Notification sent successfully",
  );
}
