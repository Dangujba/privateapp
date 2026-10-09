import { createHash } from 'node:crypto';
import { Address, beginCell, Cell } from '@ton/core';
import { ApiError } from './http.js';
import { config } from '../config.js';

export const PAY_REVENUE_OPCODE = 0x70617972;

export interface PayRevenuePayload {
  referenceId: string;
  taxpayerId: string;
  taxType: string;
  amountKobo: bigint;
  exchangeRateKobo: bigint;
  validUntil: number;
  description: string;
}

export function normaliseTonAddress(value: string): string {
  try {
    return Address.parse(value).toString({ bounceable: true, urlSafe: true, testOnly: config.TON_NETWORK === 'testnet' });
  } catch {
    throw new ApiError(400, 'Invalid TON address');
  }
}

export function encodePayRevenuePayload(input: PayRevenuePayload): string {
  const metadata = beginCell()
    .storeStringRefTail(input.taxpayerId)
    .storeStringRefTail(input.taxType.slice(0, 80))
    .storeStringRefTail(input.description.slice(0, 240))
    .endCell();
  return beginCell()
    .storeUint(PAY_REVENUE_OPCODE, 32)
    .storeUint(0, 64)
    .storeUint(BigInt(`0x${createHash('sha256').update(input.referenceId).digest('hex')}`), 256)
    .storeUint(input.amountKobo, 64)
    .storeUint(input.exchangeRateKobo, 64)
    .storeUint(input.validUntil, 32)
    .storeRef(metadata)
    .endCell()
    .toBoc()
    .toString('base64');
}

export function bocHash(base64: string): string {
  try {
    const cells = Cell.fromBoc(Buffer.from(base64, 'base64'));
    if (!cells[0]) throw new Error('Empty BOC');
    return cells[0].hash().toString('hex');
  } catch {
    throw new ApiError(400, 'Invalid BOC');
  }
}
