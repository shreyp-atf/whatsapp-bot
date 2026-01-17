/**
 * Webhook utility functions
 */

import { createHmac } from 'crypto';

/**
 * Verify webhook signature using HMAC SHA-256
 */
export function verifySignature(rawBody: Buffer, signature: string | undefined, signingKey: string | undefined): boolean {
  if (!signingKey) {
    console.error('Error: PERISKOPE_SIGNING_KEY not set in environment variables');
    return false;
  }

  if (!signature) {
    console.error('Error: x-periskope-signature header is missing');
    return false;
  }

  const hmac = createHmac('sha256', signingKey);
  hmac.update(rawBody);
  const digest = hmac.digest('hex');
  
  return digest === signature;
}

