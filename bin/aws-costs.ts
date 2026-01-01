#!/usr/bin/env node
import "dotenv/config";
import * as cdk from "aws-cdk-lib/core";
import { AwsCostsStack } from "../lib/aws-costs-stack";

const app = new cdk.App();

const webhookEndpoint =
  app.node.tryGetContext("webhookEndpoint") || process.env.WEBHOOK_ENDPOINT;

const notificationEmail =
  app.node.tryGetContext("notificationEmail") || process.env.NOTIFICATION_EMAIL;

new AwsCostsStack(app, "AwsCostsStack", {
  webhookEndpoint,
  notificationEmail,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "us-east-1",
  },
  description: "AWS Cost Reporting System with scheduled and on-demand reports",
});
