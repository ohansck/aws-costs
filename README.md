# AWS Cost Reporter 📊

> Automated AWS cost reporting with daily, weekly, and monthly schedules. Get cost breakdowns by service and region delivered to your webhook, email, or stored in S3.

[![Deploy with GitHub Actions](https://img.shields.io/badge/Deploy-GitHub%20Actions-2088FF?logo=github-actions&logoColor=white)](https://github.com/ohansck/aws-costs/actions)
[![AWS CDK](https://img.shields.io/badge/AWS-CDK-FF9900?logo=amazon-aws&logoColor=white)](https://aws.amazon.com/cdk/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

## ✨ Features

- **📅 Automated Scheduling**: Daily (8 AM UTC), weekly (Mondays), and monthly (1st of month) reports
- **🔔 Flexible Notifications**:
  - Send to webhook endpoints (n8n, Zapier, custom APIs)
  - Send plain text emails via Amazon SNS
  - Both webhook and email are optional - use what you need!
- **💾 Historical Storage**: All reports saved to S3 with 365-day retention
- **🌍 Multi-Region**: Automatic cost breakdown by AWS service and region
- **🚀 Manual Triggers**: On-demand reports via secured REST API
- **🔐 API Key Security**: Native API Gateway key authentication with usage plans
- **✅ Type-Safe Validation**: Zod-based input validation with detailed error messages
- **💳 Credits Tracking**: Separate tracking of usage costs vs. AWS promotional credits
- **📈 Readable Reports**: Well-formatted plain text emails with organized cost breakdowns
- **⚡ Rate Limiting**: 5 requests/second throttling + 1000 requests/month quota
- **💰 Cost-Effective**: ~$3/month estimated operational cost (free with AWS free tier)

## 🏗️ Architecture

```
┌─────────────┐
│ EventBridge │──┐
│  Schedules  │  │  Daily, Weekly, Monthly (Bypass API Gateway)
└─────────────┘  │
                 │
┌─────────────┐  │         ┌──────────────┐
│ REST API GW │──┼────────▶│    Lambda    │
│  (Manual)   │  │  ✓/✗    │   Function   │
│ + API Key   │  │ (Auth)  │ Cost Reporter│
└─────────────┘  │         └──────┬───────┘
                 │                │
                 │                ├──▶ Cost Explorer API
                 │                │
                 │                ├──▶ S3 Bucket (Reports)
                 │                │
                 │                ├──▶ Webhook (Optional)
                 │                │
                 │                └──▶ SNS → Email (Optional)
```

## 🚀 Quick Start

### Prerequisites

- AWS Account with Cost Explorer enabled
- AWS CLI configured
- Node.js 22+ installed
- CDK CLI installed (`npm install -g aws-cdk`)

### Option 1: Deploy with GitHub Actions (Recommended)

1. **Fork this repository**

2. **Set up AWS OIDC Provider** in your AWS account:

   ```bash
   aws iam create-open-id-connect-provider \
     --url https://token.actions.githubusercontent.com \
     --client-id-list sts.amazonaws.com \
     --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
   ```

3. **Create IAM Role** for GitHub Actions:

   ```bash
   # Create trust policy (trust-policy.json)
   cat > trust-policy.json <<EOF
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": {
           "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
         },
         "Action": "sts:AssumeRoleWithWebIdentity",
         "Condition": {
           "StringEquals": {
             "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
           },
           "StringLike": {
             "token.actions.githubusercontent.com:sub": "repo:ohansck/aws-costs:*"
           }
         }
       }
     ]
   }
   EOF

   # Create role
   aws iam create-role \
     --role-name GitHubActionsDeployRole \
     --assume-role-policy-document file://trust-policy.json

   # Attach Administrator policy (or create a more restrictive policy)
   aws iam attach-role-policy \
     --role-name GitHubActionsDeployRole \
     --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
   ```

4. **Configure GitHub Repository Variables**:

   - Go to Settings → Secrets and variables → Actions → Variables
   - Add the following variables:
     - `AWS_ROLE_ARN`: `arn:aws:iam::YOUR_ACCOUNT_ID:role/GitHubActionsDeployRole`
     - `AWS_REGION`: `us-east-1` (or your preferred region)
     - `WEBHOOK_ENDPOINT` (optional): Your webhook URL
     - `NOTIFICATION_EMAIL` (optional): Your email address

5. **Deploy**:
   - Go to Actions → Deploy AWS Cost Reporter → Run workflow
   - Optionally override webhook/email in the workflow inputs

### Option 2: Deploy Locally

1. **Clone and install**:

   ```bash
   git clone https://github.com/ohansck/aws-costs.git
   cd aws-costs
   npm install
   ```

2. **Configure (optional)**:

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Bootstrap CDK** (first time only):

   ```bash
   cdk bootstrap
   ```

4. **Deploy**:

   ```bash
   # Deploy with configuration from environment variables or cdk.json context
   cdk deploy

   # Or pass configuration directly
   cdk deploy \
     --context webhookEndpoint=https://your-webhook.com/endpoint \
     --context notificationEmail=your@email.com
   ```

## 🔑 Finding Your Stack's Unique ID

All resources in this stack include a unique 8-character identifier (e.g., `abc12de3`) that remains stable across deployments. You can find it in several ways:

### Method 1: From Stack Outputs (Recommended)
```bash
# Get any output that includes resource names
aws cloudformation describe-stacks \
  --stack-name AwsCostsStack \
  --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' \
  --output text
# Example output: aws-cost-reports-abc12de3
# The unique ID is: abc12de3
```

### Method 2: From AWS Console
1. Check any resource name in API Gateway, Lambda, or S3
2. Look for the suffix after the last hyphen (e.g., `aws-cost-reporter-abc12de3` → `abc12de3`)

### Method 3: From CloudFormation Resources
```bash
aws cloudformation describe-stack-resources \
  --stack-name AwsCostsStack \
  --logical-resource-id CostReporterFunction \
  --query 'StackResources[0].PhysicalResourceId' \
  --output text
```

Once you have your unique ID, use it to replace `{unique-id}` in commands throughout this documentation.

## ⚙️ Configuration

### Environment Variables / CDK Context

| Variable              | Required | Description                     | Example                                 |
| --------------------- | -------- | ------------------------------- | --------------------------------------- |
| `WEBHOOK_ENDPOINT`    | No       | Webhook URL for cost reports    | `https://n8n.example.com/webhook/costs` |
| `NOTIFICATION_EMAIL`  | No       | Email for SNS notifications     | `admin@example.com`                     |
| `CDK_DEFAULT_ACCOUNT` | Auto     | AWS account ID                  | `123456789012`                          |
| `CDK_DEFAULT_REGION`  | No       | AWS region (default: us-east-1) | `us-east-1`                             |

**Note**: Both webhook and email are optional. Reports are always saved to S3 regardless of notification configuration.

### Scheduled Reports

Reports are automatically triggered at:

- **Daily**: Every day at 8:00 AM UTC
- **Weekly**: Every Monday at 8:00 AM UTC
- **Monthly**: 1st of each month at 8:00 AM UTC

To change the schedule, modify the cron expressions in [`lib/aws-costs-stack.ts`](lib/aws-costs-stack.ts).

## 📡 Manual Triggers

Use the REST API to trigger reports on-demand. **Note:** API key authentication is required.

```bash
# Get the API endpoint from stack outputs
API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name AwsCostsStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text)

# Get the API key ID from stack outputs
API_KEY_ID=$(aws cloudformation describe-stacks \
  --stack-name AwsCostsStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiKeyId`].OutputValue' \
  --output text)

# Get the API key value from API Gateway
API_KEY=$(aws apigateway get-api-key \
  --api-key $API_KEY_ID \
  --include-value \
  --query 'value' \
  --output text)

# Trigger daily report (saved to S3 only)
curl -X POST $API_ENDPOINT \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"period": "day"}'

# Trigger weekly report with email notification
curl -X POST $API_ENDPOINT \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"period": "week", "email": "recipient@example.com"}'

# Trigger monthly report
curl -X POST $API_ENDPOINT \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"period": "month"}'
```

### API Request Format

**Endpoint**: `POST /report`

**Request Body**:

```json
{
  "period": "day" | "week" | "month",  // Required. Must be one of these values
  "email": "optional@example.com"      // Optional. Must be valid email format if provided
}
```

**Validation Rules**:
- `period`: **Required**. Must be exactly one of: `"day"`, `"week"`, or `"month"`
- `email`: **Optional**. Must be a valid email format if provided

**Success Response** (HTTP 200):

```json
{
  "success": true,
  "report": {
    "period": "day",
    "startDate": "2025-12-24",
    "endDate": "2025-12-25",
    "totalCost": {
      "amount": "123.45",
      "unit": "USD"
    },
    "breakdown": [...]
  },
  "s3Location": "s3://bucket/2025/12/24/daily-2025-12-24.json",
  "webhookSent": true,
  "emailSent": false
}
```

**Validation Error Response** (HTTP 400):

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "period",
      "message": "Period must be one of: day, week, month"
    }
  ]
}
```

