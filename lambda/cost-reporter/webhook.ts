import https from 'https';
import { URL } from 'url';
import { CostReport } from './types';

function validateWebhookUrl(endpoint: string): void {
  let url: URL;

  try {
    url = new URL(endpoint);
  } catch (e) {
    throw new Error('Invalid webhook URL format');
  }

  // Ensure HTTPS only
  if (url.protocol !== 'https:') {
    throw new Error('Webhook endpoint must use HTTPS protocol');
  }

  // Block private/internal IP addresses to prevent SSRF attacks
  const hostname = url.hostname.toLowerCase();

  // Block localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    throw new Error('Webhook endpoint cannot be localhost');
  }

  // Block private IPv4 ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipMatch = hostname.match(ipv4Regex);
  if (ipMatch) {
    const [, oct1, oct2] = ipMatch.map(Number);
    if (
      oct1 === 10 ||
      (oct1 === 172 && oct2 >= 16 && oct2 <= 31) ||
      (oct1 === 192 && oct2 === 168) ||
      oct1 === 169 && oct2 === 254  // Link-local
    ) {
      throw new Error('Webhook endpoint cannot be a private IP address');
    }
  }
}

async function sendToEndpoint(endpoint: string, data: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    // Validate URL before sending
    try {
      validateWebhookUrl(endpoint);
    } catch (error) {
      reject(error);
      return;
    }

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

  // Redact webhook URL in logs (show only domain)
  const redactedEndpoint = endpoint.replace(/^(https:\/\/[^\/]+)(.*)$/, '$1/***');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Sending report to webhook (attempt ${attempt}/${maxRetries}): ${redactedEndpoint}`);
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
