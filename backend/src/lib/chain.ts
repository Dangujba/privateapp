import { Address } from '@ton/core';
import type { PaymentIntent } from '@prisma/client';
import { config } from '../config.js';

interface TonCenterMessage {
  source?: string;
  destination?: string;
  value?: string;
  message?: string;
  msg_data?: { body?: string };
}

interface TonCenterTransaction {
  transaction_id: { hash: string; lt: string };
  utime: number;
  fee?: string;
  storage_fee?: string;
  other_fee?: string;
  in_msg?: TonCenterMessage;
  out_msgs?: TonCenterMessage[];
}

function sameAddress(a?: string, b?: string) {
  if (!a || !b) return false;
  try { return Address.parse(a).equals(Address.parse(b)); } catch { return false; }
}

export async function findConfirmedPayment(intent: PaymentIntent) {
  const query = new URLSearchParams({ address: intent.senderAddress, limit: '25', archival: 'true' });
  const response = await fetch(`${config.TON_API_URL}/getTransactions?${query}`, {
    headers: config.TON_API_KEY ? { 'X-API-Key': config.TON_API_KEY } : undefined,
  });
  if (!response.ok) throw new Error(`TON API returned ${response.status}`);
  const body = await response.json() as { ok?: boolean; result?: TonCenterTransaction[] };
  if (!body.ok || !body.result) throw new Error('TON API returned an invalid response');
  const earliest = Math.floor(intent.createdAt.getTime() / 1000) - 60;
  const match = body.result.find(tx => tx.utime >= earliest && tx.out_msgs?.some(message =>
    sameAddress(message.destination, config.TON_CONTRACT_ADDRESS) &&
    BigInt(message.value ?? '0') >= intent.amountNanoton &&
    (message.msg_data?.body === intent.payloadBoc || message.message === intent.payloadBoc)
  ));
  if (!match) return null;
  const outgoing = match.out_msgs?.find(message => sameAddress(message.destination, config.TON_CONTRACT_ADDRESS));
  return {
    transactionHash: match.transaction_id.hash,
    logicalTime: match.transaction_id.lt,
    sender: intent.senderAddress,
    recipient: config.TON_CONTRACT_ADDRESS,
    valueNanoton: BigInt(outgoing?.value ?? '0'),
    timestamp: new Date(match.utime * 1000),
    networkFeeNanoton: BigInt(match.fee ?? '0') + BigInt(match.storage_fee ?? '0') + BigInt(match.other_fee ?? '0'),
    raw: JSON.stringify(match),
  };
}
