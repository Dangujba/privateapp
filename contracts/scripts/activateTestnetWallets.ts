import { internal, OpenedContract, SendMode, toNano } from '@ton/core';
import { mnemonicToPrivateKey, mnemonicValidate } from '@ton/crypto';
import { TonClient, WalletContractV5R1 } from '@ton/ton';
import { createInterface } from 'node:readline/promises';
import { createTestnetClient, sleep } from './testnetClient';

const TESTNET_GLOBAL_ID = -3;
const FUNDING_TARGET = toNano('0.08');
const ACTIVATION_TRANSFER = toNano('0.01');
const DONOR_FEE_RESERVE = toNano('0.05');
const POLL_INTERVAL_MS = 4_000;
const POLL_TIMEOUT_MS = 180_000;

const roles = [
  'Contract Deployer / Owner',
  'YIRS Revenue Recipient',
  'Business Payer',
  'Individual Payer',
] as const;

type Role = (typeof roles)[number];
type WalletState = Awaited<ReturnType<TonClient['getContractState']>>;
type ManagedWallet = {
  role: Role;
  secretKey: Buffer;
  contract: WalletContractV5R1;
  opened: OpenedContract<WalletContractV5R1>;
  state: WalletState;
};

function formatTon(value: bigint): string {
  const whole = value / 1_000_000_000n;
  const fraction = (value % 1_000_000_000n).toString().padStart(9, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function publicAddress(wallet: ManagedWallet): string {
  return wallet.contract.address.toString({ bounceable: false, testOnly: true });
}

async function phrasePrompt(label: string): Promise<string> {
  const input = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const answer = await input.question(`${label} (paste 24 words): `);
  input.close();
  return answer.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function confirmationPrompt(): Promise<boolean> {
  const input = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await input.question('\nType ACTIVATE to broadcast the testnet transactions: ');
  input.close();
  return answer.trim() === 'ACTIVATE';
}

async function refresh(client: TonClient, wallet: ManagedWallet): Promise<void> {
  wallet.state = await client.getContractState(wallet.contract.address);
}

async function waitUntil(
  description: string,
  condition: () => Promise<boolean>,
): Promise<void> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`Timed out while waiting for ${description}. Check the transaction in a testnet explorer, then rerun the command.`);
}

async function send(
  client: TonClient,
  sender: ManagedWallet,
  recipient: ManagedWallet,
  amount: bigint,
  note: string,
): Promise<void> {
  await refresh(client, sender);
  const previousSeqno = await sender.opened.getSeqno();
  await sender.opened.sendTransfer({
    seqno: previousSeqno,
    secretKey: sender.secretKey,
    sendMode: SendMode.PAY_GAS_SEPARATELY | SendMode.IGNORE_ERRORS,
    messages: [
      internal({
        to: recipient.contract.address,
        value: amount,
        bounce: false,
        body: note,
      }),
    ],
  });

  await waitUntil(`${sender.role} transaction confirmation`, async () => {
    await refresh(client, sender);
    if (sender.state.state !== 'active') return false;
    return (await sender.opened.getSeqno()) > previousSeqno;
  });
}

function selectDonor(wallets: ManagedWallet[], target: ManagedWallet, required: bigint): ManagedWallet | undefined {
  return wallets
    .filter((candidate) => candidate !== target && candidate.state.balance >= required)
    .sort((left, right) => (left.state.balance > right.state.balance ? -1 : 1))[0];
}

async function main(): Promise<void> {
  if (!process.stdin.isTTY) {
    throw new Error('Run this command in an interactive terminal so the recovery-phrase input can remain hidden.');
  }

  console.log('TON testnet W5 wallet activation');
  console.log('The recovery phrases will be visible while entered but are not written to disk.\n');

  const client = createTestnetClient();
  const wallets: ManagedWallet[] = [];

  for (const role of roles) {
    const phrase = await phrasePrompt(role);
    const words = phrase.split(' ');
    if (words.length !== 24 || !(await mnemonicValidate(words))) {
      throw new Error(`${role}: the supplied 24-word recovery phrase is invalid.`);
    }

    const keyPair = await mnemonicToPrivateKey(words);
    const contract = WalletContractV5R1.create({
      publicKey: keyPair.publicKey,
      walletId: { networkGlobalId: TESTNET_GLOBAL_ID },
    });
    const opened = client.open(contract);
    wallets.push({
      role,
      secretKey: keyPair.secretKey,
      contract,
      opened,
      state: await client.getContractState(contract.address),
    });
  }

  const uniqueAddresses = new Set(wallets.map((wallet) => wallet.contract.address.toRawString()));
  if (uniqueAddresses.size !== wallets.length) {
    throw new Error('The same wallet phrase was entered more than once. Enter four different wallets.');
  }

  console.log('\nWallets derived from the private input:');
  for (const wallet of wallets) {
    console.log(`- ${wallet.role}`);
    console.log(`  ${publicAddress(wallet)}`);
    console.log(`  ${formatTon(wallet.state.balance)} TON; ${wallet.state.state}`);
  }

  if (wallets.every((wallet) => wallet.state.state === 'active')) {
    console.log('\nAll four wallets are already active. No transaction was sent.');
    return;
  }

  if (!(await confirmationPrompt())) {
    console.log('Cancelled. No transaction was sent.');
    return;
  }

  // Start with funded wallets so at least one signer is active before it funds the others.
  wallets.sort((left, right) => (left.state.balance > right.state.balance ? -1 : 1));

  for (const wallet of wallets) {
    await Promise.all(wallets.map((candidate) => refresh(client, candidate)));
    if (wallet.state.state === 'active') {
      console.log(`${wallet.role}: already active.`);
      continue;
    }

    if (wallet.state.balance < FUNDING_TARGET) {
      const amountNeeded = FUNDING_TARGET - wallet.state.balance;
      const donor = selectDonor(wallets, wallet, amountNeeded + DONOR_FEE_RESERVE);
      if (!donor) {
        throw new Error(
          `${wallet.role} needs ${formatTon(amountNeeded)} TON, but none of the other supplied wallets has enough balance.`,
        );
      }

      console.log(`${donor.role} -> ${wallet.role}: funding ${formatTon(amountNeeded)} TON...`);
      await send(client, donor, wallet, amountNeeded, 'YIRSRevenueSystem testnet activation funding');
      await waitUntil(`${wallet.role} funding`, async () => {
        await refresh(client, wallet);
        return wallet.state.balance >= ACTIVATION_TRANSFER + DONOR_FEE_RESERVE;
      });
    }

    console.log(`${wallet.role}: sending first outgoing transaction...`);
    await send(client, wallet, wallet, ACTIVATION_TRANSFER, 'YIRSRevenueSystem testnet wallet activation');
    await refresh(client, wallet);
    console.log(`${wallet.role}: ACTIVE (${formatTon(wallet.state.balance)} TON).`);
  }

  await Promise.all(wallets.map((wallet) => refresh(client, wallet)));
  console.log('\nFinal testnet wallet status:');
  for (const wallet of roles.map((role) => wallets.find((candidate) => candidate.role === role)!)) {
    console.log(`- ${wallet.role}: ${wallet.state.state.toUpperCase()} | ${formatTon(wallet.state.balance)} TON`);
    console.log(`  ${publicAddress(wallet)}`);
  }

  if (wallets.some((wallet) => wallet.state.state !== 'active')) {
    throw new Error('At least one wallet is not active. Rerun the command to resume safely.');
  }
  console.log('\nAll four testnet wallets are active.');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nActivation failed: ${message}`);
  process.exitCode = 1;
});
