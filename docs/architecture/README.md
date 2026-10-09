# Architecture

```mermaid
flowchart LR
  U[Individual or Business] --> F[Next.js portal]
  F --> B[Express API]
  B --> D[(PostgreSQL)]
  F --> W[TON Connect wallet]
  W --> C[RevenueCollector]
  C --> R[YIRS Revenue Wallet]
  B --> T[TON testnet verification]
  T --> B
```

Payment flow: choose the revenue type and assessed amount, prepare a signed `PayRevenue` transaction, submit through TON Connect, verify on the backend, then issue a receipt after confirmation.
