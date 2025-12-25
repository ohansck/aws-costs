import * as cdk from 'aws-cdk-lib/core';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as events from 'aws-cdk-lib/aws-events';
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as apigatewayv2Authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Construct } from 'constructs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface AwsCostsStackProps extends cdk.StackProps {
  webhookEndpoint?: string;
  notificationEmail?: string;
}

export class AwsCostsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AwsCostsStackProps = {}) {
    super(scope, id, props);

    const costReportBucket = new s3.Bucket(this, 'CostReportBucket', {
      bucketName: `aws-cost-reports-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
      lifecycleRules: [
        {
          id: 'DeleteOldReports',
          expiration: cdk.Duration.days(365),
          enabled: true,
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
    });

    const costReportTopic = new sns.Topic(this, 'CostReportTopic', {
      displayName: 'AWS Cost Report Notifications',
      topicName: 'aws-cost-report-notifications',
    });

    if (props.notificationEmail) {
      costReportTopic.addSubscription(
        new snsSubscriptions.EmailSubscription(props.notificationEmail)
      );
    }

    const dlq = new sqs.Queue(this, 'CostReporterDLQ', {
      queueName: 'cost-reporter-dlq',
      retentionPeriod: cdk.Duration.days(14),
    });

    const environment: Record<string, string> = {
      SNS_TOPIC_ARN: costReportTopic.topicArn,
      S3_BUCKET_NAME: costReportBucket.bucketName,
      NODE_OPTIONS: '--enable-source-maps',
    };

    if (props.webhookEndpoint) {
      environment.WEBHOOK_ENDPOINT = props.webhookEndpoint;
    }

    const costReporterFunction = new lambdaNodejs.NodejsFunction(
      this,
      'CostReporterFunction',
      {
        functionName: 'aws-cost-reporter',
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        entry: path.join(__dirname, '../lambda/cost-reporter/index.ts'),
        handler: 'handler',
        timeout: cdk.Duration.seconds(30),
        memorySize: 512,
        environment,
        bundling: {
          minify: true,
          sourceMap: true,
          externalModules: ['@aws-sdk/*'],
          target: 'es2022',
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
        actions: ['ce:GetCostAndUsage', 'ce:GetCostForecast'],
        resources: ['*'],
      })
    );

    // Generate initial API key
    const generateApiKey = (): string => {
      const prefix = 'ak_live_';
      const randomBytes = crypto.randomBytes(24).toString('base64url');
      return prefix + randomBytes;
    };

    const initialApiKey = generateApiKey();

    // Create API Key Authorizer Lambda
    const apiKeyAuthorizerFunction = new lambdaNodejs.NodejsFunction(
      this,
      'ApiKeyAuthorizerFunction',
      {
        functionName: 'aws-cost-reporter-api-key-authorizer',
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        entry: path.join(__dirname, '../lambda/api-key-authorizer/index.ts'),
        handler: 'handler',
        timeout: cdk.Duration.seconds(5),
        memorySize: 256,
        environment: {
          API_KEYS: initialApiKey, // Comma-separated list of valid API keys
        },
        bundling: {
          minify: true,
          externalModules: ['@aws-sdk/*'],
          target: 'es2022',
        },
      }
    );

    // Create Lambda Authorizer
    const lambdaAuthorizer = new apigatewayv2Authorizers.HttpLambdaAuthorizer(
      'ApiKeyAuthorizer',
      apiKeyAuthorizerFunction,
      {
        authorizerName: 'api-key-authorizer',
        identitySource: ['$request.header.x-api-key'],
        responseTypes: [apigatewayv2Authorizers.HttpLambdaResponseType.SIMPLE],
        resultsCacheTtl: cdk.Duration.minutes(5),
      }
    );

    const dailyRule = new events.Rule(this, 'DailyCostReportRule', {
      ruleName: 'daily-cost-report',
      description: 'Trigger daily AWS cost report at 8 AM UTC',
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '8',
        day: '*',
        month: '*',
        year: '*',
      }),
    });

    dailyRule.addTarget(
      new eventsTargets.LambdaFunction(costReporterFunction, {
        event: events.RuleTargetInput.fromObject({
          source: 'aws.events',
          'detail-type': 'Scheduled Event',
          detail: {
            period: 'day',
          },
        }),
      })
    );

    const weeklyRule = new events.Rule(this, 'WeeklyCostReportRule', {
      ruleName: 'weekly-cost-report',
      description: 'Trigger weekly AWS cost report every Monday at 8 AM UTC',
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '8',
        weekDay: 'MON',
        month: '*',
        year: '*',
      }),
    });

    weeklyRule.addTarget(
      new eventsTargets.LambdaFunction(costReporterFunction, {
        event: events.RuleTargetInput.fromObject({
          source: 'aws.events',
          'detail-type': 'Scheduled Event',
          detail: {
            period: 'week',
          },
        }),
      })
    );

    const monthlyRule = new events.Rule(this, 'MonthlyCostReportRule', {
      ruleName: 'monthly-cost-report',
      description: 'Trigger monthly AWS cost report on 1st of month at 8 AM UTC',
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '8',
        day: '1',
        month: '*',
        year: '*',
      }),
    });

    monthlyRule.addTarget(
      new eventsTargets.LambdaFunction(costReporterFunction, {
        event: events.RuleTargetInput.fromObject({
          source: 'aws.events',
          'detail-type': 'Scheduled Event',
          detail: {
            period: 'month',
          },
        }),
      })
    );

    const httpApi = new apigatewayv2.HttpApi(this, 'CostReportApi', {
      apiName: 'cost-report-api',
      description: 'API for manually triggering AWS cost reports',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigatewayv2.CorsHttpMethod.POST],
        allowHeaders: ['Content-Type', 'x-api-key'],
      },
    });

    const lambdaIntegration =
      new apigatewayv2Integrations.HttpLambdaIntegration(
        'CostReportIntegration',
        costReporterFunction
      );

    httpApi.addRoutes({
      path: '/report',
      methods: [apigatewayv2.HttpMethod.POST],
      integration: lambdaIntegration,
      authorizer: lambdaAuthorizer,
    });

    // Add throttling to prevent abuse
    const cfnStage = httpApi.defaultStage?.node.defaultChild as apigatewayv2.CfnStage;
    if (cfnStage) {
      cfnStage.defaultRouteSettings = {
        throttlingRateLimit: 5,
        throttlingBurstLimit: 10,
      };
    }

    const dlqAlarm = dlq
      .metricApproximateNumberOfMessagesVisible()
      .createAlarm(this, 'DLQAlarm', {
        alarmName: 'cost-reporter-failures',
        alarmDescription: 'Alert when cost reporter Lambda fails',
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      });

    dlqAlarm.addAlarmAction(new cloudwatchActions.SnsAction(costReportTopic));

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: `${httpApi.apiEndpoint}/report`,
      description: 'HTTP API endpoint for triggering cost reports',
      exportName: 'CostReportApiEndpoint',
    });

    new cdk.CfnOutput(this, 'S3BucketName', {
      value: costReportBucket.bucketName,
      description: 'S3 bucket for cost report storage',
      exportName: 'CostReportBucketName',
    });

    new cdk.CfnOutput(this, 'SNSTopicArn', {
      value: costReportTopic.topicArn,
      description: 'SNS topic for cost report notifications',
      exportName: 'CostReportTopicArn',
    });

    new cdk.CfnOutput(this, 'LambdaFunctionName', {
      value: costReporterFunction.functionName,
      description: 'Cost reporter Lambda function name',
      exportName: 'CostReporterFunctionName',
    });

    new cdk.CfnOutput(this, 'InitialApiKey', {
      value: initialApiKey,
      description: 'Initial API key (save this, it will not be shown again)',
    });
  }
}