**Other Error Responses**:

```json
// Invalid JSON (HTTP 400)
{
  "success": false,
  "error": "Invalid JSON in request body"
}

// Server error (HTTP 500)
{
  "success": false,
  "error": "Internal server error"
}
```

## 🔑 API Key Management

The API requires authentication using native API Gateway keys with usage plans to prevent unauthorized access.

### Retrieving Your API Key

#### Method 1: AWS CLI (Recommended)

```bash
# Get the API key ID from stack outputs
API_KEY_ID=$(aws cloudformation describe-stacks \
  --stack-name AwsCostsStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiKeyId`].OutputValue' \
  --output text)

# Get the API key value
aws apigateway get-api-key \
  --api-key $API_KEY_ID \
  --include-value \
  --query 'value' \
  --output text
```

#### Method 2: AWS Console (Easiest)

1. Go to [AWS Console → API Gateway](https://console.aws.amazon.com/apigateway/home)
2. Click **"API Keys"** in the left sidebar
3. Find key named `cost-reporter-api-key-{unique-id}` (where `{unique-id}` is an 8-character hash)
4. Click **"Show"** to reveal the key value
5. Direct URL: `https://console.aws.amazon.com/apigateway/home?region=us-east-1#/api-keys`
   _(Replace `us-east-1` with your region)_

