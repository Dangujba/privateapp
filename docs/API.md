# API overview

The API exposes authentication, taxpayer/business profiles, wallet verification, assessed revenue calculation, payment initiation and verification, receipts, administrative records, reporting, audit logs, settings and RevenueCollector deployment records.

`POST /payments/initiate` requires a TON-Proof-verified sender and an idempotency key. The request supplies an amount, revenue type, optional period and description. The API returns the configured contract address, exact nanoton value, expiry and encoded `PayRevenue` payload.
