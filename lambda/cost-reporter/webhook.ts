import https from 'https';
import { URL } from 'url';
import { CostReport } from './types';

async function sendToEndpoint(endpoint: string, data: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint);
    const payload = JSON.stringify(data);

    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(
              new Error(
                `Webhook request failed with status ${res.statusCode}: ${responseBody}`
              )
            );
          }
        });
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendToWebhook(
  endpoint: string,
  report: CostReport
): Promise<void> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Sending report to webhook (attempt ${attempt}/${maxRetries}): ${endpoint}`);
      await sendToEndpoint(endpoint, report);
      console.log('Successfully sent report to webhook');
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Webhook delivery attempt ${attempt} failed:`, lastError.message);

      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        console.log(`Retrying in ${backoffMs}ms...`);
        await sleep(backoffMs);
      }
    }
  }

  throw new Error(
    `Failed to deliver webhook after ${maxRetries} attempts: ${lastError?.message}`
  );
}
