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

export function formatCostReportAsPlainText(report: CostReport): string {
  // Sort usage breakdown by cost
  const sortedUsageBreakdown = [...report.usageBreakdown].sort(
    (a, b) => parseFloat(b.cost.amount) - parseFloat(a.cost.amount)
  );

  // Sort credits breakdown by credit amount
  const sortedCreditsBreakdown = [...report.creditsBreakdown].sort(
    (a, b) => parseFloat(b.creditAmount.amount) - parseFloat(a.creditAmount.amount)
  );

  const periodLabel = formatPeriodLabel(report.period, report.startDate, report.endDate);

  let plainText = `
================================================================================
                          AWS COST REPORT
================================================================================

${periodLabel}
Generated: ${new Date(report.generatedAt).toLocaleString()}

--------------------------------------------------------------------------------
SUMMARY
--------------------------------------------------------------------------------

Total Usage Cost:        $${report.totalUsageCost.amount}
Total Credits Applied:  -$${report.totalCreditsApplied.amount}
                        ─────────────────
NET AMOUNT:             $${report.totalCost.amount}

--------------------------------------------------------------------------------
USAGE COSTS BY SERVICE
--------------------------------------------------------------------------------
`;

  // Add usage breakdown
  sortedUsageBreakdown.forEach((item) => {
    const cost = parseFloat(item.cost.amount);
    const costStr = cost.toFixed(2).padStart(10);
    plainText += `\n${item.service.padEnd(35)} ${item.region.padEnd(15)} $${costStr}`;
  });

  // Add credits section if there are any
  if (sortedCreditsBreakdown.length > 0) {
    plainText += `

--------------------------------------------------------------------------------
AWS CREDITS APPLIED
--------------------------------------------------------------------------------
`;
    sortedCreditsBreakdown.forEach((item) => {
      const creditAmount = Math.abs(parseFloat(item.creditAmount.amount));
      const creditStr = creditAmount.toFixed(2).padStart(10);
      plainText += `\n${item.service.padEnd(35)} ${item.region.padEnd(15)} -$${creditStr}`;
    });
  }

  plainText += `

================================================================================
`;

  return plainText;
}

function getCostClass(cost: number): string {
  if (cost >= 100) return 'cost-high';
  if (cost >= 10) return 'cost-medium';
  return 'cost-low';
}

export function formatCostReportAsHTML(report: CostReport): string {
  // Sort usage breakdown by cost
  const sortedUsageBreakdown = [...report.usageBreakdown].sort(
    (a, b) => parseFloat(b.cost.amount) - parseFloat(a.cost.amount)
  );

  // Sort credits breakdown by credit amount
  const sortedCreditsBreakdown = [...report.creditsBreakdown].sort(
    (a, b) => parseFloat(b.creditAmount.amount) - parseFloat(a.creditAmount.amount)
  );

  const usageTableRows = sortedUsageBreakdown
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

  const creditsTableRows = sortedCreditsBreakdown
    .map((item) => {
      const creditAmount = Math.abs(parseFloat(item.creditAmount.amount));
      return `
        <tr>
          <td>${item.service}</td>
          <td>${item.region}</td>
          <td style="text-align: right; color: #067f68; font-weight: bold;">-$${creditAmount.toFixed(2)}</td>
        </tr>`;
    })
    .join('');

  const creditsSection = report.creditsBreakdown.length > 0 ? `
    <div class="section">
      <h2 style="color: #232f3e; margin-top: 30px; margin-bottom: 10px;">AWS Credits Applied</h2>
      <table>
        <thead>
          <tr>
            <th>Service</th>
            <th>Region</th>
            <th style="text-align: right;">Credit Amount</th>
          </tr>
        </thead>
        <tbody>
          ${creditsTableRows}
        </tbody>
      </table>
    </div>` : '';

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
    .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .summary-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 16px; }
    .summary-row.total { font-weight: bold; font-size: 18px; border-top: 2px solid #232f3e; margin-top: 10px; padding-top: 15px; }
    .summary-label { color: #666; }
    .summary-value { color: #232f3e; }
    .summary-value.credit { color: #067f68; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #232f3e; color: white; padding: 12px; text-align: left; font-weight: normal; }
    td { padding: 12px; border-bottom: 1px solid #ddd; }
    tr:last-child td { border-bottom: none; }
    .cost-high { color: #d13212; font-weight: bold; }
    .cost-medium { color: #ff9900; }
    .cost-low { color: #067f68; }
    .section { margin-bottom: 30px; }
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

    <div class="summary">
      <div class="summary-row">
        <span class="summary-label">Total Usage Cost:</span>
        <span class="summary-value">$${report.totalUsageCost.amount}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Total Credits Applied:</span>
        <span class="summary-value credit">-$${report.totalCreditsApplied.amount}</span>
      </div>
      <div class="summary-row total">
        <span class="summary-label">Net Amount:</span>
        <span class="summary-value">$${report.totalCost.amount}</span>
      </div>
    </div>

    <div class="section">
      <h2 style="color: #232f3e; margin-top: 30px; margin-bottom: 10px;">Usage Costs by Service</h2>
      <table>
        <thead>
          <tr>
            <th>Service</th>
            <th>Region</th>
            <th style="text-align: right;">Cost</th>
          </tr>
        </thead>
        <tbody>
          ${usageTableRows}
        </tbody>
      </table>
    </div>

    ${creditsSection}

    <div class="footer">
      <p>Generated at ${new Date(report.generatedAt).toLocaleString()}</p>
    </div>
  </div>
</body>
</html>`;
}
