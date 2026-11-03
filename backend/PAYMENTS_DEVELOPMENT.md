# Development payment simulation

The Payment Engine supports development-only mock collections and disbursements. MTN and Airtel simulate a provider request followed by a confirmation. Bank collection deliberately follows a different model: an external customer transfer must arrive as a verified incoming credit.

1. Ensure the development PostgreSQL database is running.
2. Apply the additive foundation migration:

   ```powershell
   yarn db:payment-engine-foundation
   ```

3. Start the backend with `PAYMENTS_MODE=mock`. The default is `mock` in development.
4. Sign in as an Owner and open **Payments & Banking**. Add the official development bank account under the ledger.
5. For MTN or Airtel, open **Add Service**, select the provider, then save.
6. Enter a development phone number in the Payment Sheet. The mock simulates customer authorization and provider confirmation, then finalizes the service after about 2.5 seconds.

For a Bank service collection, choose **Bank transfer** in Add Service and save once. Salehish immediately creates the pending bank-collection intent and displays the backend-authoritative amount, official account, and unique Salehish reference. It does not request a customer bank account, password, or PIN. In development, use the Owner-only **Development-only mock bank** panel in Payments & Banking to deliver a simulated incoming credit. Supply the exact active account, amount, currency, and Salehish reference. The transaction ID is generated when left blank. Only a correct match posts the service. Missing/wrong references or amounts remain unmatched for investigation.

The mock-bank scenario selector can deliver immediately, delay delivery, or store the credit as a missed notification. For a missed notification, click **I've Made the Transfer** in the cashier sheet; the inquiry reconciles the stored credit by reference, receiving account, exact amount, and currency. Reusing a mock transaction ID simulates a duplicate notification. Multiple browser sessions can create simultaneous intents, including intents for the same amount, because amount alone is never used for matching.

For approved employee advances and payments, MTN/Airtel/Bank are available at disbursement. Development mocks record an initiated payout, simulated customer/recipient authorization, and simulated provider callback before finalizing the existing finance record. Cash continues through its existing disbursement endpoint. Expenses can likewise select an external disbursement method; the expense record is created only after confirmation.

An owner or manager can also select MTN, Airtel, or Bank while settling a disbursed advance. The existing management signature is collected first, and the settlement is recorded only after the incoming repayment is verified.

The mock provider is blocked when `NODE_ENV=production`. No mobile-money or banking PIN is requested or stored. Existing Cash at Counter saves continue to use the existing workflows.

## Controlled manual bank payouts

Until a bank payout API is configured, deployment can use `PAYMENTS_MODE=manual` for Bank transfers. A bank expense, employee advance, or employee payment then remains pending after the cashier supplies the recipient account. An owner or manager must verify the executed transfer from authorised bank evidence, enter the bank transaction ID from **Payments & Banking**, and only then can Salehish post the existing business record. This workflow never presents customer bank-transfer instructions and never fabricates a successful payout.

For development API testing, an authenticated initiator can force a pending mock intent to `CONFIRMED`, `FAILED`, `REJECTED`, or `TIMED_OUT` through `POST /api/payments/mock/intents/:reference/:outcome`. The automatic confirmation remains the ordinary UI behaviour.

The generic bank notification endpoint is `POST /api/payment-provider-callbacks/bank/:accountId`. It is disabled unless `BANK_NOTIFICATIONS_ENABLED=true`, authenticates the raw request body with the `x-salehish-bank-signature` HMAC-SHA256 header, verifies the configured destination account, and deduplicates the bank transaction ID. Keep it disabled until the bank's Uganda-specific payload, signature procedure, transaction inquiry, rate limits, and production access have been confirmed. Provider-specific adapters still replace only the boundary in `payments/paymentProviders.js`; business workflows, performers, earnings, and payment finalization remain unchanged.
