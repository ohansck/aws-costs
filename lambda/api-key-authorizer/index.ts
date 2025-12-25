import type {
  APIGatewayRequestAuthorizerEventV2,
  APIGatewaySimpleAuthorizerResult
} from 'aws-lambda';

// Get valid API keys from environment variable (comma-separated)
const VALID_API_KEYS = process.env.API_KEYS?.split(',').map(k => k.trim()) || [];

/**
 * Lambda authorizer handler for API key validation
 */
export const handler = async (
  event: APIGatewayRequestAuthorizerEventV2
): Promise<APIGatewaySimpleAuthorizerResult> => {
  console.log('Authorization attempt:', {
    routeArn: event.routeArn,
    requestTime: event.requestContext.time,
    sourceIp: event.requestContext.http.sourceIp,
  });

  // Extract API key from header
  const apiKey = event.headers?.['x-api-key'];

  if (!apiKey) {
    console.warn('No API key provided');
    return { isAuthorized: false };
  }

  // Validate API key
  if (VALID_API_KEYS.includes(apiKey)) {
    console.log('Valid API key provided');
    return { isAuthorized: true };
  } else {
    console.warn('Invalid API key provided');
    return { isAuthorized: false };
  }
};
