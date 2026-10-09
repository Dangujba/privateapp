# Local TON testnet setup

1. Install Node.js 22+, npm and PostgreSQL.
2. Create database `yirs_revenue`.
3. Put the local PostgreSQL password in `backend/.env`.
4. Run `npm install`, `npm run db:setup`, `npm run seed`, then `npm run dev`.
5. Build and deploy the fresh RevenueCollector contract from the `contracts` workspace.
6. Copy the newly deployed contract address to `TON_CONTRACT_ADDRESS` in `backend/.env` and restart the backend.
7. Connect a TON testnet wallet through the web interface and fund it with testnet TON before attempting a payment.

Never place wallet recovery phrases or private keys in environment files.
