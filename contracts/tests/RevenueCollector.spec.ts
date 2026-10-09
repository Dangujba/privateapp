import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { beginCell, toNano } from '@ton/core';
import { RevenueCollector } from '../build/RevenueCollector/tact_RevenueCollector';
import '@ton/test-utils';

describe('RevenueCollector', () => {
  let blockchain: Blockchain;
  let owner: SandboxContract<TreasuryContract>;
  let government: SandboxContract<TreasuryContract>;
  let payer: SandboxContract<TreasuryContract>;
  let attacker: SandboxContract<TreasuryContract>;
  let contract: SandboxContract<RevenueCollector>;
  const RATE_KOBO = 500_000n;
  const future = () => Math.floor(Date.now() / 1000) + 600;
  const metadata = beginCell().storeStringRefTail('TIN12345678').storeStringRefTail('direct_assessment').storeStringRefTail('2026 assessment').endCell();
  const message = (referenceHash = 1n, overrides: Record<string, unknown> = {}) => ({ $$type: 'PayRevenue' as const, queryId: 0n, referenceHash, amountKobo: 100_000n, exchangeRateKobo: RATE_KOBO, validUntil: BigInt(future()), metadata, ...overrides });

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    owner = await blockchain.treasury('owner'); government = await blockchain.treasury('government'); payer = await blockchain.treasury('payer'); attacker = await blockchain.treasury('attacker');
    contract = blockchain.openContract(await RevenueCollector.fromInit(owner.address, government.address, RATE_KOBO));
    const deployed = await contract.send(owner.getSender(), { value: toNano('1') }, { $$type: 'Deploy', queryId: 0n });
    expect(deployed.transactions).toHaveTransaction({ from: owner.address, to: contract.address, deploy: true, success: true });
  });

  it('deploys with expected state', async () => {
    expect(await contract.getGetOwner()).toEqualAddress(owner.address);
    expect(await contract.getGetGovernmentWallet()).toEqualAddress(government.address);
    expect(await contract.getGetCurrentExchangeRate()).toBe(RATE_KOBO);
    expect(await contract.getGetTransactionCount()).toBe(0n);
    expect(await contract.getGetTotalRevenueKobo()).toBe(0n);
  });

  it('routes the assessed amount to the revenue wallet', async () => {
    const result = await contract.send(payer.getSender(), { value: toNano('0.3') }, message());
    expect(result.transactions).toHaveTransaction({ from: payer.address, to: contract.address, success: true });
    expect(result.transactions).toHaveTransaction({ from: contract.address, to: government.address, value: 200_000_000n, success: true });
    expect(await contract.getGetTransactionCount()).toBe(1n);
    expect(await contract.getGetTotalRevenueKobo()).toBe(100_000n);
    expect(await contract.getIsReferenceProcessed(1n)).toBe(true);
  });

  it('rejects duplicate references', async () => {
    await contract.send(payer.getSender(), { value: toNano('0.3') }, message(5n));
    const replay = await contract.send(payer.getSender(), { value: toNano('0.3') }, message(5n));
    expect(replay.transactions).toHaveTransaction({ from: payer.address, to: contract.address, success: false });
  });

  it.each([
    ['incorrect exchange rate', { exchangeRateKobo: 600_000n }],
    ['below minimum', { amountKobo: 9_999n }],
    ['expired payload', { validUntil: 1n }],
  ])('rejects %s', async (_name, overrides) => {
    const result = await contract.send(payer.getSender(), { value: toNano('0.4') }, message(20n, overrides));
    expect(result.transactions).toHaveTransaction({ from: payer.address, to: contract.address, success: false });
  });

  it('enforces pause and owner-only controls', async () => {
    const unauthorised = await contract.send(attacker.getSender(), { value: toNano('0.05') }, { $$type: 'SetPaused', paused: true });
    expect(unauthorised.transactions).toHaveTransaction({ from: attacker.address, to: contract.address, success: false });
    await contract.send(owner.getSender(), { value: toNano('0.05') }, { $$type: 'SetPaused', paused: true });
    expect(await contract.getGetIsPaused()).toBe(true);
    const blocked = await contract.send(payer.getSender(), { value: toNano('0.3') }, message());
    expect(blocked.transactions).toHaveTransaction({ from: payer.address, to: contract.address, success: false });
  });
});
