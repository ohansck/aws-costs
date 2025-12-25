import {
  CostExplorerClient,
  GetCostAndUsageCommand,
} from '@aws-sdk/client-cost-explorer';
import { CostReport, ReportPeriod, DateRange, CostBreakdownItem, RecordType, CreditBreakdownItem } from './types';

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

    default: {
      throw new Error(`Invalid period: ${period}. Expected 'day', 'week', or 'month'.`);
    }
  }
}

export async function fetchCostReport(period: ReportPeriod, isScheduledEvent: boolean = false): Promise<CostReport> {
  const dateRange = getDateRangeForPeriod(period, isScheduledEvent);

  console.log(`Fetching ${period} cost report for ${dateRange.start} to ${dateRange.end}`);

  // Fetch usage costs (filter for Usage record type)
  const usageCommand = new GetCostAndUsageCommand({
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
    Filter: {
      Dimensions: {
        Key: 'RECORD_TYPE',
        Values: ['Usage'],
      },
    },
  });

  // Fetch credit costs (filter for Credit record type)
  const creditsCommand = new GetCostAndUsageCommand({
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
    Filter: {
      Dimensions: {
        Key: 'RECORD_TYPE',
        Values: ['Credit'],
      },
    },
  });

  // Execute both queries in parallel
  const [usageResponse, creditsResponse] = await Promise.all([
    ce.send(usageCommand),
    ce.send(creditsCommand),
  ]);

  // Aggregate usage results across all days
  const usageMap = new Map<string, { service: string; region: string; amount: number; unit: string }>();

  for (const timeEntry of usageResponse.ResultsByTime ?? []) {
    for (const group of timeEntry.Groups ?? []) {
      const service = group.Keys?.[0] ?? 'Unknown';
      const region = group.Keys?.[1] ?? 'Unknown';
      const key = `${service}::${region}`;
      const amount = parseFloat(group.Metrics?.UnblendedCost?.Amount ?? '0');
      const unit = group.Metrics?.UnblendedCost?.Unit ?? 'USD';

      const existing = usageMap.get(key);
      if (existing) {
        existing.amount += amount;
      } else {
        usageMap.set(key, { service, region, amount, unit });
      }
    }
  }

  const usageBreakdown: CostBreakdownItem[] = Array.from(usageMap.values()).map((item) => ({
    service: item.service,
    region: item.region,
    recordType: 'Usage' as RecordType,
    cost: {
      amount: item.amount.toFixed(10).replace(/\.?0+$/, ''),
      unit: item.unit,
    },
  }));

  // Aggregate credits results across all days
  const creditsMap = new Map<string, { service: string; region: string; amount: number; unit: string }>();

  for (const timeEntry of creditsResponse.ResultsByTime ?? []) {
    for (const group of timeEntry.Groups ?? []) {
      const service = group.Keys?.[0] ?? 'Unknown';
      const region = group.Keys?.[1] ?? 'Unknown';
      const key = `${service}::${region}`;
      const amount = parseFloat(group.Metrics?.UnblendedCost?.Amount ?? '0');
      const unit = group.Metrics?.UnblendedCost?.Unit ?? 'USD';

      const existing = creditsMap.get(key);
      if (existing) {
        existing.amount += amount;
      } else {
        creditsMap.set(key, { service, region, amount, unit });
      }
    }
  }

  const creditsBreakdown: CreditBreakdownItem[] = Array.from(creditsMap.values()).map((item) => ({
    service: item.service,
    region: item.region,
    creditAmount: {
      amount: item.amount.toFixed(10).replace(/\.?0+$/, ''),
      unit: item.unit,
    },
  }));

  // Combine for full breakdown (for backwards compatibility)
  const breakdown: CostBreakdownItem[] = [
    ...usageBreakdown,
    ...creditsBreakdown.map(c => ({
      service: c.service,
      region: c.region,
      recordType: 'Credit' as RecordType,
      cost: c.creditAmount,
    })),
  ];

  // Calculate totals
  const totalUsageCost = usageBreakdown.reduce((sum, item) => {
    return sum + parseFloat(item.cost.amount);
  }, 0);

  const totalCreditsApplied = creditsBreakdown.reduce((sum, item) => {
    return sum + Math.abs(parseFloat(item.creditAmount.amount));
  }, 0);

  const netTotalCost = totalUsageCost - totalCreditsApplied;

  const report: CostReport = {
    period,
    startDate: dateRange.start,
    endDate: dateRange.end,
    totalUsageCost: {
      amount: totalUsageCost.toFixed(2),
      unit: 'USD',
    },
    totalCreditsApplied: {
      amount: totalCreditsApplied.toFixed(2),
      unit: 'USD',
    },
    totalCost: {
      amount: netTotalCost.toFixed(2),
      unit: 'USD',
    },
    breakdown,
    usageBreakdown,
    creditsBreakdown,
    generatedAt: new Date().toISOString(),
  };

  console.log(`Cost report generated: ${report.breakdown.length} items (${usageBreakdown.length} usage, ${creditsBreakdown.length} credits), usage: $${report.totalUsageCost.amount}, credits: $${report.totalCreditsApplied.amount}, net: $${report.totalCost.amount}`);

  return report;
}
