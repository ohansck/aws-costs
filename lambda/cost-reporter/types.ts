export type ReportPeriod = 'day' | 'week' | 'month';

export type RecordType = 'Usage' | 'Credit' | 'Tax' | 'Refund' | 'Discount';

export interface CostBreakdownItem {
  service: string;
  region: string;
  recordType?: RecordType;
  cost: {
    amount: string;
    unit: string;
  };
}

export interface CreditBreakdownItem {
  service: string;
  region: string;
  creditAmount: {
    amount: string;
    unit: string;
  };
}

export interface CostReport {
  period: ReportPeriod;
  startDate: string;
  endDate: string;
  totalUsageCost: {
    amount: string;
    unit: string;
  };
  totalCreditsApplied: {
    amount: string;
    unit: string;
  };
  totalCost: {
    amount: string;
    unit: string;
  };
  breakdown: CostBreakdownItem[];
  usageBreakdown: CostBreakdownItem[];
  creditsBreakdown: CreditBreakdownItem[];
  generatedAt: string;
}

export interface EventBridgeEvent {
  source: 'aws.events';
  'detail-type': string;
  detail: {
    period: ReportPeriod;
  };
}

export interface APIGatewayEvent {
  body: string;
  requestContext: {
    requestId: string;
  };
}

export interface LambdaResponse {
  statusCode: number;
  body: string;
  headers?: Record<string, string>;
}

export interface DateRange {
  start: string;
  end: string;
}