### Creating Additional API Keys

You can create additional API keys through the AWS Console or CLI:

#### Via Console:
1. Go to API Gateway → API Keys → **Create API Key**
2. Name it (e.g., `cost-reporter-api-key-2`)
3. Add it to the usage plan named `cost-reporter-usage-plan-{unique-id}`

#### Via CLI:
```bash
# Create new API key
NEW_KEY_ID=$(aws apigateway create-api-key \
  --name cost-reporter-api-key-2 \
  --enabled \
  --query 'id' \
  --output text)

# Get usage plan ID (replace {unique-id} with your stack's unique ID)
USAGE_PLAN_ID=$(aws apigateway get-usage-plans \
  --query 'items[?name==`cost-reporter-usage-plan-{unique-id}`].id' \
  --output text)

# Associate key with usage plan
aws apigateway create-usage-plan-key \
  --usage-plan-id $USAGE_PLAN_ID \
  --key-id $NEW_KEY_ID \
  --key-type API_KEY
```

### Rotating API Keys

1. Create a new API key (see above)
2. Add it to the usage plan
3. Update your applications to use the new key
4. Once migration is complete, disable or delete the old key:

```bash
# Disable old key
aws apigateway update-api-key \
  --api-key <OLD_KEY_ID> \
  --patch-operations op=replace,path=/enabled,value=false

# Or delete it
aws apigateway delete-api-key --api-key <OLD_KEY_ID>
```

### Usage Plan Limits

Default limits for the API:
- **Rate Limit**: 5 requests/second
- **Burst Limit**: 10 requests
- **Monthly Quota**: 1000 requests/month

Modify these limits in [lib/aws-costs-stack.ts](lib/aws-costs-stack.ts) under the usage plan configuration.

## 📊 Report Formats

### S3 Storage

All reports are automatically saved to S3 with the following structure:

```
s3://aws-cost-reports-{unique-id}/
├── 2025/
│   ├── 12/
│   │   ├── 24/
│   │   │   ├── daily-2025-12-24.json
│   │   │   ├── weekly-2024-12-18-to-2025-12-24.json
│   │   │   └── monthly-2025-11-01-to-2025-12-01.json
```

**Note**: `{unique-id}` is a stable 8-character hash generated by CDK based on the stack's construct path. This ensures unique resource names while remaining consistent across deployments.

Reports are retained for 365 days with automatic lifecycle management.

### Email Format

Plain text emails include:

- **Period Summary**: Report type and date range
- **Cost Summary**: Total usage cost, credits applied, and net amount
- **Service Breakdown**: Sorted by cost (highest to lowest)
- **Region Details**: For each service, costs broken down by AWS region
- **ASCII Formatting**: Clean, readable layout with section dividers

**Note**: Plain text format ensures compatibility with all email clients, including Amazon SNS email subscriptions which don't support HTML rendering.

### Webhook Payload

JSON format matching the API response structure above. Includes full cost breakdown by service and region.

## 💰 Cost Estimate

Expected monthly costs (assuming default configuration):

