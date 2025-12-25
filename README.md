# AWS Cost Reporter 📊

> Automated AWS cost reporting with daily, weekly, and monthly schedules. Get cost breakdowns by service and region delivered to your webhook, email, or stored in S3.

[![Deploy with GitHub Actions](https://img.shields.io/badge/Deploy-GitHub%20Actions-2088FF?logo=github-actions&logoColor=white)](https://github.com/yourusername/aws-costs/actions)
[![AWS CDK](https://img.shields.io/badge/AWS-CDK-FF9900?logo=amazon-aws&logoColor=white)](https://aws.amazon.com/cdk/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

## ✨ Features

- **📅 Automated Scheduling**: Daily (8 AM UTC), weekly (Mondays), and monthly (1st of month) reports
- **🔔 Flexible Notifications**:
  - Send to webhook endpoints (n8n, Zapier, custom APIs)
  - Send HTML-formatted emails via Amazon SNS
  - Both webhook and email are optional - use what you need!
- **💾 Historical Storage**: All reports saved to S3 with 365-day retention
- **🌍 Multi-Region**: Automatic cost breakdown by AWS service and region
- **🚀 Manual Triggers**: On-demand reports via HTTP API
- **📈 Beautiful Reports**: HTML emails with color-coded costs and responsive design
- **💰 Cost-Effective**: ~$3/month estimated operational cost

## 🏗️ Architecture

```
┌─────────────┐
│ EventBridge │──┐
│  Schedules  │  │  Daily, Weekly, Monthly
└─────────────┘  │
                 │
┌─────────────┐  │    ┌──────────────┐
│  API Gateway│──┼───▶│    Lambda    │
│  (Manual)   │  │    │   Function   │
└─────────────┘  │    └──────┬───────┘
                 │           │
                 │           ├──▶ Cost Explorer API
                 │           │
                 │           ├──▶ S3 Bucket (Reports)
                 │           │
                 │           ├──▶ Webhook (Optional)
                 │           │
                 │           └──▶ SNS → Email (Optional)
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
             "token.actions.githubusercontent.com:sub": "repo:YOUR_USERNAME/aws-costs:*"
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
   git clone https://github.com/yourusername/aws-costs.git
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

## ⚙️ Configuration

### Environment Variables / CDK Context

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `WEBHOOK_ENDPOINT` | No | Webhook URL for cost reports | `https://n8n.example.com/webhook/costs` |
| `NOTIFICATION_EMAIL` | No | Email for SNS notifications | `admin@example.com` |
| `CDK_DEFAULT_ACCOUNT` | Auto | AWS account ID | `123456789012` |
| `CDK_DEFAULT_REGION` | No | AWS region (default: us-east-1) | `us-east-1` |

**Note**: Both webhook and email are optional. Reports are always saved to S3 regardless of notification configuration.

### Scheduled Reports

Reports are automatically triggered at:
- **Daily**: Every day at 8:00 AM UTC
- **Weekly**: Every Monday at 8:00 AM UTC
- **Monthly**: 1st of each month at 8:00 AM UTC

To change the schedule, modify the cron expressions in [`lib/aws-costs-stack.ts`](lib/aws-costs-stack.ts).

## 📡 Manual Triggers

Use the HTTP API to trigger reports on-demand:

```bash
# Get the API endpoint from stack outputs
API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name AwsCostsStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text)

# Trigger daily report (saved to S3 only)
curl -X POST $API_ENDPOINT \
  -H "Content-Type: application/json" \
  -d '{"period": "day"}'

# Trigger weekly report with email notification
curl -X POST $API_ENDPOINT \
  -H "Content-Type: application/json" \
  -d '{"period": "week", "email": "recipient@example.com"}'

# Trigger monthly report
curl -X POST $API_ENDPOINT \
  -H "Content-Type: application/json" \
  -d '{"period": "month"}'
```

### API Request Format

**Endpoint**: `POST /report`

**Request Body**:
```json
{
  "period": "day" | "week" | "month",
  "email": "optional@example.com"
}
```

**Response**:
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

## 📊 Report Formats

### S3 Storage

All reports are automatically saved to S3 with the following structure:

```
s3://aws-cost-reports-{account-id}/
├── 2025/
│   ├── 12/
│   │   ├── 24/
│   │   │   ├── daily-2025-12-24.json
│   │   │   ├── weekly-2024-12-18-to-2025-12-24.json
│   │   │   └── monthly-2025-11-01-to-2025-12-01.json
```

Reports are retained for 365 days with automatic lifecycle management.

### Email Format

HTML emails include:
- **Total Cost**: Large, prominently displayed
- **Period Summary**: Date range and report type
- **Service Breakdown**: Sortable table by cost
- **Color Coding**:
  - 🟢 Green: < $10
  - 🟡 Yellow: $10-$100
  - 🔴 Red: > $100
- **Responsive Design**: Mobile-friendly

### Webhook Payload

JSON format matching the API response structure above. Includes full cost breakdown by service and region.

## 💰 Cost Estimate

Expected monthly costs (assuming default configuration):

| Service | Usage | Monthly Cost |
|---------|-------|--------------|
| Lambda | ~93 invocations/month × 30s | $0.20 |
| S3 | 365 files × 10KB | $0.25 |
| Cost Explorer API | 93 calls × $0.01 | $0.93 |
| API Gateway | Variable (pay per request) | $0.50 |
| CloudWatch Logs | ~500MB/month | $0.50 |
| SNS | Email notifications | $0.00 (free tier) |
| **Total** | | **~$3.00/month** |

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
2. **API Security**: Consider adding API Gateway authorization for production use
3. **Secrets Management**: For sensitive webhook URLs, use AWS Secrets Manager instead of environment variables
4. **S3 Encryption**: All reports are encrypted at rest with S3 managed encryption
5. **VPC**: Lambda doesn't require VPC access (uses AWS service APIs only)

## 🐛 Troubleshooting

### Reports Not Received

1. **Check CloudWatch Logs**:
   ```bash
   aws logs tail /aws/lambda/aws-cost-reporter --follow
   ```

2. **Verify EventBridge Rules**:
   ```bash
   aws events list-rules --name-prefix cost-report
   ```

3. **Check Dead Letter Queue**:
   ```bash
   aws sqs receive-message --queue-url $(aws sqs get-queue-url --queue-name cost-reporter-dlq --query QueueUrl --output text)
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

**Get in touch**: [your-email@example.com](mailto:your-email@example.com)

I offer consulting services to help organizations optimize their AWS costs and automate their cloud operations.

---

**Made with ❤️ by [Your Name]**

*Star this repo if you find it useful!* ⭐
