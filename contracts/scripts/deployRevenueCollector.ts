import './loadEnv';
import { Address, toNano } from '@ton/core';
import type { NetworkProvider } from '@ton/blueprint';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RevenueCollector } from '../build/RevenueCollector/tact_RevenueCollector';

function updateEnvValue(filePath: string, key: string, value: string) {
  let content = readFileSync(filePath, 'utf8');
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  content = pattern.test(content)
    ? content.replace(pattern, line)
    : `${content.trimEnd()}\n${line}\n`;
  writeFileSync(filePath, content, 'utf8');
}

export async function run(provider: NetworkProvider) {
  const revenueWallet = process.env.GOVERNMENT_WALLET_ADDRESS;
  const exchangeRateNgn = process.env.TON_EXCHANGE_RATE_NGN;
  if (!revenueWallet || !exchangeRateNgn) {
    throw new Error('Set GOVERNMENT_WALLET_ADDRESS and TON_EXCHANGE_RATE_NGN in contracts/.env');
  }

  const owner = provider.sender().address;
  if (!owner) throw new Error('Connect the TON testnet wallet that will own the contract.');

  const parsedRate = Number(exchangeRateNgn);
  if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
    throw new Error('TON_EXCHANGE_RATE_NGN must be a positive number.');
  }

  const recipient = Address.parse(revenueWallet);
  const rateKobo = BigInt(Math.round(parsedRate * 100));
  const contract = provider.open(await RevenueCollector.fromInit(owner, recipient, rateKobo));

  console.log(`Owner: ${owner.toString({ testOnly: true, bounceable: false })}`);
  console.log(`YIRS revenue wallet: ${recipient.toString({ testOnly: true, bounceable: false })}`);
  console.log(`Predicted contract: ${contract.address.toString({ testOnly: true, bounceable: false })}`);

  await contract.send(provider.sender(), { value: toNano('0.2') }, { $$type: 'Deploy', queryId: 0n });
  await provider.waitForDeploy(contract.address);

  const contractAddress = contract.address.toString({ testOnly: true, bounceable: false });
  const explorerUrl = `https://testnet.tonviewer.com/${contractAddress}`;
  console.log(`RevenueCollector deployed at ${contractAddress}`);
  console.log(`Explorer: ${explorerUrl}`);

  const projectRoot = path.resolve(__dirname, '../..');
  const backendEnv = path.join(projectRoot, 'backend', '.env');
  updateEnvValue(backendEnv, 'TON_CONTRACT_ADDRESS', contractAddress);

  const evidenceDir = path.join(projectRoot, 'docs', 'evaluation-results');
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(
    path.join(evidenceDir, 'testnet-deployment.json'),
    `${JSON.stringify({
      network: 'TON testnet',
      status: 'active',
      contract: 'RevenueCollector',
      contractAddress,
      ownerAddress: owner.toString({ testOnly: true, bounceable: false }),
      revenueWalletAddress: recipient.toString({ testOnly: true, bounceable: false }),
      exchangeRateNgn: parsedRate,
      exchangeRateKobo: rateKobo.toString(),
      deployedAt: new Date().toISOString(),
      explorerUrl,
    }, null, 2)}\n`,
    'utf8',
  );

  console.log('backend/.env updated automatically with TON_CONTRACT_ADDRESS.');
  console.log('Deployment evidence written to docs/evaluation-results/testnet-deployment.json.');
}
