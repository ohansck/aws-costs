import * as cdk from "aws-cdk-lib/core";
import { Names } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sns from "aws-cdk-lib/aws-sns";
import * as snsSubscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as events from "aws-cdk-lib/aws-events";
import * as eventsTargets from "aws-cdk-lib/aws-events-targets";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cloudwatchActions from "aws-cdk-lib/aws-cloudwatch-actions";
import { Construct } from "constructs";
import * as path from "path";

export interface AwsCostsStackProps extends cdk.StackProps {
  webhookEndpoint?: string;
  notificationEmail?: string;
}

export class AwsCostsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AwsCostsStackProps = {}) {
    super(scope, id, props);

    // Generate a unique, stable identifier for this stack
    const rawUniqueId = Names.uniqueResourceName(this, {
      maxLength: 5,
      separator: "-",
    }).toLowerCase();

    //split and take last 5 characters to ensure brevity
    const uniqueId = rawUniqueId.split("-").slice(-1)[0];

    const costReportBucket = new s3.Bucket(this, "CostReportBucket", {
      bucketName: `aws-cost-reports-${uniqueId}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
      lifecycleRules: [
        {
          id: "DeleteOldReports",
          expiration: cdk.Duration.days(365),
          enabled: true,
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
    });

    const costReportTopic = new sns.Topic(this, "CostReportTopic", {
      displayName: "AWS Cost Report Notifications",
      topicName: `aws-cost-report-notifications-${uniqueId}`,
    });

    if (props.notificationEmail) {
      costReportTopic.addSubscription(
        new snsSubscriptions.EmailSubscription(props.notificationEmail)
      );
    }

    const dlq = new sqs.Queue(this, "CostReporterDLQ", {
      queueName: `cost-reporter-dlq-${uniqueId}`,
      retentionPeriod: cdk.Duration.days(14),
    });

    const environment: Record<string, string> = {
      SNS_TOPIC_ARN: costReportTopic.topicArn,
      S3_BUCKET_NAME: costReportBucket.bucketName,
      NODE_OPTIONS: "--enable-source-maps",
    };

    if (props.webhookEndpoint) {
      environment.WEBHOOK_ENDPOINT = props.webhookEndpoint;
    }

    const costReporterFunction = new lambdaNodejs.NodejsFunction(
      this,
      "CostReporterFunction",
      {
        functionName: `aws-cost-reporter-${uniqueId}`,
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        entry: path.join(__dirname, "../lambda/cost-reporter/index.ts"),
        handler: "handler",
        timeout: cdk.Duration.seconds(30),
        memorySize: 512,
        environment,
        bundling: {
          minify: true,
          sourceMap: true,
          externalModules: ["@aws-sdk/*"],
          target: "es2022",
        },
        deadLetterQueue: dlq,
        deadLetterQueueEnabled: true,
        retryAttempts: 2,
      }
    );

    costReportBucket.grantWrite(costReporterFunction);
    costReportTopic.grantPublish(costReporterFunction);

    costReporterFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["ce:GetCostAndUsage", "ce:GetCostForecast"],
        resources: ["*"],
      })
    );

    const dailyRule = new events.Rule(this, "DailyCostReportRule", {
      ruleName: `daily-cost-report-${uniqueId}`,
      description: "Trigger daily AWS cost report at 8 AM UTC",
      schedule: events.Schedule.cron({
        minute: "0",
        hour: "8",
        day: "*",
        month: "*",
        year: "*",
      }),
    });

    dailyRule.addTarget(
      new eventsTargets.LambdaFunction(costReporterFunction, {
        event: events.RuleTargetInput.fromObject({
          source: "aws.events",
          "detail-type": "Scheduled Event",
          detail: {
            period: "day",
          },
        }),
      })
    );

    const weeklyRule = new events.Rule(this, "WeeklyCostReportRule", {
      ruleName: `weekly-cost-report-${uniqueId}`,
      description: "Trigger weekly AWS cost report every Monday at 8 AM UTC",
      schedule: events.Schedule.cron({
        minute: "0",
        hour: "8",
        weekDay: "MON",
        month: "*",
        year: "*",
      }),
    });

    weeklyRule.addTarget(
      new eventsTargets.LambdaFunction(costReporterFunction, {
        event: events.RuleTargetInput.fromObject({
          source: "aws.events",
          "detail-type": "Scheduled Event",
          detail: {
            period: "week",
          },
        }),
      })
    );

    const monthlyRule = new events.Rule(this, "MonthlyCostReportRule", {
      ruleName: `monthly-cost-report-${uniqueId}`,
      description:
        "Trigger monthly AWS cost report on 1st of month at 8 AM UTC",
      schedule: events.Schedule.cron({
        minute: "0",
        hour: "8",
        day: "1",
        month: "*",
        year: "*",
      }),
    });

    monthlyRule.addTarget(
      new eventsTargets.LambdaFunction(costReporterFunction, {
        event: events.RuleTargetInput.fromObject({
          source: "aws.events",
          "detail-type": "Scheduled Event",
          detail: {
            period: "month",
          },
        }),
      })
    );

    // Create REST API with integrated API key
    const restApi = new apigateway.RestApi(this, "CostReportApi", {
      restApiName: `cost-report-api-${uniqueId}`,
      description: "API for manually triggering AWS cost reports",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ["POST", "OPTIONS"],
        allowHeaders: ["Content-Type", "X-Api-Key"],
      },
      deployOptions: {
        stageName: "prod",
        throttlingRateLimit: 5,
        throttlingBurstLimit: 10,
        metricsEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
      },
    });

    // Create Lambda integration
    const lambdaIntegration = new apigateway.LambdaIntegration(
      costReporterFunction,
      {
        proxy: true,
      }
    );

    // Add /report resource and POST method
    const reportResource = restApi.root.addResource("report");
    const postMethod = reportResource.addMethod("POST", lambdaIntegration, {
      apiKeyRequired: true,
    });

    // Create API Key
    const apiKey = restApi.addApiKey("CostReporterApiKey", {
      apiKeyName: `cost-reporter-api-key-${uniqueId}`,
      description: "API key for AWS cost reporter",
    });

    // Create Usage Plan
    const usagePlan = restApi.addUsagePlan("CostReporterUsagePlan", {
      name: `cost-reporter-usage-plan-${uniqueId}`,
      description: "Usage plan for AWS cost reporter API",
      throttle: {
        rateLimit: 5,
        burstLimit: 10,
      },
      quota: {
        limit: 1000,
        period: apigateway.Period.MONTH,
      },
    });

    // Associate API key with usage plan
    usagePlan.addApiKey(apiKey);
    usagePlan.addApiStage({
      stage: restApi.deploymentStage,
    });

    const dlqAlarm = dlq
      .metricApproximateNumberOfMessagesVisible()
      .createAlarm(this, "DLQAlarm", {
        alarmName: `cost-reporter-failures-${uniqueId}`,
        alarmDescription: "Alert when cost reporter Lambda fails",
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      });

    dlqAlarm.addAlarmAction(new cloudwatchActions.SnsAction(costReportTopic));

    new cdk.CfnOutput(this, "ApiEndpoint", {
      value: `${restApi.url}report`,
      description: "REST API endpoint for triggering cost reports",
      exportName: "CostReportApiEndpoint",
    });

    new cdk.CfnOutput(this, "ApiKeyId", {
      value: apiKey.keyId,
      description:
        "API Key ID (retrieve full key value from AWS Console → API Gateway → API Keys)",
      exportName: "CostReportApiKeyId",
    });

    new cdk.CfnOutput(this, "S3BucketName", {
      value: costReportBucket.bucketName,
      description: "S3 bucket for cost report storage",
      exportName: "CostReportBucketName",
    });

    new cdk.CfnOutput(this, "SNSTopicArn", {
      value: costReportTopic.topicArn,
      description: "SNS topic for cost report notifications",
      exportName: "CostReportTopicArn",
    });

    new cdk.CfnOutput(this, "LambdaFunctionName", {
      value: costReporterFunction.functionName,
      description: "Cost reporter Lambda function name",
      exportName: "CostReporterFunctionName",
    });

    //output uniqueId for testing purposes
    new cdk.CfnOutput(this, "UniqueId", {
      value: uniqueId,
      description: "Unique identifier for this stack",
      exportName: "UniqueId",
    });
  }
}
