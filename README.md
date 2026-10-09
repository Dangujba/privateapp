# YIRS Blockchain Revenue System

A TON-based revenue collection system with separate portals for individuals, businesses/organisations and administrators.

## Architecture

- Frontend: Next.js + TypeScript + TON Connect
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL + Prisma
- Smart contract: Tact `RevenueCollector`
- Network: TON testnet for development and evaluation

## Revenue categories

The application supports revenue categories such as PAYE remittance, direct/self-assessment, presumptive turnover tax, withholding tax, individual capital gains tax, stamp duties, property-related revenue, consumption/entertainment charges, road and transport revenue, gaming/lottery/betting revenue, trade/haulage charges, licences, permits and other statutory levies.

## Security and configuration

Real `.env` files are intentionally excluded from Git. Only `.env.example` files are committed. Do not commit wallet recovery phrases, private keys, PostgreSQL passwords, JWT secrets or API keys.

## Windows local setup

Prerequisites: Node.js 22+, npm and PostgreSQL.

From the project root run:

```cmd
npm run setup:windows
```

The setup script creates local `.env` files from the examples when needed, asks for the local PostgreSQL `postgres` password, generates JWT secrets, creates the `yirs_revenue` database, installs dependencies, runs Prisma, seeds the demo users and builds the Tact contract.

Then start the system:

```cmd
npm run dev
```

Frontend: `http://localhost:3000`  
Backend: `http://localhost:3001/api/v1`

Demo accounts after seeding (password for all: `12345`):

- Admin: `admin@yirs-demo.test`
- Individual: `taxpayer@yirs-demo.test`
- Business: `business@yirs-demo.test`

## TON Connect manifest

The manifest is served dynamically at `/tonconnect-manifest.json` by:

`frontend/app/tonconnect-manifest.json/route.ts`

There must not also be a `frontend/public/tonconnect-manifest.json`, because Next.js treats that as a conflicting route.

For mobile-wallet testing or production, set `NEXT_PUBLIC_APP_URL` to a stable public HTTPS URL. Set the backend `FRONTEND_ORIGIN` to the same origin and `APP_DOMAIN` to the hostname only.

## Fresh TON testnet deployment

Fund the TON testnet wallet that should own the contract, then run:

```cmd
npm run deploy:yirs:testnet
```

The deployment flow connects to the wallet locally. Never send or store a wallet recovery phrase in this repository.

After a successful deployment the script writes the contract address to local `backend/.env` as `TON_CONTRACT_ADDRESS` and stores local deployment evidence under `docs/evaluation-results/`.

## Commands

```cmd
npm run dev
npm run typecheck
npm test
npm run build
npm run deploy:yirs:testnet
```