| Service                | Usage                       | Monthly Cost       |
| ---------------------- | --------------------------- | ------------------ |
| Lambda (Cost Reporter) | ~93 invocations/month × 30s | $0.20              |
| S3                     | 365 files × 10KB            | $0.25              |
| Cost Explorer API      | 93 calls × $0.01            | $0.93              |
| REST API Gateway       | ~20 API requests/month      | $0.07              |
| CloudWatch Logs        | ~500MB/month                | $0.50              |
| SNS                    | Email notifications         | $0.00 (free tier)  |
| **Total**              |                             | **~$2.95/month**   |

**Optimizations Applied:**

- ✅ Native API Gateway authentication (no Lambda authorizer needed)
- ✅ Usage plans with monthly quotas (1000 requests/month included)
- ✅ ARM64 Lambda architecture (20% cost reduction)
- ✅ Credits tracking separates usage from promotional credits
- ✅ Efficient CloudWatch logging (INFO level only)

## 🛠️ Development

### Project Structure

```
aws-costs/
├── bin/
│   └── aws-costs.ts          # CDK app entry point
├── lib/
│   └── aws-costs-stack.ts    # Infrastructure definition
├── lambda/
│   └── cost-reporter/
│       ├── index.ts           # Lambda handler
│       ├── cost-fetcher.ts    # Cost Explorer integration
│       ├── email-formatter.ts # HTML email generator
│       ├── storage.ts         # S3 operations
│       ├── webhook.ts         # Webhook delivery
│       └── types.ts           # TypeScript interfaces
├── .github/
│   └── workflows/
│       └── deploy.yml         # GitHub Actions deployment
└── README.md
```

### Local Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Watch mode
npm run watch

# Run tests
npm test

# Synthesize CloudFormation
cdk synth

# Deploy
cdk deploy
```

## 🔒 Security Best Practices

1. **IAM Permissions**: The Lambda function has minimal permissions (Cost Explorer read, SNS publish, S3 write)
2. **API Security**: ✅ Native API Gateway key authentication with usage plans
3. **API Key Management**:
   - **Never commit API keys to Git** - always retrieve from API Gateway when needed
   - **Store keys securely** - use environment variables or secret management for applications
   - **Rotate keys regularly** - recommended every 90 days (can be done without redeployment)
   - **Monitor usage** - API Gateway provides built-in usage metrics per key
   - **Use separate keys** - create different keys for different environments (production, staging, etc.)
   - **Disable compromised keys immediately** - no redeployment needed
4. **Rate Limiting**: API Gateway throttling (5 req/sec) + monthly quota (1000 requests/month)
5. **Usage Plans**: Prevents abuse with automatic quota enforcement
6. **Secrets Management**: For sensitive webhook URLs, use AWS Secrets Manager instead of environment variables
7. **S3 Encryption**: All reports are encrypted at rest with S3 managed encryption
8. **VPC**: Lambda doesn't require VPC access (uses AWS service APIs only)

## 🐛 Troubleshooting

### Reports Not Received

1. **Check CloudWatch Logs**:

   ```bash
   # Replace {unique-id} with your stack's unique ID
   aws logs tail /aws/lambda/aws-cost-reporter-{unique-id} --follow
   ```

2. **Verify EventBridge Rules**:

   ```bash
   aws events list-rules --name-prefix cost-report
   ```

3. **Check Dead Letter Queue**:
   ```bash
   # Replace {unique-id} with your stack's unique ID
   aws sqs receive-message --queue-url $(aws sqs get-queue-url --queue-name cost-reporter-dlq-{unique-id} --query QueueUrl --output text)
   ```

### Email Not Received

1. Confirm SNS subscription in your email
2. Check spam folder
3. Verify SNS topic subscriptions:
   ```bash
   aws sns list-subscriptions-by-topic --topic-arn $(aws cloudformation describe-stacks --stack-name AwsCostsStack --query 'Stacks[0].Outputs[?OutputKey==`SNSTopicArn`].OutputValue' --output text)
   ```

### Webhook Failures

The Lambda function retries webhook deliveries 3 times with exponential backoff. Check CloudWatch Logs for detailed error messages.

## 📝 License

MIT License - Feel free to fork and customize for your needs!

## 🤝 Need Help?

This is an open-source project, but if you need:

- **Custom implementations** tailored to your organization
- **Multi-account support** with AWS Organizations
- **Advanced features** (anomaly detection, budget tracking, cost forecasting)
- **Professional support** and maintenance
- **Training** for your team

**Get in touch**: [king.ohaneme@gmail.com](mailto:king.ohaneme@gmail.com)

I offer consulting services to help organizations optimize their AWS costs and automate their cloud operations.

---

**Connect with me [Kingsley Ohaneme](https://github.com/ohansck)**

_Star this repo if you find it useful!_ ⭐
