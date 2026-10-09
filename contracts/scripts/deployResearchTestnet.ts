import './loadEnv';
import { Address, toNano } from '@ton/core';
import { mnemonicToPrivateKey, mnemonicValidate } from '@ton/crypto';
import { WalletContractV5R1 } from '@ton/ton';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { RevenueCollector } from '../build/RevenueCollector/tact_RevenueCollector';
import { createTestnetClient, sleep } from './testnetClient';

const TESTNET_GLOBAL_ID = -3;
const DEFAULT_REVENUE_RECIPIENT_ADDRESS = '0QB3Pcd3pULbGd70pJBWq7ZFZd5sfDqG_SVJgzthVbt0tG49';
const DEPLOY_VALUE = toNano('0.2');
const MINIMUM_OWNER_BALANCE = toNano('0.3');
const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 300_000;

function testnetAddress(address: Address): string {
  return address.toString({ bounceable: false, testOnly: true });
}

async function prompt(question: string): Promise<string> {
  const input = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const answer = await input.question(question);
  input.close();
  return answer.trim();
}

async function saveEvidence(details: Record<string, unknown>): Promise<string> {
  const outputDirectory = path.resolve(__dirname, '../../docs/evaluation-results');
  const outputPath = path.join(outputDirectory, 'testnet-deployment.json');
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(details, null, 2)}\n`, 'utf8');
  return outputPath;
}

async function main(): Promise<void> {
  if (!process.stdin.isTTY) throw new Error('Run this command in an interactive terminal.');

  const expectedOwner = process.env.DEPLOYER_WALLET_ADDRESS?.trim()
    ? Address.parse(process.env.DEPLOYER_WALLET_ADDRESS.trim())
    : null;
  const revenueRecipient = Address.parse(process.env.GOVERNMENT_WALLET_ADDRESS ?? DEFAULT_REVENUE_RECIPIENT_ADDRESS);
  const exchangeRateNgn = Number(process.env.TON_EXCHANGE_RATE_NGN ?? '5000');
  if (!Number.isFinite(exchangeRateNgn) || exchangeRateNgn <= 0) {
    throw new Error('TON_EXCHANGE_RATE_NGN must be a positive number.');
  }
  const exchangeRateKobo = BigInt(Math.round(exchangeRateNgn * 100));

  console.log('RevenueCollector research testnet deployment');
  console.log('The Owner recovery phrase will be visible while entered but is not written to disk.\n');
  const phrase = (await prompt('Contract Deployer / Owner (paste 24 words): '))
    .toLowerCase()
    .replace(/\s+/g, ' ');
  const words = phrase.split(' ');
  if (words.length !== 24 || !(await mnemonicValidate(words))) {
    throw new Error('The supplied Owner recovery phrase is invalid.');
  }

  const keyPair = await mnemonicToPrivateKey(words);
  const ownerWallet = WalletContractV5R1.create({
    publicKey: keyPair.publicKey,
    walletId: { networkGlobalId: TESTNET_GLOBAL_ID },
  });
  if (expectedOwner && !ownerWallet.address.equals(expectedOwner)) {
    throw new Error(
      `The supplied phrase derives ${testnetAddress(ownerWallet.address)}, not the configured Owner ${testnetAddress(expectedOwner)}.`,
    );
  }

  const client = createTestnetClient();
  const ownerState = await client.getContractState(ownerWallet.address);
  if (ownerState.state !== 'active') throw new Error('The Owner wallet is not active.');
  if (ownerState.balance < MINIMUM_OWNER_BALANCE) {
    throw new Error('The Owner wallet needs at least 0.3 test TON to deploy the contract.');
  }

  const contract = await RevenueCollector.fromInit(ownerWallet.address, revenueRecipient, exchangeRateKobo);
  const contractAddress = testnetAddress(contract.address);
  const explorerUrl = `https://testnet.tonviewer.com/${contractAddress}`;

  console.log('\nDeployment parameters:');
  console.log(`- Owner: ${testnetAddress(ownerWallet.address)}`);
  console.log(`- Revenue recipient: ${testnetAddress(revenueRecipient)}`);
  console.log(`- Exchange rate: NGN ${exchangeRateNgn} per TON`);
  console.log(`- Predicted contract: ${contractAddress}`);

  let contractState = await client.getContractState(contract.address);
  if (contractState.state !== 'active') {
    const confirmation = await prompt('\nType DEPLOY to broadcast the testnet deployment: ');
    if (confirmation !== 'DEPLOY') {
      console.log('Cancelled. No deployment transaction was sent.');
      return;
    }

    const openedOwner = client.open(ownerWallet);
    const openedContract = client.open(contract);
    console.log('Broadcasting deployment transaction...');
    await openedContract.send(
      openedOwner.sender(keyPair.secretKey),
      { value: DEPLOY_VALUE, bounce: false },
      { $$type: 'Deploy', queryId: 0n },
    );

    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      contractState = await client.getContractState(contract.address);
      if (contractState.state === 'active') break;
      console.log('Waiting for testnet confirmation...');
    }
    if (contractState.state !== 'active') {
      throw new Error(`Deployment was broadcast but confirmation timed out. Check ${explorerUrl}`);
    }
  } else {
    console.log('\nThe deterministic contract address is already active; no duplicate deployment was sent.');
  }

  const transactions = await client.getTransactions(contract.address, { limit: 1 });
  const deploymentTransaction = transactions[0];
  const deployedAt = deploymentTransaction
    ? new Date(deploymentTransaction.now * 1_000).toISOString()
    : new Date().toISOString();
  const evidencePath = await saveEvidence({
    network: 'TON testnet',
    status: 'active',
    contractAddress,
    ownerAddress: testnetAddress(ownerWallet.address),
    revenueRecipientAddress: testnetAddress(revenueRecipient),
    exchangeRateNgn,
    exchangeRateKobo: exchangeRateKobo.toString(),
    deployedAt,
    transactionLt: deploymentTransaction?.lt.toString() ?? null,
    transactionHashHex: deploymentTransaction?.hash().toString('hex') ?? null,
    explorerUrl,
  });

  console.log('\nRevenueCollector is ACTIVE on testnet.');
  console.log(`Contract: ${contractAddress}`);
  console.log(`Explorer: ${explorerUrl}`);
  console.log(`Evidence: ${evidencePath}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nDeployment failed: ${message}`);
  process.exitCode = 1;
});
