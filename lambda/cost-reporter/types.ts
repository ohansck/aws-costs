export type ReportPeriod = 'day' | 'week' | 'month';

export interface CostBreakdownItem {
  service: string;
  region: string;
  cost: {
    amount: string;
    unit: string;
  };
}

export interface CostReport {
  period: ReportPeriod;
  startDate: string;
  endDate: string;
  totalCost: {
    amount: string;
    unit: string;
  };
  breakdown: CostBreakdownItem[];
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
