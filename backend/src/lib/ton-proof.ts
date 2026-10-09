import { createHash } from 'node:crypto';
import { Address, Cell, contractAddress, loadStateInit } from '@ton/core';
import nacl from 'tweetnacl';
import { config } from '../config.js';
import { ApiError } from './http.js';

export interface TonProofInput {
  address: string;
  walletStateInit: string;
  network: string;
  proof: {
    timestamp: number;
    domain: { lengthBytes: number; value: string };
    payload: string;
    signature: string;
  };
}

const sha256 = (data: Buffer) => createHash('sha256').update(data).digest();

async function resolvePublicKey(address: Address): Promise<Buffer> {
  const params = new URLSearchParams({ address: address.toRawString(), method: 'get_public_key', stack: '[]' });
  const response = await fetch(`${config.TON_API_URL}/runGetMethod?${params}`, {
    headers: config.TON_API_KEY ? { 'X-API-Key': config.TON_API_KEY } : undefined,
  });
  if (!response.ok) throw new ApiError(503, 'Unable to resolve wallet public key');
  const body = await response.json() as { ok?: boolean; result?: { stack?: Array<[string, string]> } };
  const raw = body.result?.stack?.[0]?.[1];
  if (!body.ok || !raw) throw new ApiError(400, 'Wallet does not expose a public key');
  const hex = raw.replace(/^0x/, '').padStart(64, '0');
  return Buffer.from(hex, 'hex');
}

export async function verifyTonProof(input: TonProofInput, expectedNonce: string) {
  const { proof } = input;
  if (proof.payload !== expectedNonce) throw new ApiError(400, 'Wallet proof challenge does not match');
  if (proof.domain.value !== config.APP_DOMAIN || proof.domain.lengthBytes !== Buffer.byteLength(config.APP_DOMAIN)) {
    throw new ApiError(400, 'Wallet proof domain does not match this application');
  }
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - proof.timestamp) > 15 * 60) throw new ApiError(400, 'Wallet proof has expired');

  const address = Address.parse(input.address);
  const init = loadStateInit(Cell.fromBase64(input.walletStateInit).beginParse());
  const derived = contractAddress(address.workChain, init);
  if (!derived.equals(address)) throw new ApiError(400, 'Wallet state-init does not match the address');

  const domain = Buffer.from(proof.domain.value, 'utf8');
  const workchain = Buffer.alloc(4);
  workchain.writeInt32BE(address.workChain);
  const domainLength = Buffer.alloc(4);
  domainLength.writeUInt32LE(domain.length);
  const timestamp = Buffer.alloc(8);
  timestamp.writeBigUInt64LE(BigInt(proof.timestamp));
  const message = Buffer.concat([
    Buffer.from('ton-proof-item-v2/', 'utf8'),
    workchain,
    address.hash,
    domainLength,
    domain,
    timestamp,
    Buffer.from(proof.payload, 'utf8'),
  ]);
  const digest = sha256(Buffer.concat([Buffer.from([0xff, 0xff]), Buffer.from('ton-connect', 'utf8'), sha256(message)]));
  const publicKey = await resolvePublicKey(address);
  const valid = nacl.sign.detached.verify(digest, Buffer.from(proof.signature, 'base64'), publicKey);
  if (!valid) throw new ApiError(400, 'Wallet proof signature is invalid');
  return { address: address.toString({ bounceable: true, urlSafe: true, testOnly: config.TON_NETWORK === 'testnet' }), publicKey: publicKey.toString('hex') };
}
