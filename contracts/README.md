# RevenueCollector

Tact smart contract for direct YIRS revenue collection on TON.

It validates the payment reference, expiry, configured TON/NGN exchange rate, minimum assessed amount and sufficient attached value. Processed references cannot be reused. The assessed amount is sent to the configured YIRS revenue wallet and remaining gas value is returned to the sender. The owner can pause payments and update the exchange rate within the configured safety bound.

## Recommended testnet deployment

From the project root:

```cmd
npm run deploy:yirs:testnet
```

This builds the contract, opens the TON Blueprint wallet flow, deploys to testnet, updates `backend/.env` with the new contract address and records deployment evidence under `docs/evaluation-results/testnet-deployment.json`.

No wallet recovery phrase or private key is stored in `.env`.

## Advanced mnemonic-based research deployment

```cmd
npm run deploy:research:testnet -w contracts
```

This alternative prompts locally for a 24-word recovery phrase and never writes it to disk. If `DEPLOYER_WALLET_ADDRESS` is set, the derived wallet must match it; otherwise the supplied valid wallet becomes the owner.
