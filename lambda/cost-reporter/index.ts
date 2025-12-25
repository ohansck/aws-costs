import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { fetchCostReport } from './cost-fetcher';
import { formatCostReportAsHTML } from './email-formatter';
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
    const body = JSON.parse(event.body || '{}');
    return {
      period: body.period || 'day',
      email: body.email,
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

    console.log(`Processing ${period} cost report`, {
      email: email || 'none',
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
    if (email && process.env.SNS_TOPIC_ARN) {
      try {
        const htmlContent = formatCostReportAsHTML(report);
        await sns.send(
          new PublishCommand({
            TopicArn: process.env.SNS_TOPIC_ARN,
            Subject: `AWS Cost Report - ${report.period} (${report.startDate})`,
            Message: htmlContent,
            MessageAttributes: {
              'Content-Type': {
                DataType: 'String',
                StringValue: 'text/html',
              },
            },
          })
        );
        console.log(`Sent email notification via SNS`);
        emailSent = true;
      } catch (error) {
        console.error('Failed to send email:', error);
      }
    } else if (email && !process.env.SNS_TOPIC_ARN) {
      console.log('Email requested but SNS_TOPIC_ARN not configured');
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
    console.error('Error processing cost report:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }
};
