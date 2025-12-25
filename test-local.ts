import { handler } from './lambda/cost-reporter/index';
import { APIGatewayEvent, EventBridgeEvent } from './lambda/cost-reporter/types';

async function testLocalFunction() {
  console.log('🧪 Testing Lambda function locally...\n');

  // Mock API Gateway event for manual trigger (current month-to-date)
  const apiEvent: APIGatewayEvent = {
    body: JSON.stringify({
      period: 'month',
      // email: 'your-email@example.com', // Uncomment to test email
    }),
    requestContext: {
      requestId: 'test-request-123',
    },
  };

  // Mock EventBridge event for scheduled trigger (previous complete month)
  const scheduledEvent: EventBridgeEvent = {
    source: 'aws.events',
    'detail-type': 'Scheduled Event',
    detail: {
      period: 'month',
    },
  };

  try {
    // Test with API Gateway event (manual trigger - current month-to-date)
    console.log('📅 Testing manual API trigger (current month-to-date)...');
    const apiResponse = await handler(apiEvent);
    console.log('\n✅ API Response Status:', apiResponse.statusCode);

    const apiBody = JSON.parse(apiResponse.body);
    if (apiBody.success) {
      console.log('\n📊 Cost Report Summary:');
      console.log('  Period:', apiBody.report.period);
      console.log('  Date Range:', apiBody.report.startDate, 'to', apiBody.report.endDate);
      console.log('  Total Usage Cost:', `$${apiBody.report.totalUsageCost.amount}`);
      console.log('  Total Credits Applied:', `$${apiBody.report.totalCreditsApplied.amount}`);
      console.log('  Net Total Cost:', `$${apiBody.report.totalCost.amount}`);
      console.log('\n  Usage Items:', apiBody.report.usageBreakdown.length);
      console.log('  Credit Items:', apiBody.report.creditsBreakdown.length);
      console.log('\n  S3 Location:', apiBody.s3Location);
      console.log('  Webhook Sent:', apiBody.webhookSent);
      console.log('  Email Sent:', apiBody.emailSent);

      // Show top 5 usage items
      if (apiBody.report.usageBreakdown.length > 0) {
        console.log('\n  Top 5 Services by Usage:');
        apiBody.report.usageBreakdown
          .slice(0, 5)
          .forEach((item: any, index: number) => {
            console.log(`    ${index + 1}. ${item.service} (${item.region}): $${item.cost.amount}`);
          });
      }

      // Show credits if any
      if (apiBody.report.creditsBreakdown.length > 0) {
        console.log('\n  Credits Applied:');
        apiBody.report.creditsBreakdown.forEach((item: any) => {
          console.log(`    - ${item.service} (${item.region}): -$${Math.abs(parseFloat(item.creditAmount.amount)).toFixed(2)}`);
        });
      }
    } else {
      console.error('\n❌ Error:', apiBody.error);
    }

    // Uncomment to test scheduled event (previous complete month)
    /*
    console.log('\n\n📅 Testing scheduled trigger (previous complete month)...');
    const scheduledResponse = await handler(scheduledEvent);
    console.log('\n✅ Scheduled Response Status:', scheduledResponse.statusCode);
    const scheduledBody = JSON.parse(scheduledResponse.body);
    if (scheduledBody.success) {
      console.log('  Date Range:', scheduledBody.report.startDate, 'to', scheduledBody.report.endDate);
      console.log('  Total Usage Cost:', `$${scheduledBody.report.totalUsageCost.amount}`);
      console.log('  Total Credits Applied:', `$${scheduledBody.report.totalCreditsApplied.amount}`);
      console.log('  Net Total Cost:', `$${scheduledBody.report.totalCost.amount}`);
    }
    */

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
  }
}

// Run the test
testLocalFunction()
  .then(() => {
    console.log('\n✅ Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
