import { Decimal } from 'decimal.js';
import { ApiError } from './http.js';

export function nairaToKobo(value: string | number): bigint {
  const decimal = new Decimal(value);
  if (!decimal.isFinite() || decimal.lte(0)) throw new ApiError(400, 'Amount must be greater than zero');
  return BigInt(decimal.mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toFixed(0));
}

export function koboToNaira(value: bigint): string {
  return new Decimal(value.toString()).div(100).toFixed(2);
}

export function koboToNanoton(kobo: bigint, exchangeRateKoboPerTon: bigint): bigint {
  if (exchangeRateKoboPerTon <= 0n) throw new ApiError(503, 'Exchange rate is unavailable');
  return (kobo * 1_000_000_000n + exchangeRateKoboPerTon / 2n) / exchangeRateKoboPerTon;
}
