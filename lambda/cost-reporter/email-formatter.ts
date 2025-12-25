import { CostReport, ReportPeriod } from './types';

function formatPeriodLabel(period: ReportPeriod, start: string, end: string): string {
  switch (period) {
    case 'day':
      return `Daily Report - ${start}`;
    case 'week':
      return `Weekly Report - ${start} to ${end}`;
    case 'month':
      return `Monthly Report - ${start} to ${end}`;
  }
}

function getCostClass(cost: number): string {
  if (cost >= 100) return 'cost-high';
  if (cost >= 10) return 'cost-medium';
  return 'cost-low';
}

export function formatCostReportAsHTML(report: CostReport): string {
  const sortedBreakdown = [...report.breakdown].sort(
    (a, b) => parseFloat(b.cost.amount) - parseFloat(a.cost.amount)
  );

  const tableRows = sortedBreakdown
    .map((item) => {
      const cost = parseFloat(item.cost.amount);
      const costClass = getCostClass(cost);
      return `
        <tr>
          <td>${item.service}</td>
          <td>${item.region}</td>
          <td style="text-align: right;" class="${costClass}">$${cost.toFixed(2)}</td>
        </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; margin: 0; }
    .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { text-align: center; margin-bottom: 30px; }
    .header h1 { color: #232f3e; margin: 0 0 10px 0; }
    .total { font-size: 48px; color: #232f3e; font-weight: bold; margin: 10px 0; }
    .period { font-size: 18px; color: #666; margin-top: 10px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #232f3e; color: white; padding: 12px; text-align: left; font-weight: normal; }
    td { padding: 12px; border-bottom: 1px solid #ddd; }
    tr:last-child td { border-bottom: none; }
    .cost-high { color: #d13212; font-weight: bold; }
    .cost-medium { color: #ff9900; }
    .cost-low { color: #067f68; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>AWS Cost Report</h1>
      <div class="total">$${report.totalCost.amount}</div>
      <div class="period">${formatPeriodLabel(report.period, report.startDate, report.endDate)}</div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Service</th>
          <th>Region</th>
          <th style="text-align: right;">Cost</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
    <div class="footer">
      <p>Generated at ${new Date(report.generatedAt).toLocaleString()}</p>
    </div>
  </div>
</body>
</html>`;
}
