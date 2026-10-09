import './loadEnv';
import axios, { AxiosAdapter, AxiosError } from 'axios';
import { TonClient } from '@ton/ton';

const ENDPOINT = process.env.TON_TESTNET_ENDPOINT ?? 'https://testnet.toncenter.com/api/v2/jsonRPC';
const API_KEY = process.env.TONCENTER_API_KEY;
const PUBLIC_API_INTERVAL_MS = 1_250;
const MAX_RATE_LIMIT_RETRIES = 6;

export function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function createRateLimitedAdapter(): AxiosAdapter {
  const baseAdapter = axios.getAdapter('http');
  let queue = Promise.resolve();
  let nextRequestAt = 0;

  return async (config) => {
    let releaseQueue!: () => void;
    const previousRequest = queue;
    queue = new Promise<void>((resolve) => {
      releaseQueue = resolve;
    });
    await previousRequest;

    try {
      for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
        const delay = Math.max(0, nextRequestAt - Date.now());
        if (delay > 0) await sleep(delay);
        nextRequestAt = Date.now() + PUBLIC_API_INTERVAL_MS;

        try {
          return await baseAdapter(config);
        } catch (error) {
          if (!(error instanceof AxiosError) || error.response?.status !== 429 || attempt === MAX_RATE_LIMIT_RETRIES) {
            throw error;
          }
          const retryAfter = Number(error.response?.headers?.['retry-after']);
          const backoff = Number.isFinite(retryAfter)
            ? retryAfter * 1_000
            : Math.min(15_000, 2_000 * (attempt + 1));
          console.log(`TON Center rate limit reached; retrying in ${Math.ceil(backoff / 1_000)}s...`);
          nextRequestAt = Date.now() + backoff;
        }
      }
      throw new Error('TON Center rate-limit retry loop ended unexpectedly.');
    } finally {
      releaseQueue();
    }
  };
}

export function createTestnetClient(): TonClient {
  return new TonClient({
    endpoint: ENDPOINT,
    apiKey: API_KEY,
    httpAdapter: createRateLimitedAdapter(),
  });
}
