import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { fetchCostReport } from './cost-fetcher';
import { formatCostReportAsPlainText } from './email-formatter';
import { saveCostReportToS3 } from './storage';
import { sendToWebhook } from './webhook';
import {
  EventBridgeEvent,
  APIGatewayEvent,
  LambdaResponse,
  ReportPeriod,
} from './types';

const sns = new SNSClient({});

function parseEvent(
  event: EventBridgeEvent | APIGatewayEvent
): { period: ReportPeriod; email?: string } {
  if ('source' in event && event.source === 'aws.events') {
    return {
      period: event.detail.period,
      email: undefined,
    };
  }

  if ('body' in event) {
    // Wrap JSON.parse in try-catch to handle malformed input
    let body: any;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      throw new Error('Invalid JSON in request body');
    }

    // Validate period parameter
    const validPeriods: ReportPeriod[] = ['day', 'week', 'month'];
    const period = validPeriods.includes(body.period) ? body.period : 'day';

    // Validate email format if provided
    const email = body.email;
    if (email && typeof email === 'string') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Invalid email format');
      }
    }

    return {
      period,
      email: email || undefined,
    };
  }

  throw new Error('Unknown event type');
}

export const handler = async (
  event: EventBridgeEvent | APIGatewayEvent
): Promise<LambdaResponse> => {
  try {
    const { period, email } = parseEvent(event);
    const isScheduledEvent = 'source' in event && event.source === 'aws.events';

    // Redact email address in logs for privacy
    const redactedEmail = email ? email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 'none';
    console.log(`Processing ${period} cost report`, {
      email: redactedEmail,
      source: isScheduledEvent ? 'scheduled' : 'manual API'
    });

    const report = await fetchCostReport(period, isScheduledEvent);

    const s3Location = await saveCostReportToS3(report);
    console.log(`Saved report to ${s3Location}`);

    let webhookSent = false;
    const webhookEndpoint = process.env.WEBHOOK_ENDPOINT;
    if (webhookEndpoint) {
      try {
        await sendToWebhook(webhookEndpoint, report);
        console.log('Sent report to webhook');
        webhookSent = true;
      } catch (error) {
        console.error('Failed to send to webhook:', error);
      }
    } else {
      console.log('No webhook endpoint configured, skipping webhook delivery');
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
        console.error('Failed to send email:', error);
      }
    } else if (email && !snsTopicArn) {
      console.log('Email requested but SNS_TOPIC_ARN not configured');
    } else if (isScheduledEvent && !snsTopicArn) {
      console.log('Scheduled event triggered but SNS_TOPIC_ARN not configured');
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
        'Content-Type': 'application/json',
      },
    };
  } catch (error) {
    // Log full error details for debugging (in CloudWatch)
    console.error('Error processing cost report:', error);

    // Return generic error message to client (don't leak internal details)
    const isValidationError = error instanceof Error &&
      (error.message.includes('Invalid') || error.message.includes('Unknown event type'));

    return {
      statusCode: isValidationError ? 400 : 500,
      body: JSON.stringify({
        success: false,
        error: isValidationError ? error.message : 'Internal server error',
        // Include a correlation ID for debugging (if available in context)
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }
};
