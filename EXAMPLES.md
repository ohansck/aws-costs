# Response Format Examples

This document provides example responses from the AWS Cost Reporter API and scheduled events.

## Table of Contents

- [API Response Format](#api-response-format)
  - [Daily Report (With Credits)](#daily-report-with-credits)
  - [Daily Report (No Credits)](#daily-report-no-credits)
  - [Weekly Report](#weekly-report)
  - [Monthly Report](#monthly-report)
- [Scheduler/EventBridge Format](#schedulereventbridge-format)
- [Understanding the Response Fields](#understanding-the-response-fields)

---

## API Response Format

All API responses follow this general structure when successful:

```json
{
  "success": true,
  "report": {
    /* Cost report data */
  },
  "s3Location": "s3://bucket/path/to/report.json",
  "webhookSent": true,
  "emailSent": false
}
```

### Daily Report (With Credits)

When AWS promotional credits are applied to your account, the response includes both usage costs and credit details:

```json
{
  "success": true,
  "report": {
    "period": "day",
    "startDate": "2025-12-24",
    "endDate": "2025-12-25",
    "totalUsageCost": {
      "amount": "1.07",
      "unit": "USD"
    },
    "totalCreditsApplied": {
      "amount": "1.07",
      "unit": "USD"
    },
    "totalCost": {
      "amount": "-0.00",
      "unit": "USD"
    },
    "breakdown": [
      {
        "service": "AWS Amplify",
        "region": "eu-west-1",
        "recordType": "Usage",
        "cost": {
          "amount": "0.0131292066",
          "unit": "USD"
        }
      },
      {
        "service": "Amazon API Gateway",
        "region": "us-east-1",
        "recordType": "Credit",
        "cost": {
          "amount": "-0.0000405",
          "unit": "USD"
        }
      }
    ],
    "usageBreakdown": [
      {
        "service": "AWS Amplify",
        "region": "eu-west-1",
        "recordType": "Usage",
        "cost": {
          "amount": "0.0131292066",
          "unit": "USD"
        }
      }
    ],
    "creditsBreakdown": [
      {
        "service": "Amazon API Gateway",
        "region": "us-east-1",
        "creditAmount": {
          "amount": "-0.0000405",
          "unit": "USD"
        }
      }
    ],
    "generatedAt": "2025-12-25T08:00:31.294Z"
  },
  "s3Location": "s3://aws-cost-reports-abc12de3/2025/12/24/daily-2025-12-24.json",
  "webhookSent": true,
  "emailSent": false
}
```

**Key Points:**

- `totalUsageCost`: Total AWS service usage before credits
- `totalCreditsApplied`: Total promotional credits applied
- `totalCost`: Net amount (usage - credits)
- `breakdown`: Combined array with both Usage and Credit records
- `usageBreakdown`: Only usage costs (filtered)
- `creditsBreakdown`: Only credits (filtered)

### Daily Report (No Credits)

When no credits are applied to your account:

```json
{
  "success": true,
  "report": {
    "period": "day",
    "startDate": "2025-12-24",
    "endDate": "2025-12-25",
    "totalUsageCost": {
      "amount": "18.43",
      "unit": "USD"
    },
    "totalCreditsApplied": {
      "amount": "0.00",
      "unit": "USD"
    },
    "totalCost": {
      "amount": "18.43",
      "unit": "USD"
    },
    "breakdown": [
      {
        "service": "AWS Amplify",
        "region": "us-east-1",
        "recordType": "Usage",
        "cost": {
          "amount": "0.7749938816",
          "unit": "USD"
        }
      },
      {
        "service": "Amazon EC2",
        "region": "us-east-1",
        "recordType": "Usage",
        "cost": {
          "amount": "12.45",
          "unit": "USD"
        }
      }
    ],
    "usageBreakdown": [
      {
        "service": "AWS Amplify",
        "region": "us-east-1",
        "recordType": "Usage",
        "cost": {
          "amount": "0.7749938816",
          "unit": "USD"
        }
      }
    ],
    "creditsBreakdown": [],
    "generatedAt": "2025-12-25T08:00:31.294Z"
  },
  "s3Location": "s3://aws-cost-reports-abc12de3/2025/12/24/daily-2025-12-24.json",
  "webhookSent": false,
  "emailSent": true
}
```

**Key Points:**

- `totalCost` equals `totalUsageCost` when no credits
- `creditsBreakdown` is an empty array
- Only `Usage` recordType in breakdown

### Weekly Report

Weekly reports aggregate 7 days of cost data:

```json
{
  "success": true,
  "report": {
    "period": "week",
    "startDate": "2025-12-17",
    "endDate": "2025-12-24",
    "totalUsageCost": {
      "amount": "145.67",
      "unit": "USD"
    },
    "totalCreditsApplied": {
      "amount": "12.34",
      "unit": "USD"
    },
    "totalCost": {
      "amount": "133.33",
      "unit": "USD"
    },
    "breakdown": [
      {
        "service": "Amazon EC2",
        "region": "us-east-1",
        "recordType": "Usage",
        "cost": {
          "amount": "89.42",
          "unit": "USD"
        }
      },
      {
        "service": "Amazon S3",
        "region": "us-east-1",
        "recordType": "Usage",
        "cost": {
          "amount": "23.15",
          "unit": "USD"
        }
      }
    ],
    "usageBreakdown": [
      /* ... */
    ],
    "creditsBreakdown": [
      /* ... */
    ],
    "generatedAt": "2025-12-25T08:00:31.294Z"
  },
  "s3Location": "s3://aws-cost-reports-abc12de3/2025/12/24/weekly-2025-12-17-to-2025-12-24.json",
  "webhookSent": true,
  "emailSent": true
}
```

### Monthly Report

Monthly reports cover an entire calendar month:

```json
{
  "success": true,
  "report": {
    "period": "month",
    "startDate": "2025-11-01",
    "endDate": "2025-12-01",
    "totalUsageCost": {
      "amount": "623.45",
      "unit": "USD"
    },
    "totalCreditsApplied": {
      "amount": "50.00",
      "unit": "USD"
    },
    "totalCost": {
      "amount": "573.45",
      "unit": "USD"
    },
    "breakdown": [
      {
        "service": "Amazon EC2",
        "region": "us-east-1",
        "recordType": "Usage",
        "cost": {
          "amount": "412.88",
          "unit": "USD"
        }
      },
      {
        "service": "Amazon RDS",
        "region": "us-east-1",
        "recordType": "Usage",
        "cost": {
          "amount": "98.67",
          "unit": "USD"
        }
      }
    ],
    "usageBreakdown": [
      /* ... */
    ],
    "creditsBreakdown": [
      /* ... */
    ],
    "generatedAt": "2025-12-01T08:00:31.294Z"
  },
  "s3Location": "s3://aws-cost-reports-abc12de3/2025/12/01/monthly-2025-11-01-to-2025-12-01.json",
  "webhookSent": true,
  "emailSent": false
}
```

**Note:** For scheduled monthly reports (triggered on the 1st of each month), the dates cover the previous complete month. For manual API triggers, it covers the current month-to-date.

---

## Scheduler/EventBridge Format

When EventBridge scheduled rules trigger the Lambda function, the report data is saved to S3 without the API wrapper. This is the format stored in S3 and sent to webhooks:

```json
{
  "period": "day",
  "startDate": "2025-12-25",
  "endDate": "2025-12-26",
  "totalUsageCost": {
    "amount": "1.82",
    "unit": "USD"
  },
  "totalCreditsApplied": {
    "amount": "1.82",
    "unit": "USD"
  },
  "totalCost": {
    "amount": "-0.00",
    "unit": "USD"
  },
  "breakdown": [
    {
      "service": "AWS Amplify",
      "region": "eu-west-1",
      "recordType": "Usage",
      "cost": {
        "amount": "0.0137689917",
        "unit": "USD"
      }
    },
    {
      "service": "AWS App Runner",
      "region": "eu-west-1",
      "recordType": "Usage",
      "cost": {
        "amount": "0.126",
        "unit": "USD"
      }
    },
    {
      "service": "AWS Cost Explorer",
      "region": "us-east-1",
      "recordType": "Usage",
      "cost": {
        "amount": "0.66",
        "unit": "USD"
      }
    },
    {
      "service": "Amazon Relational Database Service",
      "region": "af-south-1",
      "recordType": "Usage",
      "cost": {
        "amount": "0.4810654965",
        "unit": "USD"
      }
    },
    {
      "service": "Amazon Simple Storage Service",
      "region": "us-east-1",
      "recordType": "Usage",
      "cost": {
        "amount": "0.0011080469",
        "unit": "USD"
      }
    },
    {
      "service": "AWS Amplify",
      "region": "eu-west-1",
      "recordType": "Credit",
      "cost": {
        "amount": "-0.0137689906",
        "unit": "USD"
      }
    },
    {
      "service": "AWS Cost Explorer",
      "region": "us-east-1",
      "recordType": "Credit",
      "cost": {
        "amount": "-0.66",
        "unit": "USD"
      }
    }
  ],
  "usageBreakdown": [
    {
      "service": "AWS Amplify",
      "region": "eu-west-1",
      "recordType": "Usage",
      "cost": {
        "amount": "0.0137689917",
        "unit": "USD"
      }
    },
    {
      "service": "AWS Cost Explorer",
      "region": "us-east-1",
      "recordType": "Usage",
      "cost": {
        "amount": "0.66",
        "unit": "USD"
      }
    }
  ],
  "creditsBreakdown": [
    {
      "service": "AWS Amplify",
      "region": "eu-west-1",
      "creditAmount": {
        "amount": "-0.0137689906",
        "unit": "USD"
      }
    },
    {
      "service": "AWS Cost Explorer",
      "region": "us-east-1",
      "creditAmount": {
        "amount": "-0.66",
        "unit": "USD"
      }
    }
  ],
  "generatedAt": "2025-12-26T08:00:31.294Z"
}
```

**Key Differences from API Response:**

- No `success` field
- No `s3Location`, `webhookSent`, or `emailSent` metadata
- Direct report object (not wrapped)
- This is what gets stored in S3 and sent to webhook endpoints

---

## Understanding the Response Fields

### Top-Level Fields

| Field         | Type    | Description                                                            |
| ------------- | ------- | ---------------------------------------------------------------------- |
| `success`     | boolean | Indicates if the API request was successful (API responses only)       |
| `report`      | object  | The cost report data (API responses only)                              |
| `s3Location`  | string  | S3 URI where the report was saved (API responses only)                 |
| `webhookSent` | boolean | Whether the report was sent to a webhook endpoint (API responses only) |
| `emailSent`   | boolean | Whether the report was sent via SNS email (API responses only)         |

### Report Object Fields

| Field                 | Type   | Description                                          |
| --------------------- | ------ | ---------------------------------------------------- |
| `period`              | string | Report period: `"day"`, `"week"`, or `"month"`       |
| `startDate`           | string | Start date in ISO format (YYYY-MM-DD)                |
| `endDate`             | string | End date in ISO format (YYYY-MM-DD)                  |
| `totalUsageCost`      | object | Total AWS usage cost before credits                  |
| `totalCreditsApplied` | object | Total promotional credits applied                    |
| `totalCost`           | object | Net cost (usage - credits)                           |
| `breakdown`           | array  | Combined array of all costs (usage + credits)        |
| `usageBreakdown`      | array  | Array of only usage costs (filtered for convenience) |
| `creditsBreakdown`    | array  | Array of only credits (filtered for convenience)     |
| `generatedAt`         | string | ISO 8601 timestamp when the report was generated     |

### Cost Object Structure

```typescript
{
  "amount": "123.45",  // String representation of cost
  "unit": "USD"         // Currency unit (always USD from AWS API)
}
```

### Breakdown Item Structure

```typescript
{
  "service": "Amazon EC2",           // AWS service name
  "region": "us-east-1",             // AWS region code
  "recordType": "Usage" | "Credit",  // Type of record
  "cost": {                          // Cost details
    "amount": "123.45",
    "unit": "USD"
  }
}
```

### Credits Breakdown Item Structure

```typescript
{
  "service": "Amazon EC2",      // AWS service name
  "region": "us-east-1",        // AWS region code
  "creditAmount": {             // Credit amount (negative value)
    "amount": "-50.00",
    "unit": "USD"
  }
}
```

**Note:** Credits are represented as negative amounts. The `totalCreditsApplied` field shows the absolute value (positive number) for clarity.

---

## Error Response Format

### Validation Errors (HTTP 400)

When input validation fails, the API returns structured error details using Zod validation:

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

**Example: Invalid Email Format**

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

**Example: Multiple Validation Errors**

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "period",
      "message": "Period must be one of: day, week, month"
    },
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### Other Errors

**Invalid JSON (HTTP 400)**

```json
{
  "success": false,
  "error": "Invalid JSON in request body"
}
```

**Unknown Event Type (HTTP 400)**

```json
{
  "success": false,
  "error": "Unknown event type"
}
```

**Internal Server Error (HTTP 500)**

```json
{
  "success": false,
  "error": "Internal server error"
}
```

**Status Codes:**

- `400 Bad Request`: Validation errors, invalid JSON, or unknown event type
- `500 Internal Server Error`: Server-side errors (generic message for security)

---

## File Locations in S3

Reports are organized by date in S3:

```
s3://aws-cost-reports-{unique-id}/
├── 2025/
│   ├── 12/
│   │   ├── 24/
│   │   │   ├── daily-2025-12-24.json
│   │   │   ├── weekly-2025-12-17-to-2025-12-24.json
│   │   ├── 25/
│   │   │   ├── daily-2025-12-25.json
│   ├── 11/
│   │   ├── 01/
│   │   │   ├── monthly-2025-10-01-to-2025-11-01.json
```

Files are stored in the scheduler/EventBridge format (without API wrapper).

---

## Additional Resources

- [README.md](README.md) - Full project documentation
- [API Documentation](README.md#-manual-triggers) - API usage and authentication
- [Cost Explorer API](https://docs.aws.amazon.com/aws-cost-management/latest/APIReference/API_GetCostAndUsage.html) - AWS documentation
