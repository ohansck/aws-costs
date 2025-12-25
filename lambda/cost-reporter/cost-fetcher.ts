import {
  CostExplorerClient,
  GetCostAndUsageCommand,
} from '@aws-sdk/client-cost-explorer';
import { CostReport, ReportPeriod, DateRange, CostBreakdownItem } from './types';

const ce = new CostExplorerClient({
  region: 'us-east-1',
});

function getDateRangeForPeriod(period: ReportPeriod, isScheduledEvent: boolean = false): DateRange {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  switch (period) {
    case 'day': {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      return {
        start: yesterday.toISOString().split('T')[0],
        end: today.toISOString().split('T')[0],
      };
    }

    case 'week': {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - 8);
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() - 1);
      return {
        start: weekStart.toISOString().split('T')[0],
        end: weekEnd.toISOString().split('T')[0],
      };
    }

    case 'month': {
      if (isScheduledEvent) {
        // Scheduled trigger: Previous complete month
        const lastMonth = new Date(today);
        lastMonth.setMonth(today.getMonth() - 1);
        const monthStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth(), 1);
        return {
          start: monthStart.toISOString().split('T')[0],
          end: monthEnd.toISOString().split('T')[0],
        };
      } else {
        // Manual API trigger: Current month-to-date
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        return {
          start: monthStart.toISOString().split('T')[0],
          end: today.toISOString().split('T')[0],
        };
      }
    }
  }
}

export async function fetchCostReport(period: ReportPeriod, isScheduledEvent: boolean = false): Promise<CostReport> {
  const dateRange = getDateRangeForPeriod(period, isScheduledEvent);

  console.log(`Fetching ${period} cost report for ${dateRange.start} to ${dateRange.end}`);

  const command = new GetCostAndUsageCommand({
    TimePeriod: {
      Start: dateRange.start,
      End: dateRange.end,
    },
    Granularity: 'DAILY',
    Metrics: ['UnblendedCost'],
    GroupBy: [
      {
        Type: 'DIMENSION',
        Key: 'SERVICE',
      },
      {
        Type: 'DIMENSION',
        Key: 'REGION',
      },
    ],
  });

  const response = await ce.send(command);

  const groups = response.ResultsByTime?.[0]?.Groups ?? [];

  const breakdown: CostBreakdownItem[] = groups.map((g) => ({
    service: g.Keys?.[0] ?? 'Unknown',
    region: g.Keys?.[1] ?? 'Unknown',
    cost: {
      amount: g.Metrics?.UnblendedCost?.Amount ?? '0',
      unit: g.Metrics?.UnblendedCost?.Unit ?? 'USD',
    },
  }));

  const totalCost = breakdown.reduce((sum, item) => {
    return sum + parseFloat(item.cost.amount);
  }, 0);

  const report: CostReport = {
    period,
    startDate: dateRange.start,
    endDate: dateRange.end,
    totalCost: {
      amount: totalCost.toFixed(2),
      unit: 'USD',
    },
    breakdown,
    generatedAt: new Date().toISOString(),
  };

  console.log(`Cost report generated: ${report.breakdown.length} items, total: $${report.totalCost.amount}`);

  return report;
}
