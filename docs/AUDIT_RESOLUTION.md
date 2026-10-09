# Audit resolution notes

The current architecture uses a direct assessed-revenue payment model. The backend verifies the TON transaction before marking a payment confirmed or issuing a receipt. The smart contract prevents reference replay, validates expiry and exchange rate, enforces the minimum assessed amount and supports owner-controlled pause and bounded rate changes.
