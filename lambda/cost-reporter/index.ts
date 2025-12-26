import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { z } from "zod";
import { fetchCostReport } from "./cost-fetcher";
import { formatCostReportAsPlainText } from "./email-formatter";
import { saveCostReportToS3 } from "./storage";
import { sendToWebhook } from "./webhook";
import {
  EventBridgeEvent,
  APIGatewayEvent,
  LambdaResponse,
  ReportPeriod,
} from "./types";

const sns = new SNSClient({});

// Zod schemas for validation
const ReportPeriodSchema = z.enum(["day", "week", "month"], {
  errorMap: () => ({ message: "Period must be one of: day, week, month" }),
});

const EventBridgeEventSchema = z.object({
  source: z.literal("aws.events"),
  detail: z.object({
    period: ReportPeriodSchema,
  }),
});

const APIGatewayRequestBodySchema = z.object({
  period: ReportPeriodSchema,
  email: z.string().email("Invalid email format").optional(),
});

function parseEvent(event: EventBridgeEvent | APIGatewayEvent): {
  period: ReportPeriod;
  email?: string;
} {
  // Check if it's an EventBridge scheduled event
  if ("source" in event && event.source === "aws.events") {
    const validatedEvent = EventBridgeEventSchema.parse(event);
    return {
      period: validatedEvent.detail.period,
      email: undefined,
    };
  }

  // Check if it's an API Gateway event
  if ("body" in event && typeof event.body === "string") {
    let body: unknown;
    try {
      body = JSON.parse(event.body || "{}");
    } catch (e) {
      throw new Error("Invalid JSON in request body");
    }

    const validatedBody = APIGatewayRequestBodySchema.parse(body);
    return {
      period: validatedBody.period,
      email: validatedBody.email,
    };
  }

  throw new Error("Unknown event type");
}

export const handler = async (
  event: EventBridgeEvent | APIGatewayEvent
): Promise<LambdaResponse> => {
  try {
    const { period, email } = parseEvent(event);
    const isScheduledEvent = "source" in event && event.source === "aws.events";

    // Redact email address in logs for privacy
    const redactedEmail = email
      ? email.replace(/(.{2})(.*)(@.*)/, "$1***$3")
      : "none";
    console.log(`Processing ${period} cost report`, {
      email: redactedEmail,
      source: isScheduledEvent ? "scheduled" : "manual API",
    });

    const report = await fetchCostReport(period, isScheduledEvent);

    const s3Location = await saveCostReportToS3(report);
    console.log(`Saved report to ${s3Location}`);

    let webhookSent = false;
    const webhookEndpoint = process.env.WEBHOOK_ENDPOINT;
    if (webhookEndpoint) {
      try {
        await sendToWebhook(webhookEndpoint, report);
        console.log("Sent report to webhook");
        webhookSent = true;
      } catch (error) {
        console.error("Failed to send to webhook:", error);
      }
    } else {
      console.log("No webhook endpoint configured, skipping webhook delivery");
    }

    let emailSent = false;
    const snsTopicArn = process.env.SNS_TOPIC_ARN;

    // Send email for scheduled events OR when email is explicitly provided
    if ((isScheduledEvent || email) && snsTopicArn) {
      try {
        const plainTextContent = formatCostReportAsPlainText(report);
        await sns.send(
          new PublishCommand({
            TopicArn: snsTopicArn,
            Subject: `AWS Cost Report - ${report.period} (${report.startDate})`,
            Message: plainTextContent,
          })
        );
        console.log(`Sent email notification via SNS to topic subscribers`);
        emailSent = true;
      } catch (error) {
        console.error("Failed to send email:", error);
      }
    } else if (email && !snsTopicArn) {
      console.log("Email requested but SNS_TOPIC_ARN not configured");
    } else if (isScheduledEvent && !snsTopicArn) {
      console.log("Scheduled event triggered but SNS_TOPIC_ARN not configured");
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        report,
        s3Location,
        webhookSent,
        emailSent,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    };
  } catch (error) {
    // Log full error details for debugging (in CloudWatch)
    console.error("Error processing cost report:", error);

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));

      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: "Validation failed",
          details: formattedErrors,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      };
    }

    // Handle other validation errors
    const isValidationError =
      error instanceof Error &&
      (error.message.includes("Invalid") ||
        error.message.includes("Unknown event type"));

    return {
      statusCode: isValidationError ? 400 : 500,
      body: JSON.stringify({
        success: false,
        error: isValidationError ? error.message : "Internal server error",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    };
  }
};
