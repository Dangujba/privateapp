import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  JWT_ACCESS_SECRET: z.string().min(32).default('development-access-secret-change-me-123456789'),
  JWT_REFRESH_SECRET: z.string().min(32).default('development-refresh-secret-change-me-12345678'),
  ACCESS_TOKEN_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(7),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:3000'),
  APP_DOMAIN: z.string().default('localhost'),
  TON_NETWORK: z.enum(['testnet', 'mainnet']).default('testnet'),
  TON_API_URL: z.string().url().default('https://testnet.toncenter.com/api/v2'),
  TON_API_KEY: z.string().default(''),
  TON_CONTRACT_ADDRESS: z.string().default(''),
  GOVERNMENT_WALLET_ADDRESS: z.string().default(''),
  TON_EXCHANGE_RATE_NGN: z.coerce.number().positive().default(5000),
  PAYMENT_GAS_NANOTON: z.coerce.bigint().default(100000000n),
});

export const config = schema.parse(process.env);

if (config.NODE_ENV === 'production') {
  if (config.JWT_ACCESS_SECRET.startsWith('development-') || config.JWT_REFRESH_SECRET.startsWith('development-')) {
    throw new Error('Production JWT secrets must be configured');
  }
  if (!config.TON_CONTRACT_ADDRESS || !config.GOVERNMENT_WALLET_ADDRESS) {
    throw new Error('Production TON addresses must be configured');
  }
}
